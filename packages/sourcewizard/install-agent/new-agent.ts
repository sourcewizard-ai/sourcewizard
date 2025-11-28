import { getBulkTargetData, executeRepositoryCommandV2, ProjectContext } from "../repodetect/index.js";
import { toolDefinitions } from "./tools-schema.js";
import * as path from "path";
import { promises as fsp } from "fs";
import { glob } from "glob";

export interface NewAgentOptions {
  serverUrl: string;
  apiKey?: string;
  jwt?: string;
  cwd?: string;
  projectContext?: ProjectContext;
  onStepFinish?: (stepData: any) => void;
}

export interface TodoItem {
  task: string;
  completed: boolean;
}

export interface TodoResult {
  todos: TodoItem[];
  success: boolean;
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
  // Reuse result fields
  results?: any[];
  task?: string;
  // Install stage fields
  stage?: string;
  description?: string;
  // Error fields
  error?: string;
}

export class NewAgent {
  private projectContext: ProjectContext;
  private cwd: string;
  private serverUrl: string;
  private apiKey?: string;
  private jwt?: string;
  private onStepFinish?: (stepData: any) => void;
  private readFilesByAgent: Map<string, Set<string>> = new Map();
  private todos: TodoItem[] = [];

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

  async searchPackages(query: string, projectContext?: ProjectContext, cwd?: string): Promise<NewAgentResult> {
    if (projectContext) {
      this.projectContext = projectContext;
    }
    if (cwd) {
      this.cwd = cwd;
    }
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

  async installPackage(packageName: string, projectContext?: ProjectContext, cwd?: string): Promise<NewAgentResult> {
    if (projectContext) {
      this.projectContext = projectContext;
    }
    if (cwd) {
      this.cwd = cwd;
    }
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

  async checkCodeReusability(task: string, history?: string[]): Promise<NewAgentResult> {
    // Add bulk target data to project context
    const bulkTargetData = await getBulkTargetData(
      this.projectContext.targets,
      this.cwd
    );
    this.projectContext.target_dependencies = bulkTargetData;

    // Create initial todos for all targets in project context
    this.todos = [];
    if (this.projectContext.targets) {
      const targetNames = Object.keys(this.projectContext.targets);
      for (const targetName of targetNames) {
        this.todos.push({
          task: `Check target ${targetName} for relevant code`,
          completed: false
        });
      }
    }
    // Add a todo for checking external dependencies
    this.todos.push({
      task: 'Search external dependencies',
      completed: false
    });

    // Step 1: Create reuse agent run
    const reuseResponse = await fetch(`${this.serverUrl}/api/agent/reuse`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        task,
        history,
        project_context: this.projectContext
      })
    });

    if (!reuseResponse.ok) {
      const errorText = await reuseResponse.text();
      throw new Error(`Failed to create reuse agent run: ${reuseResponse.statusText} - ${errorText}`);
    }

    const { agent_id } = await reuseResponse.json();

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

        // For reuse operations, extract results data
        if (result.data?.results) {
          stepData.results = result.data.results;
          stepData.task = result.data.task;
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
            results: result.data?.results,
            task: result.data?.task,
            stage: result.data?.stage,
            description: result.data?.description
          };

        case 'tool_call':
          // Check if we have multiple tools to execute in parallel
          if (result.tool_names && Array.isArray(result.tool_names) && result.tool_names.length > 1) {
            const toolCallIds = Object.keys(result.data);

            // Group add_package calls together
            const addPackageCalls: Array<{ toolCallId: string; toolData: any }> = [];
            const otherCalls: Array<{ toolCallId: string; toolData: any }> = [];

            for (const toolCallId of toolCallIds) {
              const toolData = result.data[toolCallId];
              if (toolData.tool_name === 'add_package') {
                addPackageCalls.push({ toolCallId, toolData });
              } else {
                otherCalls.push({ toolCallId, toolData });
              }
            }

            const resultsRecord: Record<string, any> = {};

            // Handle grouped add_package calls
            if (addPackageCalls.length > 1) {
              // Extract packages and common parameters from all add_package calls
              const packages: string[] = [];
              let commonTarget: string | undefined;
              let commonIsDev: boolean | undefined;
              let commonUseWorkspace: boolean | undefined;
              let commonAdditionalFlags: string[] | undefined;
              let commonRepoPath: string | undefined;

              for (const { toolData } of addPackageCalls) {
                const { tool_call_id, packageName, target, isDev, useWorkspace, additionalFlags, repoPath } = toolData;
                packages.push(packageName);

                // Use first call's parameters as common parameters
                if (commonTarget === undefined) commonTarget = target;
                if (commonIsDev === undefined) commonIsDev = isDev;
                if (commonUseWorkspace === undefined) commonUseWorkspace = useWorkspace;
                if (commonAdditionalFlags === undefined) commonAdditionalFlags = additionalFlags;
                if (commonRepoPath === undefined) commonRepoPath = repoPath;
              }

              // Execute grouped add_package call
              const groupedResult = await this.addMultiplePackages(
                packages,
                commonTarget,
                commonIsDev,
                commonUseWorkspace,
                commonAdditionalFlags,
                commonRepoPath
              );

              // Assign the same result to all add_package tool calls
              for (const { toolCallId } of addPackageCalls) {
                resultsRecord[toolCallId] = groupedResult;
              }
            } else if (addPackageCalls.length === 1) {
              // Single add_package call
              const { toolCallId, toolData } = addPackageCalls[0];
              const toolResult = await this.executeTool(agent_id, toolData.tool_name, toolData);
              resultsRecord[toolCallId] = toolResult;
            }

            // Execute other tools in parallel
            const otherPromises = otherCalls.map(async ({ toolCallId, toolData }) => {
              const toolResult = await this.executeTool(agent_id, toolData.tool_name, toolData);
              return { toolCallId, result: toolResult };
            });

            const otherResults = await Promise.all(otherPromises);

            // Add other tool results
            for (const { toolCallId, result: toolResult } of otherResults) {
              resultsRecord[toolCallId] = toolResult;
            }

            // Prepare payload with all tool results
            currentPayload = JSON.stringify({
              tool_results: resultsRecord
            });
          } else {
            // Single tool execution (existing behavior)
            const toolResult = await this.executeTool(agent_id, result.tool_name || result.data?.tool_name, result.data);

            // Prepare tool result payload for next iteration
            currentPayload = JSON.stringify({
              tool_call_id: result.data.tool_call_id,
              result: toolResult
            });
          }

          // Continue to next iteration
          break;

        case 'error':
          // Log the error but check if it's a recoverable error vs system error
          console.warn('Agent received error response:', {
            message: result.message,
            timestamp: result.timestamp
          });

          // If this is a system-level error (not a tool failure), notify and throw
          if (result.message && (
            result.message.includes('Internal server error') ||
            result.message.includes('Authentication required') ||
            result.message.includes('Insufficient credits')
          )) {
            if (this.onStepFinish) {
              this.onStepFinish({
                text: result.message || '',
                toolCalls: [],
                toolResults: [],
                finishReason: 'stop',
                usage: {},
                structuredData: result.data,
                error: result.message || 'System error occurred',
                isError: true
              });
            }
            throw new Error(`System error: ${result.message}`);
          }

          // For other errors (likely tool failures), return a response but don't throw
          // This allows the conversation to continue naturally
          return {
            text: result.message || 'An error occurred, but continuing...',
            toolCalls: [],
            toolResults: [],
            finishReason: undefined, // Don't mark as finished
            usage: {},
            structuredData: result.data,
            error: result.message,
            stage: 'error',
            description: result.message || 'Error occurred'
          };

        default:
          throw new Error(`Unknown agent response action: ${result.action}`);
      }
    }

    // If we've reached the maximum number of iterations, throw an error
    throw new Error(`Conversation exceeded maximum iterations (${maxIterations}).`);
  }

  private async executeTool(agentId: string, toolName: string, args: any): Promise<any> {
    // Tool execution is now shown via onStepFinish callback in CLI
    // console.log(`Executing tool: ${toolName}`, args);

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
      // Return validation errors as tool results instead of throwing
      // This allows the LLM to see the error and retry with corrected parameters
      if (error instanceof Error && error.name === 'ZodError') {
        return {
          success: false,
          error: `Invalid arguments for tool ${toolName}: ${error.message}. Please check the tool schema and provide valid arguments.`,
          toolName,
          providedArgs: toolArgs
        };
      }
      return {
        success: false,
        error: `Failed to validate arguments for tool ${toolName}: ${error}`,
        toolName,
        providedArgs: toolArgs
      };
    }

    switch (toolName) {
      case 'read_file':
        return this.readFile(agentId, toolArgs.path);

      case 'write_file':
        return this.writeFile(toolArgs.path, toolArgs.content);

      case 'create_file':
        return this.createFile(toolArgs.path, toolArgs.content);

      case 'list_directory':
        return this.listDirectory(toolArgs.path, toolArgs.include_hidden);

      case 'append_to_file':
        return this.appendToFile(agentId, toolArgs.path, toolArgs.content);

      case 'delete_file':
        return this.deleteFile(toolArgs.path, toolArgs.recursive);

      case 'edit_file':
        return this.editFile(agentId, toolArgs.path, toolArgs.old_string, toolArgs.new_string);

      case 'get_bulk_target_data':
        return this.getBulkTargetData(toolArgs.targetNames, toolArgs.repoPath);

      case 'typecheck':
        return this.typecheck(toolArgs.target, toolArgs.repoPath);

      case 'add_package':
        return this.addPackage(toolArgs.packageName, toolArgs.target, toolArgs.isDev, toolArgs.useWorkspace, toolArgs.additionalFlags, toolArgs.repoPath);

      case 'grep':
        return this.grep(agentId, toolArgs.pattern, toolArgs.paths, toolArgs.ignoreCase, toolArgs.lineNumbers, toolArgs.contextLines);

      case 'search_file':
        return this.searchFile(agentId, toolArgs.path, toolArgs.startLine, toolArgs.endLine, toolArgs.pattern, toolArgs.ignoreCase, toolArgs.includeLineNumbers);

      case 'todo_read':
        return this.todoRead();

      case 'todo_write':
        return this.todoWrite(toolArgs.todos);

      default:
        // This should never be reached due to validation above
        throw new Error(`Unhandled tool: ${toolName}`);
    }
  }

  // Tool implementations
  private async readFile(agentId: string, filePath: string): Promise<any> {
    try {
      const absolutePath = path.resolve(this.cwd, filePath);
      let content = await fsp.readFile(absolutePath, 'utf-8');

      // Check if file has more than 3000 lines
      const lines = content.split('\n');
      if (lines.length > 3000) {
        return {
          path: filePath,
          error: 'File is too large, use search_file tool or grep',
          success: false
        };
      }

      // Mask .env file contents
      const fileName = path.basename(filePath);
      if (fileName === '.env' || fileName.startsWith('.env.')) {
        content = this.maskEnvFileContent(content);
      }

      // Track that this file has been read in this agent session
      if (!this.readFilesByAgent.has(agentId)) {
        this.readFilesByAgent.set(agentId, new Set());
      }
      this.readFilesByAgent.get(agentId)!.add(path.normalize(filePath));

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

  private maskEnvFileContent(content: string): string {
    const lines = content.split('\n');
    const maskedLines = lines.map(line => {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) {
        return line;
      }

      // Parse environment variable line
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const varName = match[1].trim();
        const varValue = match[2].trim();
        return `${varName}=<length ${varValue.length}>`;
      }

      return line;
    });

    return maskedLines.join('\n');
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

  private async appendToFile(agentId: string, filePath: string, content: string): Promise<any> {
    // Check if file was read first in this agent session
    const agentReadFiles = this.readFilesByAgent.get(agentId);
    if (!agentReadFiles || !agentReadFiles.has(path.normalize(filePath))) {
      return {
        path: filePath,
        error: 'Read file first',
        success: false
      };
    }

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

  private async editFile(agentId: string, filePath: string, oldString: string, newString: string): Promise<any> {
    // Check if file was read first in this agent session
    const agentReadFiles = this.readFilesByAgent.get(agentId);
    if (!agentReadFiles || !agentReadFiles.has(path.normalize(filePath))) {
      return {
        path: filePath,
        error: 'Read file first',
        success: false
      };
    }

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

  private async grep(agentId: string, pattern: string, paths: string | string[], ignoreCase: boolean = false, lineNumbers: boolean = true, contextLines: number = 0): Promise<any> {
    try {
      const pathsArray = Array.isArray(paths) ? paths : [paths];
      const results: any[] = [];

      // Create regex with appropriate flags
      const flags = ignoreCase ? 'gi' : 'g';
      let regex: RegExp;

      try {
        regex = new RegExp(pattern, flags);
      } catch (regexError) {
        return {
          pattern,
          error: `Invalid regex pattern: ${regexError instanceof Error ? regexError.message : String(regexError)}`,
          success: false
        };
      }

      // Expand glob patterns and collect all files to search
      const filesToSearch: string[] = [];

      for (const pathPattern of pathsArray) {
        try {
          // Check if it's a glob pattern or direct file path
          if (pathPattern.includes('*') || pathPattern.includes('?') || pathPattern.includes('[')) {
            // It's a glob pattern
            const globOptions = {
              cwd: this.cwd,
              nodir: true, // Only return files, not directories
              ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.next/**'], // Common ignore patterns
            };

            const matchedFiles = await glob(pathPattern, globOptions);
            filesToSearch.push(...matchedFiles);
          } else {
            // It's a direct file path
            filesToSearch.push(pathPattern);
          }
        } catch (globError) {
          results.push({
            path: pathPattern,
            error: `Glob pattern error: ${globError instanceof Error ? globError.message : String(globError)}`,
            matches: []
          });
        }
      }

      // Remove duplicates
      const uniqueFiles = Array.from(new Set(filesToSearch));

      // Process each file
      for (const filePath of uniqueFiles) {
        try {
          const absolutePath = path.resolve(this.cwd, filePath);

          // Check if file exists and is readable
          const stats = await fsp.stat(absolutePath);
          if (!stats.isFile()) {
            continue; // Skip directories
          }

          // Read file content
          const content = await fsp.readFile(absolutePath, 'utf-8');

          // Track that this file has been read in this agent session
          if (!this.readFilesByAgent.has(agentId)) {
            this.readFilesByAgent.set(agentId, new Set());
          }
          this.readFilesByAgent.get(agentId)!.add(path.normalize(filePath));

          const lines = content.split('\n');

          const matches: any[] = [];

          // Search through each line
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Reset regex lastIndex for global regex
            regex.lastIndex = 0;
            const lineMatches = Array.from(line.matchAll(regex));

            if (lineMatches.length > 0) {
              const matchData: any = {
                line: i + 1,
                content: line.length > 200 ? line.substring(0, 200) + '...' : line, // Truncate very long lines
                matches: lineMatches.map(match => ({
                  text: match[0],
                  start: match.index,
                  end: match.index! + match[0].length
                }))
              };

              // Add context lines if requested
              if (contextLines > 0) {
                const contextStart = Math.max(0, i - contextLines);
                const contextEnd = Math.min(lines.length - 1, i + contextLines);

                matchData.context = {
                  before: lines.slice(contextStart, i).map((line, idx) => ({
                    line: contextStart + idx + 1,
                    content: line.length > 200 ? line.substring(0, 200) + '...' : line
                  })),
                  after: lines.slice(i + 1, contextEnd + 1).map((line, idx) => ({
                    line: i + idx + 2,
                    content: line.length > 200 ? line.substring(0, 200) + '...' : line
                  }))
                };
              }

              matches.push(matchData);
            }
          }

          if (matches.length > 0) {
            results.push({
              path: filePath,
              matches,
              totalMatches: matches.reduce((sum, match) => sum + match.matches.length, 0)
            });
          }
        } catch (fileError) {
          results.push({
            path: filePath,
            error: fileError instanceof Error ? fileError.message : String(fileError),
            matches: []
          });
        }
      }

      return {
        pattern,
        results: results.sort((a, b) => {
          // Sort by total matches (descending), then by path
          const matchDiff = (b.totalMatches || 0) - (a.totalMatches || 0);
          return matchDiff !== 0 ? matchDiff : a.path.localeCompare(b.path);
        }),
        totalFiles: uniqueFiles.length,
        filesWithMatches: results.filter(r => !r.error && r.matches && r.matches.length > 0).length,
        totalMatches: results.reduce((sum, result) => sum + (result.totalMatches || 0), 0),
        success: true
      };
    } catch (error) {
      return {
        pattern,
        error: error instanceof Error ? error.message : String(error),
        success: false
      };
    }
  }

  private async searchFile(
    agentId: string,
    filePath: string,
    startLine?: number,
    endLine?: number,
    pattern?: string,
    ignoreCase: boolean = false,
    includeLineNumbers: boolean = true
  ): Promise<any> {
    try {
      const absolutePath = path.resolve(this.cwd, filePath);

      // Check if file exists and is readable
      let stats;
      try {
        stats = await fsp.stat(absolutePath);
        if (!stats.isFile()) {
          return {
            path: filePath,
            error: 'Path is not a file',
            success: false
          };
        }
      } catch (statError) {
        return {
          path: filePath,
          error: statError instanceof Error ? statError.message : String(statError),
          success: false
        };
      }

      // Read file content
      const content = await fsp.readFile(absolutePath, 'utf-8');

      // Track that this file has been read in this agent session
      if (!this.readFilesByAgent.has(agentId)) {
        this.readFilesByAgent.set(agentId, new Set());
      }
      this.readFilesByAgent.get(agentId)!.add(path.normalize(filePath));

      const lines = content.split('\n');
      const totalLines = lines.length;

      let extractStartLine: number;
      let extractEndLine: number;
      let extractionMethod: 'lineRange' | 'pattern';

      // Determine extraction method and range
      if (startLine !== undefined || endLine !== undefined) {
        // Line range mode
        extractionMethod = 'lineRange';
        extractStartLine = Math.max(1, startLine || 1);
        extractEndLine = Math.min(totalLines, endLine || totalLines);

        if (extractStartLine > extractEndLine) {
          return {
            path: filePath,
            error: 'Start line must be less than or equal to end line',
            success: false
          };
        }
      } else if (pattern) {
        // Pattern matching mode
        extractionMethod = 'pattern';

        const flags = ignoreCase ? 'gi' : 'g';
        let regex: RegExp;

        try {
          regex = new RegExp(pattern, flags);
        } catch (regexError) {
          return {
            path: filePath,
            error: `Invalid regex pattern: ${regexError instanceof Error ? regexError.message : String(regexError)}`,
            success: false
          };
        }

        let firstMatchLine: number | null = null;
        let lastMatchLine: number | null = null;

        // Find first and last match
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          regex.lastIndex = 0;

          if (regex.test(line)) {
            if (firstMatchLine === null) {
              firstMatchLine = i + 1;
            }
            lastMatchLine = i + 1;
          }
        }

        if (firstMatchLine === null) {
          return {
            path: filePath,
            pattern,
            matches: [],
            content: '',
            totalLines,
            extractionMethod,
            message: 'No matches found for pattern',
            success: true
          };
        }

        extractStartLine = firstMatchLine;
        extractEndLine = lastMatchLine!;
      } else {
        // Neither line range nor pattern specified - read entire file
        extractionMethod = 'lineRange';
        extractStartLine = 1;
        extractEndLine = totalLines;
      }

      // Extract the specified lines
      const extractedLines = lines.slice(extractStartLine - 1, extractEndLine);

      let formattedContent: string;
      if (includeLineNumbers) {
        formattedContent = extractedLines
          .map((line, index) => {
            const lineNum = extractStartLine + index;
            return `${lineNum.toString().padStart(4, ' ')}→${line}`;
          })
          .join('\n');
      } else {
        formattedContent = extractedLines.join('\n');
      }

      // If pattern was used, also provide match information
      let matchInfo: any = undefined;
      if (pattern && extractionMethod === 'pattern') {
        const flags = ignoreCase ? 'gi' : 'g';
        const regex = new RegExp(pattern, flags);
        const matches: any[] = [];

        for (let i = extractStartLine - 1; i < extractEndLine; i++) {
          const line = lines[i];
          regex.lastIndex = 0;
          const lineMatches = Array.from(line.matchAll(regex));

          if (lineMatches.length > 0) {
            matches.push({
              line: i + 1,
              content: line,
              matches: lineMatches.map(match => ({
                text: match[0],
                start: match.index,
                end: match.index! + match[0].length
              }))
            });
          }
        }

        matchInfo = {
          pattern,
          totalMatches: matches.reduce((sum, match) => sum + match.matches.length, 0),
          matchingLines: matches.length,
          matches
        };
      }

      return {
        path: filePath,
        content: formattedContent,
        startLine: extractStartLine,
        endLine: extractEndLine,
        linesExtracted: extractEndLine - extractStartLine + 1,
        totalLines,
        extractionMethod,
        matchInfo,
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

      // Use executeRepositoryCommandV2 for type checking
      const results = await executeRepositoryCommandV2(
        resolvedRepoPath,
        resolvedRepoPath,
        "check",
        target,
        []
      );

      // Process results to extract output
      for (const result of results) {
        if (result.stdout) {
          output += result.stdout + "\n";
        }
        if (result.stderr) {
          output += result.stderr + "\n";
        }
        if (result.exitCode !== 0) {
          hasError = true;
        }
      }

      return {
        success: !hasError,
        output: output.trim() || "No output captured",
        target: target || "default",
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

  private async addMultiplePackages(
    packageNames: string[],
    target?: string,
    isDev?: boolean,
    useWorkspace?: boolean,
    additionalFlags?: string[],
    repoPath?: string
  ): Promise<any> {
    const resolvedRepoPath = repoPath ? path.resolve(this.cwd, repoPath) : this.cwd;
    let output = "";
    let hasError = false;

    try {
      // Prepare additional arguments for V2 command with all packages
      const actionArgs = [...packageNames];
      if (isDev) actionArgs.push("--dev");
      if (additionalFlags) actionArgs.push(...additionalFlags);

      // Use executeRepositoryCommandV2 for package addition
      const results = await executeRepositoryCommandV2(
        resolvedRepoPath,
        resolvedRepoPath,
        "add-package",
        target,
        actionArgs
      );

      // Process results to extract output
      for (const result of results) {
        if (result.stdout) {
          output += result.stdout + "\n";
        }
        if (result.stderr) {
          output += result.stderr + "\n";
        }
        if (result.exitCode !== 0) {
          hasError = true;
        }
      }

      return {
        success: !hasError,
        output: output.trim() || "No output captured",
        target: target || "default",
        packageNames,
        isDev,
        useWorkspace,
        additionalFlags,
        repoPath: resolvedRepoPath,
        message: hasError ? `Failed to add packages ${packageNames.join(', ')}` : `Packages ${packageNames.join(', ')} added successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        output: output.trim(),
        target: target || "default",
        packageNames,
        isDev,
        useWorkspace,
        additionalFlags,
        repoPath: repoPath || this.cwd,
      };
    }
  }

  private async addPackage(
    packageName: string,
    target?: string,
    isDev?: boolean,
    useWorkspace?: boolean,
    additionalFlags?: string[],
    repoPath?: string
  ): Promise<any> {
    const resolvedRepoPath = repoPath ? path.resolve(this.cwd, repoPath) : this.cwd;
    let output = "";
    let hasError = false;

    try {
      // Prepare additional arguments for V2 command
      const actionArgs = [packageName];
      if (isDev) actionArgs.push("--dev");
      if (additionalFlags) actionArgs.push(...additionalFlags);

      // Use executeRepositoryCommandV2 for package addition
      const results = await executeRepositoryCommandV2(
        resolvedRepoPath,
        resolvedRepoPath,
        "add-package",
        target,
        actionArgs
      );

      // Process results to extract output
      for (const result of results) {
        if (result.stdout) {
          output += result.stdout + "\n";
        }
        if (result.stderr) {
          output += result.stderr + "\n";
        }
        if (result.exitCode !== 0) {
          hasError = true;
        }
      }

      return {
        success: !hasError,
        output: output.trim() || "No output captured",
        target: target || "default",
        packageName,
        isDev,
        useWorkspace,
        additionalFlags,
        repoPath: resolvedRepoPath,
        message: hasError ? `Failed to add package ${packageName}` : `Package ${packageName} added successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        output: output.trim(),
        target: target || "default",
        packageName,
        isDev,
        useWorkspace,
        additionalFlags,
        repoPath: repoPath || this.cwd,
      };
    }
  }

  private todoRead(): TodoResult {
    return {
      todos: this.todos,
      success: true
    };
  }

  private todoWrite(todos: TodoItem[]): TodoResult {
    this.todos = todos;
    return {
      todos: this.todos,
      success: true
    };
  }
}
