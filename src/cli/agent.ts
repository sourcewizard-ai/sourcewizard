import { detectRepo } from "../shared/install-agent/repository-detector.js";
import { AIAgent } from "../shared/install-agent/ai-agent.js";

export async function search(query: string, path: string) {
  const repo = await detectRepo(path);

  // Create and configure the AI agent
  const agent = new AIAgent({
    cwd: path,
    projectContext: repo,
    serverUrl: "http://localhost:3000",
    apiKey: "1234567890",
  });

  const result = await agent.searchPackages(query);
  console.log("Search result:", result);

  return result;
}

export async function install(
  name: string,
  path: string,
  onStepFinish: (step: any) => void
) {
  const repo = await detectRepo(path);

  // Create and configure the AI agent
  const agent = new AIAgent({
    cwd: path,
    projectContext: repo,
    serverUrl: "http://localhost:3000",
    apiKey: "1234567890",
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

  // determine repo language, framework
  // get config and installation prompt
  // get relevant files ✓ (now implemented)
  // install packages
  // run llm with relevant files to make changes
}
