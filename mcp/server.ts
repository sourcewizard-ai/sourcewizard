#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  SetLevelRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { NewAgent } from "../install-agent/new-agent.js";
import { ProgressServer } from "../cli/progress-server.js";
import fs from 'fs';
import os from 'os';
import path from 'path';
import { analyzeRepositoryV2, executeRepositoryCommandV2 } from "../repodetect/index.js";

// Setup file logging since Cursor doesn't support MCP logging protocol
const logDir = path.join(os.homedir(), '.config', 'sourcewizard', 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, `mcp-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(level: string, message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `${timestamp} [${level}] ${message}\n`;
  logStream.write(logLine);
}

// Global progress server instance
let progressServer: ProgressServer | null = null;
let portFilePath: string | null = null;

// Helper function to find git repository root
function findGitRepoRoot(startPath: string): string {
  let currentPath = path.resolve(startPath);
  const root = path.parse(currentPath).root;

  while (currentPath !== root) {
    const gitPath = path.join(currentPath, '.git');
    if (fs.existsSync(gitPath)) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  // If no .git found, return the starting path
  return path.resolve(startPath);
}


// Track individual installations and reuse operations
interface OperationProgress {
  id: string;
  type: 'install' | 'reuse';
  packageName?: string;
  task?: string;
  stepCounter: number;
  status: 'ready' | 'processing' | 'completed' | 'error';
  startedAt: number;
  completedAt?: number;
  errorAt?: number;
  error?: string;
}

let activeOperations: Map<string, OperationProgress> = new Map();

// Helper function to generate unique operation ID
function generateOperationId(type: 'install' | 'reuse'): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to update metadata in port file
function updatePortFileMetadata(updates: any) {
  if (!portFilePath) return;

  try {
    const currentData = JSON.parse(fs.readFileSync(portFilePath, 'utf8'));
    const updatedData = { ...currentData, ...updates };
    fs.writeFileSync(portFilePath, JSON.stringify(updatedData, null, 2));
  } catch (error) {
    log('error', `Failed to update port file metadata: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to update operation info in metadata
function updateOperationInMetadata(operationId: string, operationUpdates: any) {
  if (!portFilePath) return;

  try {
    const currentData = JSON.parse(fs.readFileSync(portFilePath, 'utf8'));

    if (!currentData.installations) {
      currentData.installations = {};
    }

    if (!currentData.installations[operationId]) {
      currentData.installations[operationId] = {};
    }

    currentData.installations[operationId] = {
      ...currentData.installations[operationId],
      ...operationUpdates
    };

    fs.writeFileSync(portFilePath, JSON.stringify(currentData, null, 2));
  } catch (error) {
    log('error', `Failed to update operation metadata: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const server = new Server(
  {
    name: "sourcewizard",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

// Handle logging level requests
server.setRequestHandler(SetLevelRequestSchema, async (request) => {
  const { level } = request.params;
  // Just acknowledge - the SDK handles this internally
  return {};
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const isDevelopment = process.env.NODE_ENV === "development";

  const tools: any[] = [
    {
      name: "search_packages",
      description:
        "Search for packages and code snippets using AI-powered analysis",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for packages or code snippets",
          },
          cwd: {
            type: "string",
            description:
              "Current working directory path (optional, defaults to process.cwd())",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "install_package",
      description: "Install and configure a package with AI-guided setup. IMPORTANT: Always call search_packages first to clarify the exact package name before installation. This ensures you're installing the correct package and helps avoid typos or ambiguity in package names.",
      inputSchema: {
        type: "object",
        properties: {
          packageName: {
            type: "string",
            description: "Name of the package to install (should be verified using search_packages first)",
          },
          cwd: {
            type: "string",
            description:
              "Current working directory path (optional, defaults to process.cwd())",
          },
        },
        required: ["packageName"],
      },
    },
  ];

  // Add development-only tools
  if (isDevelopment) {
    tools.push(
      {
        name: "list_targets",
        description: "List all available targets in the repository with their metadata including language, framework, and package manager information.",
        inputSchema: {
          type: "object",
          properties: {
            cwd: {
              type: "string",
              description:
                "Current working directory path (optional, defaults to process.cwd())",
            },
          },
          required: [],
        },
      },
      {
        name: "reuse_code",
        description: "Suggest reuse of existing code from the codebase or existing external libraries. This is a long-running operation that returns immediately with an operationId. Call again with the operationId parameter to check status and retrieve results.",
        inputSchema: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description: "Description of the functionality, feature, or problem to solve. Required when starting a new analysis (without operationId).",
            },
            history: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Past 20 user queries to provide context for the analysis. Optional.",
            },
            operationId: {
              type: "string",
              description: "Operation ID to check status of an existing analysis. When provided, returns the current status and results if completed.",
            },
            cwd: {
              type: "string",
              description:
                "Current working directory path (optional, defaults to process.cwd())",
            },
          },
          required: [],
        },
      },
      {
        name: "check_code",
        description: "Run type checking and linting on a target in the repository. Detects the target automatically based on the current working directory. Use list_targets first to see available targets.",
        inputSchema: {
          type: "object",
          properties: {
            target: {
              type: "string",
              description: "Target to check in format '//path:name' (e.g., '//sw-portal:sw-portal'). Use list_targets to discover available targets. If not provided, will detect from current directory.",
            },
            cwd: {
              type: "string",
              description:
                "Current working directory path (optional, defaults to process.cwd())",
            },
          },
          required: [],
        },
      }
    );
  }

  return {
    tools,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const cwd = args.cwd || process.cwd();
    const projectContext = await analyzeRepositoryV2(cwd as string);

    // Get API key or JWT from environment variables
    const apiKey = process.env.SOURCEWIZARD_API_KEY;

    if (!apiKey) {
      throw new Error("Authentication required. Please set SOURCEWIZARD_API_KEY environment variable or login with 'sourcewizard login'");
    }

    const agent = new NewAgent({
      cwd: cwd as string,
      projectContext,
      serverUrl: process.env.SOURCEWIZARD_SERVER_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://sourcewizard.ai"),
      apiKey,
      onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage, stage, description }) => {
        // Log the step at the start
        log('info', `Agent step: text="${text}", stage="${stage}", finishReason="${finishReason}"`);

        // Find the currently active operation for this agent call
        // For now, we'll use the most recent operation as there's no direct way to tie agent steps to specific operations
        const currentOperation = Array.from(activeOperations.values())
          .filter(op => op.status === 'processing')
          .sort((a, b) => b.startedAt - a.startedAt)[0];

        if (currentOperation && progressServer) {
          currentOperation.stepCounter++;
          const isComplete = finishReason === "stop" || finishReason === "length";
          const maxSteps = currentOperation.type === 'install' ? 15 : 10; // Different estimates for different operations

          // Log progress update
          log('info', `Progress update for ${currentOperation.id}: step ${currentOperation.stepCounter}, text: ${text}, finishReason: ${finishReason}`);

          const progressData = {
            operationId: currentOperation.id,
            installationId: currentOperation.id, // Keep for backwards compatibility
            text: text || "Processing...",
            toolCalls: toolCalls || [],
            toolResults: toolResults || [],
            finishReason: isComplete ? "stop" : undefined,
            usage: usage || {},
            stage: isComplete ? "completed" : (stage || "thinking"),
            description: isComplete ?
              (currentOperation.type === 'install' ? "Package installed successfully" : "Code reuse analysis completed") :
              (description || "Processing your request"),
            isComplete,
            // Legacy fields for backwards compatibility
            step: currentOperation.stepCounter,
            maxSteps,
            progress: isComplete ? 100 : Math.min(10 + (currentOperation.stepCounter * 8), 99)
          };

          progressServer.updateProgress(progressData);

          // Update operation metadata with progress
          updateOperationInMetadata(currentOperation.id, {
            progress: progressData
          });
        }
      },
    });

    switch (name) {
      case "search_packages": {
        const query = args.query;
        if (typeof query !== "string") {
          throw new Error("Query must be a string");
        }

        const result = await agent.searchPackages(query);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  result: {
                    text: result.text,
                    toolCalls: result.toolCalls,
                    toolResults: result.toolResults,
                    finishReason: result.finishReason,
                    usage: result.usage,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "install_package": {
        const packageName = args.packageName;
        if (typeof packageName !== "string") {
          throw new Error("Package name must be a string");
        }

        // Create a new operation with unique ID
        const operationId = generateOperationId('install');
        const operationProgress: OperationProgress = {
          id: operationId,
          type: 'install',
          packageName,
          stepCounter: 0,
          status: 'processing',
          startedAt: Date.now()
        };

        activeOperations.set(operationId, operationProgress);
        log('info', `Starting installation of ${packageName} with ID ${operationId}, progress server active: ${!!progressServer}`);

        // Update metadata to include this installation
        updateOperationInMetadata(operationId, {
          id: operationId,
          packageName,
          status: 'installing',
          startedAt: Date.now()
        });

        try {
          // Install the package using the existing agent with structured progress updates
          const result = await agent.installPackage(packageName);

          const operation = activeOperations.get(operationId);
          if (operation) {
            operation.status = 'completed';
            operation.completedAt = Date.now();

            // Ensure completion is reported to progress server
            if (progressServer) {
              log('info', `Explicit completion update for ${operationId}: ${packageName}`);
              progressServer.updateProgress({
                operationId: operationId,
                installationId: operationId, // Keep for backwards compatibility
                text: `Installation of ${packageName} completed successfully!`,
                toolCalls: [],
                toolResults: [],
                finishReason: "stop",
                usage: {},
                stage: "completed",
                description: "Package installed successfully",
                isComplete: true,
                // Legacy fields for backwards compatibility
                step: operation.stepCounter || 1,
                maxSteps: 15,
                progress: 100
              });
            }

            // Update metadata to indicate completion
            updateOperationInMetadata(operationId, {
              status: 'completed',
              completedAt: Date.now()
            });
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    result: {
                      text: result.text,
                      toolCalls: result.toolCalls,
                      toolResults: result.toolResults,
                      finishReason: result.finishReason,
                      usage: result.usage,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          const operation = activeOperations.get(operationId);
          if (operation) {
            operation.status = 'error';
            operation.errorAt = Date.now();
            operation.error = error instanceof Error ? error.message : String(error);

            // Report error through progress server
            if (progressServer) {
              progressServer.updateProgress({
                operationId: operationId,
                installationId: operationId, // Keep for backwards compatibility
                text: `Installation failed: ${operation.error}`,
                toolCalls: [],
                toolResults: [],
                finishReason: "stop",
                usage: {},
                stage: "completed",
                description: `Installation failed: ${operation.error}`,
                isComplete: true,
                error: operation.error,
                // Legacy fields for backwards compatibility
                step: operation.stepCounter,
                maxSteps: 15,
                progress: 0
              });
            }

            // Update metadata to indicate error
            updateOperationInMetadata(operationId, {
              status: 'error',
              error: operation.error,
              errorAt: Date.now()
            });
          }

          throw error;
        }
      }

      case "reuse_code": {
        const task = args.task as string | undefined;
        const history = args.history as string[] | undefined;
        const checkOperationId = args.operationId as string | undefined;

        // If operationId is provided, check status
        if (checkOperationId) {
          const operation = activeOperations.get(checkOperationId);
          if (!operation) {
            // Also check metadata file in case server restarted
            if (portFilePath) {
              try {
                const metadata = JSON.parse(fs.readFileSync(portFilePath, 'utf8'));
                const persistedOperation = metadata.operations?.[checkOperationId];
                if (persistedOperation) {
                  return {
                    content: [
                      {
                        type: "text",
                        text: JSON.stringify(
                          {
                            success: true,
                            operationId: checkOperationId,
                            found: true,
                            ...persistedOperation,
                          },
                          null,
                          2
                        ),
                      },
                    ],
                  };
                }
              } catch (error) {
                // Ignore read errors, fall through to not found
              }
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      operationId: checkOperationId,
                      found: false,
                      message: "Operation not found. It may have been completed and cleaned up.",
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          // Build response based on operation status
          const response: any = {
            success: true,
            operationId: operation.id,
            found: true,
            type: operation.type,
            status: operation.status,
            task: operation.task,
            startedAt: operation.startedAt,
          };

          if (operation.status === 'completed') {
            response.completedAt = operation.completedAt;
            response.duration = operation.completedAt ? operation.completedAt - operation.startedAt : undefined;

            // Get result from metadata if available
            if (portFilePath) {
              try {
                const metadata = JSON.parse(fs.readFileSync(portFilePath, 'utf8'));
                const persistedOperation = metadata.operations?.[checkOperationId];
                if (persistedOperation?.result) {
                  response.result = persistedOperation.result;
                }
              } catch (error) {
                // Ignore read errors
              }
            }
          } else if (operation.status === 'error') {
            response.error = operation.error;
            response.errorAt = operation.errorAt;
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        }

        // Start new analysis
        if (!task || typeof task !== "string") {
          throw new Error("Task must be a string when starting a new analysis");
        }

        // Create a new operation with unique ID
        const operationId = generateOperationId('reuse');
        const operationProgress: OperationProgress = {
          id: operationId,
          type: 'reuse',
          task,
          stepCounter: 0,
          status: 'processing',
          startedAt: Date.now()
        };

        activeOperations.set(operationId, operationProgress);
        log('info', `Starting code reuse analysis for task "${task}" with ID ${operationId}, progress server active: ${!!progressServer}`);

        // Update metadata to include this operation
        updateOperationInMetadata(operationId, {
          id: operationId,
          type: 'reuse',
          task,
          status: 'processing',
          startedAt: Date.now()
        });

        // Return immediately with operation ID so the client doesn't block
        const immediateResponse = {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  operationId,
                  status: 'processing',
                  message: 'Code reuse analysis started. Progress updates will be sent via the progress server.',
                },
                null,
                2
              ),
            },
          ],
        };

        // Process in background
        (async () => {
          try {
            const result = await agent.checkCodeReusability(task, history);

            const operation = activeOperations.get(operationId);
            if (operation) {
              operation.status = 'completed';
              operation.completedAt = Date.now();

              // Ensure completion is reported to progress server
              if (progressServer) {
                log('info', `Explicit completion update for ${operationId}: code reuse analysis`);
                progressServer.updateProgress({
                  operationId: operationId,
                  installationId: operationId, // Keep for backwards compatibility
                  text: result.text || 'Code reuse analysis completed successfully!',
                  toolCalls: result.toolCalls || [],
                  toolResults: result.toolResults || [],
                  finishReason: "stop",
                  usage: result.usage || {},
                  stage: "completed",
                  description: "Code reuse analysis completed",
                  isComplete: true,
                  result: {
                    text: result.text,
                    toolCalls: result.toolCalls,
                    toolResults: result.toolResults,
                    finishReason: result.finishReason,
                    usage: result.usage,
                  },
                  // Legacy fields for backwards compatibility
                  step: operation.stepCounter || 1,
                  maxSteps: 10,
                  progress: 100
                });
              }

              // Update metadata to indicate completion
              updateOperationInMetadata(operationId, {
                status: 'completed',
                completedAt: Date.now(),
                result: {
                  text: result.text,
                  toolCalls: result.toolCalls,
                  toolResults: result.toolResults,
                  finishReason: result.finishReason,
                  usage: result.usage,
                }
              });
            }
          } catch (error) {
            const operation = activeOperations.get(operationId);
            if (operation) {
              operation.status = 'error';
              operation.errorAt = Date.now();
              operation.error = error instanceof Error ? error.message : String(error);

              // Report error through progress server
              if (progressServer) {
                progressServer.updateProgress({
                  operationId: operationId,
                  installationId: operationId, // Keep for backwards compatibility
                  text: `Code reuse analysis failed: ${operation.error}`,
                  toolCalls: [],
                  toolResults: [],
                  finishReason: "stop",
                  usage: {},
                  stage: "completed",
                  description: `Analysis failed: ${operation.error}`,
                  isComplete: true,
                  error: operation.error,
                  // Legacy fields for backwards compatibility
                  step: operation.stepCounter,
                  maxSteps: 10,
                  progress: 0
                });
              }

              // Update metadata to indicate error
              updateOperationInMetadata(operationId, {
                status: 'error',
                error: operation.error,
                errorAt: Date.now()
              });
            }

            log('error', `Error in background code reuse analysis ${operationId}: ${error instanceof Error ? error.message : String(error)}`);
          }
        })();

        // Return immediately without waiting
        return immediateResponse;
      }

      case "check_code": {
        const target = args.target as string | undefined;
        const cwd = args.cwd as string || process.cwd();

        // Find git repo root
        const workingDir = findGitRepoRoot(cwd);

        try {
          // Execute check command
          await executeRepositoryCommandV2(workingDir, cwd, "check", target, []);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    message: "Type checking completed successfully",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: errorMessage,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }

      case "list_targets": {
        const cwd = args.cwd as string || process.cwd();

        // Find git repo root
        const workingDir = findGitRepoRoot(cwd);

        try {
          // Analyze repository to get all targets
          const repoAnalysis = await analyzeRepositoryV2(workingDir);

          // Format targets for output
          const targetsList = Object.entries(repoAnalysis.targets || {}).map(([targetId, targetInfo]) => ({
            id: targetId,
            name: targetInfo.name,
            path: targetInfo.path,
            language: targetInfo.language,
            framework: targetInfo.framework,
            packageManager: targetInfo.package_manager,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    projectName: repoAnalysis.name,
                    totalTargets: targetsList.length,
                    targets: targetsList,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    error: errorMessage,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: errorMessage,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
export async function main() {
  // Redefine console.log and console.error to prevent accidental logging to stdout/stderr
  // which would break the stdio protocol
  console.log = (...args: any[]) => {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    log('info', message);
  };

  console.error = (...args: any[]) => {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    log('error', message);
  };

  // Connect to transport FIRST before sending any notifications
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup
  log('info', 'SourceWizard MCP server connected');
  log('info', 'Log file: ' + logFile);

  // Now start the progress server with dynamic port allocation
  progressServer = new ProgressServer(0); // Use 0 for dynamic port
  let progressPort: number;
  try {
    progressPort = await progressServer.start();
    log('info', `Progress server started on http://localhost:${progressPort}`);

    // Write the port and metadata to a temp file so CLI can discover it
    const portFile = path.join(os.tmpdir(), `sourcewizard-progress-${process.pid}.port`);

    const metadata = {
      port: progressPort,
      pid: process.pid,
      startTime: Date.now(),
      cwd: process.cwd(),
      installations: {}
    };

    fs.writeFileSync(portFile, JSON.stringify(metadata, null, 2));
    portFilePath = portFile;
    log('info', `Progress metadata written to: ${portFile}`);

    // Clean up port file on exit
    process.on('exit', () => {
      try {
        fs.unlinkSync(portFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    process.on('SIGINT', () => {
      try {
        fs.unlinkSync(portFile);
      } catch (e) {
        // Ignore cleanup errors
      }
      process.exit(0);
    });

  } catch (error) {
    log('error', `Failed to start progress server: ${error instanceof Error ? error.message : String(error)}`);
  }

  log('info', 'SourceWizard MCP server running on stdio');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
