import { getBulkTargetData, ProjectContext, executeRepositoryCommand, detectRepo } from "./repository-detector.js";
import { toolDefinitions } from "./tools-schema.js";
import * as fs from "fs";
import * as path from "path";
import { promises as fsp } from "fs";
import { spawn } from "child_process";

export interface NewAgentOptions {
  serverUrl: string;
  apiKey?: string;
  jwt?: string;
  cwd: string;
  projectContext: ProjectContext;
  onStepFinish?: (stepData: any) => void;
}

export interface NewAgentResult {
  text: string;
  toolCalls?: any[];
  toolResults?: any[];
  finishReason?: string;
  usage?: any;
  structuredData?: any;
  // Search result fields
  packages?: any[];
  query?: string;
  totalAvailable?: number;
  // Install stage fields
  stage?: string;
  description?: string;
}

export class NewAgent {
  private projectContext: ProjectContext;
  private cwd: string;
  private serverUrl: string;
  private apiKey?: string;
  private jwt?: string;
  private onStepFinish?: (stepData: any) => void;

  constructor(options: NewAgentOptions) {
    this.cwd = options.cwd;
    this.projectContext = options.projectContext;
    this.onStepFinish = options.onStepFinish;
    this.serverUrl = options.serverUrl;
    this.apiKey = options.apiKey;
    this.jwt = options.jwt;
    if (!this.apiKey && !this.jwt) {
      throw new Error("API key or JWT token is required");
    }
  }

  private getAuthHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }
    if (this.jwt) {
      headers["Authorization"] = `Bearer ${this.jwt}`;
    }

    return headers;
  }

  async searchPackages(query: string): Promise<NewAgentResult> {
    // Add bulk target data to project context
    const bulkTargetData = await getBulkTargetData(
      this.projectContext.targets,
      this.cwd
    );
    this.projectContext.target_dependencies = bulkTargetData;

    // Step 1: Create search agent run
    const searchResponse = await fetch(`${this.serverUrl}/api/agent/search`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        query,
        project_context: this.projectContext
      })
    });

    if (!searchResponse.ok) {
      throw new Error(`Failed to create search agent run: ${searchResponse.statusText}`);
    }

    const { agent_id } = await searchResponse.json();

    // Step 2: Start the conversation
    return this.runConversation(agent_id);
  }

  async installPackage(packageName: string): Promise<NewAgentResult> {
    // Add bulk target data to project context
    const bulkTargetData = await getBulkTargetData(
      this.projectContext.targets,
      this.cwd
    );
    this.projectContext.target_dependencies = bulkTargetData;

    // Step 1: Create install agent run
    const installResponse = await fetch(`${this.serverUrl}/api/agent/install`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        package: packageName,
        project_context: this.projectContext
      })
    });

    if (!installResponse.ok) {
      const errorText = await installResponse.text();
      throw new Error(`Failed to create install agent run: ${installResponse.statusText} - ${errorText}`);
    }

    const { agent_id } = await installResponse.json();

    // Step 2: Start the conversation
    return this.runConversation(agent_id);
  }

  private async runConversation(agent_id: string, payload?: string): Promise<NewAgentResult> {
    let currentPayload = payload;
    const maxIterations = 50; // Prevent infinite loops
    let iterationCount = 0;

    while (iterationCount < maxIterations) {
      iterationCount++;

      const eventsResponse = await fetch(`${this.serverUrl}/api/agent/events`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          agent_id,
          payload: currentPayload
        })
      });

      if (!eventsResponse.ok) {
        const errorText = await eventsResponse.text();
        throw new Error(`Failed to process agent events: ${eventsResponse.statusText} - ${errorText}`);
      }

      const result = await eventsResponse.json();

      // Notify about the step with structured data
      if (this.onStepFinish) {
        let stepData: any = {
          text: result.message || '',
          toolCalls: result.action === 'tool_call' ? [{ toolName: result.tool_name, args: result.data }] : [],
          toolResults: [],
          finishReason: result.action === 'response' ? 'stop' : undefined,
          usage: {},
          structuredData: result.data // Pass through the structured data
        };

        // For install operations, extract stage information
        if (result.data?.stage) {
          stepData.stage = result.data.stage;
          stepData.description = result.data.description;
        }

        // For search operations, extract package data
        if (result.data?.packages) {
          stepData.packages = result.data.packages;
          stepData.query = result.data.query;
          stepData.totalAvailable = result.data.total_available;
        }

        this.onStepFinish(stepData);
      }

      // Handle different response types
      switch (result.action) {
        case 'response':
          // Final response from LLM with structured data
          return {
            text: result.message,
            toolCalls: [],
            toolResults: [],
            finishReason: result.data?.finishReason || 'stop',
            usage: {},
            structuredData: result.data,
            // Include specific fields for backward compatibility and easy access
            packages: result.data?.packages,
            query: result.data?.query,
            totalAvailable: result.data?.total_available,
            stage: result.data?.stage,
            description: result.data?.description
          };

        case 'tool_call':
          // LLM wants to call a tool - execute it and continue
          const toolResult = await this.executeTool(result.tool_name, result.data);

          // Prepare tool result payload for next iteration
          currentPayload = JSON.stringify({
            tool_call_id: result.data.tool_call_id,
            result: toolResult
          });

          // Continue to next iteration
          break;

        case 'error':
          throw new Error(`Agent error: ${result.message}`);

        default:
          throw new Error(`Unknown agent response action: ${result.action}`);
      }
    }

    // If we've reached the maximum number of iterations, throw an error
    throw new Error(`Conversation exceeded maximum iterations (${maxIterations}).`);
  }

  private async executeTool(toolName: string, args: any): Promise<any> {
    console.log(`Executing tool: ${toolName}`, args);

    // Remove tool_call_id from args as it's not part of the tool parameters
    const { tool_call_id, ...toolArgs } = args;

    // Validate arguments against tool schema
    const toolDefinition = toolDefinitions[toolName as keyof typeof toolDefinitions];
    if (!toolDefinition) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    try {
      toolDefinition.parameters.parse(toolArgs);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        throw new Error(`Invalid arguments for tool ${toolName}: ${error.message}`);
      }
      throw new Error(`Failed to validate arguments for tool ${toolName}: ${error}`);
    }

    switch (toolName) {
      case 'read_file':
        return this.readFile(toolArgs.path);

      case 'write_file':
        return this.writeFile(toolArgs.path, toolArgs.content);

      case 'create_file':
        return this.createFile(toolArgs.path, toolArgs.content);

      case 'list_directory':
        return this.listDirectory(toolArgs.path, toolArgs.include_hidden);

      case 'append_to_file':
        return this.appendToFile(toolArgs.path, toolArgs.content);

      case 'delete_file':
        return this.deleteFile(toolArgs.path, toolArgs.recursive);

      case 'edit_file':
        return this.editFile(toolArgs.path, toolArgs.old_string, toolArgs.new_string);

      case 'get_bulk_target_data':
        return this.getBulkTargetData(toolArgs.targetNames, toolArgs.repoPath);

      case 'typecheck':
        return this.typecheck(toolArgs.target, toolArgs.repoPath);

      default:
        // This should never be reached due to validation above
        throw new Error(`Unhandled tool: ${toolName}`);
    }
  }

  // Tool implementations
  private async readFile(filePath: string): Promise<any> {
    try {
      const absolutePath = path.resolve(this.cwd, filePath);
      const content = await fsp.readFile(absolutePath, 'utf-8');
      return {
        path: filePath,
        content,
        success: true
      };
    } catch (error) {
      return {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  private async writeFile(filePath: string, content: string): Promise<any> {
    try {
      const absolutePath = path.resolve(this.cwd, filePath);
      await fsp.writeFile(absolutePath, content, 'utf-8');
      return {
        path: filePath,
        success: true,
        message: 'File written successfully'
      };
    } catch (error) {
      return {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  private async createFile(filePath: string, content: string): Promise<any> {
    try {
      const absolutePath = path.resolve(this.cwd, filePath);
      const dir = path.dirname(absolutePath);
      await fsp.mkdir(dir, { recursive: true });

      // Check if file already exists
      try {
        await fsp.access(absolutePath);
        return {
          path: filePath,
          error: 'File already exists',
          success: false
        };
      } catch {
        // File doesn't exist, proceed with creation
        await fsp.writeFile(absolutePath, content, 'utf-8');
        return {
          path: filePath,
          success: true,
          message: 'File created successfully'
        };
      }
    } catch (error) {
      return {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  private async listDirectory(dirPath: string, includeHidden: boolean = false): Promise<any> {
    try {
      const absolutePath = path.resolve(this.cwd, dirPath);
      const entries = await fsp.readdir(absolutePath, { withFileTypes: true });
      const items = entries
        .filter((entry) => includeHidden || !entry.name.startsWith('.'))
        .map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: path.join(dirPath, entry.name)
        }));

      return {
        path: dirPath,
        items,
        success: true
      };
    } catch (error) {
      return {
        path: dirPath,
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  private async appendToFile(filePath: string, content: string): Promise<any> {
    try {
      const absolutePath = path.resolve(this.cwd, filePath);
      await fsp.appendFile(absolutePath, content, 'utf-8');
      return {
        path: filePath,
        success: true,
        message: 'Content appended successfully'
      };
    } catch (error) {
      return {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  private async deleteFile(filePath: string, recursive: boolean = false): Promise<any> {
    try {
      const absolutePath = path.resolve(this.cwd, filePath);
      const stats = await fsp.lstat(absolutePath);
      if (stats.isDirectory()) {
        await fsp.rmdir(absolutePath, { recursive });
      } else {
        await fsp.unlink(absolutePath);
      }
      return {
        path: filePath,
        success: true,
        message: `${stats.isDirectory() ? 'Directory' : 'File'} deleted successfully`
      };
    } catch (error) {
      return {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  private async editFile(filePath: string, oldString: string, newString: string): Promise<any> {
    try {
      const absolutePath = path.resolve(this.cwd, filePath);
      const currentContent = await fsp.readFile(absolutePath, 'utf-8');

      if (!currentContent.includes(oldString)) {
        return {
          path: filePath,
          error: 'Old string not found in file',
          success: false
        };
      }

      const newContent = currentContent.replace(oldString, newString);
      await fsp.writeFile(absolutePath, newContent, 'utf-8');

      return {
        path: filePath,
        success: true,
        message: 'File edited successfully'
      };
    } catch (error) {
      return {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  private async getBulkTargetData(targetNames: string[] | string, repoPath?: string): Promise<any> {
    try {
      const processedTargetNames = Array.isArray(targetNames) ? targetNames : [targetNames];
      const resolvedRepoPath = repoPath ? path.resolve(this.cwd, repoPath) : this.cwd;

      const requestedTargets: Record<string, any> = {};
      const availableTargetNames = Object.keys(this.projectContext.targets || {});
      const invalidTargets: string[] = [];

      for (const targetName of processedTargetNames) {
        if (this.projectContext.targets && this.projectContext.targets[targetName]) {
          requestedTargets[targetName] = this.projectContext.targets[targetName];
        } else {
          invalidTargets.push(targetName);
        }
      }

      if (invalidTargets.length > 0) {
        return {
          success: false,
          error: `Invalid target names: ${invalidTargets.join(', ')}. Available targets: ${availableTargetNames.join(', ')}`
        };
      }

      if (Object.keys(requestedTargets).length === 0) {
        return {
          success: false,
          error: 'No valid targets specified'
        };
      }

      const result = await getBulkTargetData(requestedTargets, resolvedRepoPath);
      return {
        success: true,
        data: result,
        requestedTargets: Object.keys(requestedTargets),
        availableTargets: availableTargetNames
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async typecheck(target?: string, repoPath?: string): Promise<any> {
    try {
      const resolvedRepoPath = repoPath ? path.resolve(this.cwd, repoPath) : this.cwd;
      let output = "";
      let hasError = false;

      // Get repository info
      const repo = await detectRepo(resolvedRepoPath);
      if (!repo.targets || Object.keys(repo.targets).length === 0) {
        return {
          success: false,
          error: "No targets found in repository",
          target: target || "default",
          repoPath: resolvedRepoPath,
        };
      }

      // Find the appropriate target
      const targetKey = target ? Object.keys(repo.targets).find(key => key.includes(target)) : Object.keys(repo.targets)[0];
      if (!targetKey) {
        return {
          success: false,
          error: `Target "${target}" not found`,
          target: target || "default", 
          repoPath: resolvedRepoPath,
        };
      }

      const targetInfo = repo.targets[targetKey];
      const checkActions = targetInfo.actions?.check || [];
      
      if (checkActions.length === 0) {
        return {
          success: false,
          error: "No check actions defined for target",
          target: target || "default",
          repoPath: resolvedRepoPath,
        };
      }

      // Execute check commands silently (no output to console)
      for (const action of checkActions) {
        await new Promise<void>((resolve, reject) => {
          const [cmd, ...args] = action.command.split(" ");
          const child = spawn(cmd, args, {
            cwd: targetInfo.path ? path.resolve(resolvedRepoPath, targetInfo.path) : resolvedRepoPath,
            stdio: 'pipe', // Capture all output, don't inherit to console
            shell: true
          });

          let stdout = '';
          let stderr = '';
          
          child.stdout?.on('data', (data) => {
            stdout += data.toString();
          });
          
          child.stderr?.on('data', (data) => {
            stderr += data.toString();
            hasError = true;
          });

          child.on("close", (code) => {
            // Only capture actual errors, not info output
            if (code !== 0) {
              hasError = true;
              if (stderr) {
                output += `${stderr.trim()}\n`;
              }
            }
            resolve();
          });

          child.on("error", (error) => {
            hasError = true;
            output += `Failed to execute: ${error.message}\n`;
            resolve();
          });
        });
      }

      return {
        success: !hasError,
        output: output.trim() || (hasError ? "Type checking failed" : "Type checking passed"),
        target: targetKey,
        repoPath: resolvedRepoPath,
        message: hasError ? "Type checking completed with errors" : "Type checking completed successfully"
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        target: target || "default",
        repoPath: repoPath || this.cwd,
      };
    }
  }
}
