import { PackageConfig } from "@/registry/types/all.js";
import { detectRepo } from "../shared/repository-detector.js";
import { readConfig } from "@typeconf/sdk";
import { CoreMessage } from "ai";
import { AIAgent } from "../shared/ai-agent.js";
import { readRelevantFiles, logFileInfo } from "../shared/file-utils.js";

interface Task {
  name: string;
  prompt: string;
}

interface Agent {
  name: string;
  tasks: Task[];
}

function search() {
  // find intent via semantic search
}

export async function install(name: string) {
  const repo = await detectRepo();
  console.log(repo);

  // Get current working directory for file operations
  const cwd = process.cwd();

  const config: PackageConfig = await readConfig(
    "/home/ivan/root/data/dev/repowizard/registry" + "/clerk/pkg"
  );
  console.log(config.setup_prompt);

  // Read relevant files if pattern is defined
  if (config.relevant_files_pattern) {
    const relevantFiles = await readRelevantFiles(
      cwd,
      config.relevant_files_pattern
    );

    // Log file information with token counts
    logFileInfo(relevantFiles, config.setup_prompt);

    // Create and configure the AI agent
    const agent = new AIAgent({
      cwd,
      onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
        console.log("Agent step:", {
          text,
          toolCalls,
          toolResults,
          finishReason,
          usage,
        });
      },
    });

    try {
      // Execute the installation task with the AI agent
      const result = await agent.executeTask(config.setup_prompt);
      console.log("Installation result:", result);

      return result;
    } catch (error) {
      console.error("Error during installation:", error);
      throw error;
    }

    // Now you have access to all relevant files in the relevantFiles Map
    // You can use this with the LLM or for other processing
  }

  // determine repo language, framework
  // get config and installation prompt
  // get relevant files ✓ (now implemented)
  // install packages
  // run llm with relevant files to make changes
}

export { detectRepo };
