#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AIAgent } from "../shared/install-agent/ai-agent.js";
import { detectRepo } from "../shared/install-agent/repository-detector.js";
import { ProgressServer } from "../cli/progress-server.js";

// Global progress server instance
let progressServer: ProgressServer | null = null;
let currentStepCounter = 0;

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
    const projectContext = await detectRepo(cwd as string);

    // Get API key or JWT from environment variables
    const apiKey = process.env.SOURCEWIZARD_API_KEY;

    if (!apiKey) {
      throw new Error("SOURCEWIZARD_API_KEY environment variable is required");
    }

    const agent = new AIAgent({
      cwd: cwd as string,
      projectContext,
      serverUrl: process.env.SOURCEWIZARD_SERVER_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://sourcewizard.ai"),
      apiKey,
      onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
        // Report granular progress from AI agent steps
        if (progressServer) {
          currentStepCounter++;
          const isComplete =
            finishReason === "stop" || finishReason === "length";
          const maxSteps = 15; // More realistic estimate for installation steps

          console.error(`Progress update: step ${currentStepCounter}, text: ${text}, finishReason: ${finishReason}`);

          progressServer.updateProgress({
            step: currentStepCounter,
            maxSteps,
            progress: isComplete
              ? 100
              : Math.min((currentStepCounter / maxSteps) * 100, 95),
            text: text || "Processing...",
            isComplete,
          });

          // Don't reset counter here - let it be reset at the start of next installation
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

        // Reset progress counter for new installation
        currentStepCounter = 0;
        console.error(`Starting installation of ${packageName}, progress server active: ${!!progressServer}`);

        try {
          const result = await agent.installPackage(packageName);
          
          // Ensure completion is reported to progress server
          if (progressServer) {
            console.error(`Explicit completion update for ${packageName}`);
            progressServer.updateProgress({
              step: currentStepCounter || 1,
              maxSteps: 15,
              progress: 100,
              text: `Installation of ${packageName} completed successfully!`,
              isComplete: true,
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
          // Report error through progress server
          if (progressServer) {
            progressServer.updateProgress({
              step: currentStepCounter,
              maxSteps: 15,
              progress: 0,
              text: `Installation failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
              isComplete: true,
              error: error instanceof Error ? error.message : String(error),
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
  // Start the progress server
  progressServer = new ProgressServer(38457); // Use fixed port for easier connection
  try {
    await progressServer.start();
    console.error("Progress server started on http://localhost:38457");
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
