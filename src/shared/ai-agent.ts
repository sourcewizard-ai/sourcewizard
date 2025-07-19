import { createAnthropic } from "@ai-sdk/anthropic";
import { CoreMessage, generateText } from "ai";
import { createFileOperationTools } from "./ai-tools.js";

export interface AgentConfig {
  apiKey?: string;
  model?: string;
  maxSteps?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentOptions {
  cwd: string;
  config?: AgentConfig;
  onStepFinish?: (stepData: any) => void;
}

export interface AgentResult {
  text: string;
  toolCalls?: any[];
  toolResults?: any[];
  finishReason?: string;
  usage?: any;
}

/**
 * Create and configure an AI agent with file operation tools
 */
export class AIAgent {
  private config: AgentConfig;
  private cwd: string;
  private onStepFinish?: (stepData: any) => void;

  constructor(options: AgentOptions) {
    this.config = {
      apiKey:
        "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",
      model: "claude-3-sonnet-20241022",
    };

    this.cwd = options.cwd;
    this.onStepFinish = options.onStepFinish;

    if (!this.config.apiKey) {
      throw new Error(
        "Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or provide it in config."
      );
    }
  }

  async executeTask(prompt: string): Promise<AgentResult> {
    const anthropic = createAnthropic({
      apiKey: this.config.apiKey!,
    });

    const tools = createFileOperationTools(this.cwd);

    const result = await generateText({
      model: anthropic(this.config.model!),
      maxSteps: this.config.maxSteps,
      prompt,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      onStepFinish:
        this.onStepFinish ||
        (({ text, toolCalls, toolResults, finishReason, usage }) => {
          console.log("Step finished:", {
            text,
            toolCalls,
            toolResults,
            finishReason,
            usage,
          });
        }),
      tools,
    });

    return {
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      finishReason: result.finishReason,
      usage: result.usage,
    };
  }
}
