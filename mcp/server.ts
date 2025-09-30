#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { NewAgent } from "../install-agent/new-agent.js";
import { detectRepo } from "../install-agent/repository-detector.js";
import { ProgressServer } from "../cli/progress-server.js";
import fs from 'fs';
import os from 'os';
import path from 'path';
import { analyzeRepositoryV2 } from "../install-agent/repodetect/index.js";

// Global progress server instance
let progressServer: ProgressServer | null = null;
let portFilePath: string | null = null;

// Call the events API for installation to get structured responses
async function callEventsAPI(packageName: string, installationId: string): Promise<any> {
  // Create an agent run in the database first
  const agentId = `mcp-${installationId}`;

  // Use the same pattern as the web interface - create agent run then call events
  const response = await fetch(`http://localhost:3000/api/agent/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: agentId,
      operation: 'install',
      params: { package: packageName },
      cwd: process.cwd()
    })
  });

  if (!response.ok) {
    throw new Error(`Events API call failed: ${response.statusText}`);
  }

  return await response.json();
}

// Track individual installations
interface InstallationProgress {
  id: string;
  packageName: string;
  stepCounter: number;
  status: 'ready' | 'installing' | 'completed' | 'error';
  startedAt: number;
  completedAt?: number;
  errorAt?: number;
  error?: string;
}

let activeInstallations: Map<string, InstallationProgress> = new Map();

// Helper function to generate unique installation ID
function generateInstallationId(): string {
  return `install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to update metadata in port file
function updatePortFileMetadata(updates: any) {
  if (!portFilePath) return;

  try {
    const currentData = JSON.parse(fs.readFileSync(portFilePath, 'utf8'));
    const updatedData = { ...currentData, ...updates };
    fs.writeFileSync(portFilePath, JSON.stringify(updatedData, null, 2));
  } catch (error) {
    console.error('Failed to update port file metadata:', error);
  }
}

// Helper function to update installation info in metadata
function updateInstallationInMetadata(installationId: string, installationUpdates: any) {
  if (!portFilePath) return;

  try {
    const currentData = JSON.parse(fs.readFileSync(portFilePath, 'utf8'));

    if (!currentData.installations) {
      currentData.installations = {};
    }

    if (!currentData.installations[installationId]) {
      currentData.installations[installationId] = {};
    }

    currentData.installations[installationId] = {
      ...currentData.installations[installationId],
      ...installationUpdates
    };

    fs.writeFileSync(portFilePath, JSON.stringify(currentData, null, 2));
  } catch (error) {
    console.error('Failed to update installation metadata:', error);
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
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
    ],
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
        // Find the currently active installation for this agent call
        // For now, we'll use the most recent installation as there's no direct way to tie agent steps to specific installations
        const currentInstallation = Array.from(activeInstallations.values())
          .filter(install => install.status === 'installing')
          .sort((a, b) => b.startedAt - a.startedAt)[0];

        if (currentInstallation && progressServer) {
          currentInstallation.stepCounter++;
          const isComplete = finishReason === "stop" || finishReason === "length";
          const maxSteps = 15; // More realistic estimate for installation steps

          console.error(`Progress update for ${currentInstallation.id}: step ${currentInstallation.stepCounter}, text: ${text}, finishReason: ${finishReason}`);

          const progressData = {
            installationId: currentInstallation.id,
            text: text || "Processing...",
            toolCalls: toolCalls || [],
            toolResults: toolResults || [],
            finishReason: isComplete ? "stop" : undefined,
            usage: usage || {},
            stage: isComplete ? "completed" : (stage || "thinking"),
            description: isComplete ? "Package installed successfully" : (description || "Processing your request"),
            isComplete,
            // Legacy fields for backwards compatibility
            step: currentInstallation.stepCounter,
            maxSteps,
            progress: isComplete ? 100 : Math.min(10 + (currentInstallation.stepCounter * 8), 99)
          };

          progressServer.updateProgress(progressData);

          // Update installation metadata with progress
          updateInstallationInMetadata(currentInstallation.id, {
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

        // Create a new installation with unique ID
        const installationId = generateInstallationId();
        const installationProgress: InstallationProgress = {
          id: installationId,
          packageName,
          stepCounter: 0,
          status: 'installing',
          startedAt: Date.now()
        };

        activeInstallations.set(installationId, installationProgress);
        console.error(`Starting installation of ${packageName} with ID ${installationId}, progress server active: ${!!progressServer}`);

        // Update metadata to include this installation
        updateInstallationInMetadata(installationId, {
          id: installationId,
          packageName,
          status: 'installing',
          startedAt: Date.now()
        });

        try {
          // Install the package using the existing agent with structured progress updates
          const result = await agent.installPackage(packageName);

          const installation = activeInstallations.get(installationId);
          if (installation) {
            installation.status = 'completed';
            installation.completedAt = Date.now();

            // Ensure completion is reported to progress server
            if (progressServer) {
              console.error(`Explicit completion update for ${installationId}: ${packageName}`);
              progressServer.updateProgress({
                installationId: installationId,
                text: `Installation of ${packageName} completed successfully!`,
                toolCalls: [],
                toolResults: [],
                finishReason: "stop",
                usage: {},
                stage: "completed",
                description: "Package installed successfully",
                isComplete: true,
                // Legacy fields for backwards compatibility
                step: installation.stepCounter || 1,
                maxSteps: 15,
                progress: 100
              });
            }

            // Update metadata to indicate completion
            updateInstallationInMetadata(installationId, {
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
          const installation = activeInstallations.get(installationId);
          if (installation) {
            installation.status = 'error';
            installation.errorAt = Date.now();
            installation.error = error instanceof Error ? error.message : String(error);

            // Report error through progress server
            if (progressServer) {
              progressServer.updateProgress({
                installationId: installationId,
                text: `Installation failed: ${installation.error}`,
                toolCalls: [],
                toolResults: [],
                finishReason: "stop",
                usage: {},
                stage: "completed",
                description: `Installation failed: ${installation.error}`,
                isComplete: true,
                error: installation.error,
                // Legacy fields for backwards compatibility  
                step: installation.stepCounter,
                maxSteps: 15,
                progress: 0
              });
            }

            // Update metadata to indicate error
            updateInstallationInMetadata(installationId, {
              status: 'error',
              error: installation.error,
              errorAt: Date.now()
            });
          }

          throw error;
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
  // Start the progress server with dynamic port allocation
  progressServer = new ProgressServer(0); // Use 0 for dynamic port
  let progressPort: number;
  try {
    progressPort = await progressServer.start();
    console.error(`Progress server started on http://localhost:${progressPort}`);

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
    console.error(`Progress metadata written to: ${portFile}`);

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
    console.error("Failed to start progress server:", error);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SourceWizard MCP server running on stdio");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
