import { detectRepo } from "../shared/install-agent/repository-detector.js";
import { AIAgent } from "../shared/install-agent/ai-agent.js";
import { ProgressServer } from "./progress-server.js";

export async function search(query: string, path: string, jwt?: string) {
  const repo = await detectRepo(path);

  const agent = new AIAgent({
    cwd: path,
    projectContext: repo,
    serverUrl: "http://localhost:3000",
    jwt: jwt,
    apiKey: process.env.SOURCEWIZARD_API_KEY,
  });

  const result = await agent.searchPackages(query);
  console.log("Search result:", result);

  return result;
}

export async function install(
  name: string,
  path: string,
  onStepFinish: (step: any) => void,
  jwt?: string
) {
  const repo = await detectRepo(path);

  const agent = new AIAgent({
    cwd: path,
    projectContext: repo,
    serverUrl: "http://localhost:3000",
    jwt: jwt,
    apiKey: process.env.SOURCEWIZARD_API_KEY,
    onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
      onStepFinish({ text, toolCalls, toolResults, finishReason, usage });
      // console.log("Agent step:", {
      //   text,
      //   toolCalls,
      //   toolResults,
      //   finishReason,
      //   usage,
      // });
    },
  });

  try {
    // Execute the installation task with the AI agent
    const result = await agent.installPackage(name);
    console.log("Installation result:", result);

    return result;
  } catch (error) {
    console.error("Error during installation:", error);
    throw error;
  }
}

export async function watchMCPStatus(onStepFinish: (step: any) => void) {
  const progressPort = 38457; // Fixed port where MCP server runs progress server

  try {
    // Poll for progress updates
    let isComplete = false;
    let hasConnected = false;

    while (!isComplete) {
      try {
        const progressResponse = await fetch(
          `http://localhost:${progressPort}/progress`
        );

        if (!progressResponse.ok) {
          throw new Error(
            "MCP server not running or progress server not available"
          );
        }

        const progress = await progressResponse.json();

        if (!hasConnected) {
          hasConnected = true;
          console.log("Connected to MCP server status");
        }

        onStepFinish({
          text: progress.text,
          finishReason: progress.isComplete ? "stop" : undefined,
          toolCalls: [],
          toolResults: [],
          usage: {},
        });

        isComplete = progress.isComplete;

        if (progress.error) {
          console.log("Installation completed with error:", progress.error);
          isComplete = true;
        }

        if (!isComplete) {
          // Wait before next poll
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (fetchError) {
        if (
          fetchError instanceof Error &&
          fetchError.message.includes("fetch")
        ) {
          onStepFinish({
            text: "MCP server not running. Please start it with 'sourcewizard mcp' first.",
            finishReason: "stop",
            toolCalls: [],
            toolResults: [],
            usage: {},
          });
          throw new Error(
            "MCP server not running. Please start it with 'sourcewizard mcp' first."
          );
        }
        throw fetchError;
      }
    }

    console.log("Status monitoring completed");
    return { success: true };
  } catch (error) {
    console.error("Error monitoring MCP status:", error);
    throw error;
  }
}
