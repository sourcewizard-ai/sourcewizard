import { createAnthropic } from "@ai-sdk/anthropic";
import { CoreMessage, generateText } from "ai";
import { createFileOperationTools, createSearchTools } from "./ai-tools.js";
import { getBulkTargetData, ProjectContext } from "./repository-detector.js";
import { readRelevantFiles } from "./file-utils.js";

export interface AgentOptions {
  serverUrl: string;
  apiKey?: string;
  jwt?: string;
  cwd: string;
  projectContext: ProjectContext;
  onStepFinish?: (stepData: any) => void;
}

export interface AgentResult {
  text: string;
  toolCalls?: any[];
  toolResults?: any[];
  finishReason?: string;
  usage?: any;
}

export class AIAgent {
  private projectContext: ProjectContext;
  private cwd: string;
  private serverUrl: string;
  private apiKey?: string;
  private jwt?: string;
  private onStepFinish?: (stepData: any) => void;

  constructor(options: AgentOptions) {
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

  private async getConfig(packageName: string) {
    let authHeaders = {};
    if (this.apiKey) {
      authHeaders["x-api-key"] = this.apiKey;
    }
    if (this.jwt) {
      authHeaders["Authorization"] = `Bearer ${this.jwt}`;
    }
    const response = await fetch(`${this.serverUrl}/api/agent/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        package_name: packageName,
      }),
    });
    const data = await response.json();
    return data;
  }

  async searchPackages(query: string): Promise<AgentResult> {
    let authHeaders = {};
    if (this.apiKey) {
      authHeaders["x-api-key"] = this.apiKey;
    }
    if (this.jwt) {
      authHeaders["Authorization"] = `Bearer ${this.jwt}`;
    }
    console.log(this.serverUrl);
    const anthropic = createAnthropic({
      apiKey: this.apiKey || '',
      baseURL: this.serverUrl + "/api/agent",
      headers: {
        ...authHeaders,
      },
    });

    const bulkTargetData = await getBulkTargetData(
      this.projectContext.targets,
      this.cwd
    );

    this.projectContext.target_dependencies = bulkTargetData;

    const prompt = {
      operation: "search",
      search_query: query,
      project_context: this.projectContext,
    };
    // console.log("Prompt", prompt);

    const result = await generateText({
      // this is ignored on the server side
      //model: anthropic("claude-4-sonnet-20250514"),
      model: anthropic("claude-3-5-sonnet-20240620"),
      prompt: JSON.stringify(prompt),
      onStepFinish: this.onStepFinish,
    });

    return {
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
      finishReason: result.finishReason,
      usage: result.usage,
    };
  }

  async installPackage(packageName: string): Promise<AgentResult> {
    const config = await this.getConfig(packageName);

    let relevantFiles: Record<string, string> = {};

    if (config.relevant_files_pattern) {
      console.log("Reading relevant files");
      relevantFiles = await readRelevantFiles(
        this.cwd,
        config.relevant_files_pattern
      );
    }

    let authHeaders = {};
    if (this.apiKey) {
      authHeaders["x-api-key"] = this.apiKey;
    }
    if (this.jwt) {
      authHeaders["Authorization"] = `Bearer ${this.jwt}`;
    }
    const anthropic = createAnthropic({
      apiKey: this.apiKey || '',
      baseURL: this.serverUrl + "/api/agent",
      headers: {
        ...authHeaders,
      },
    });

    const tools = createFileOperationTools(
      this.cwd,
      this.projectContext.targets
    );

    const prompt = {
      operation: "install",
      package_name: packageName,
      relevant_files: relevantFiles,
      project_context: this.projectContext,
    };

    const result = await generateText({
      // this is ignored on the server side
      model: anthropic("claude-4-sonnet-20250514"),
      maxSteps: config.max_steps,
      prompt: JSON.stringify(prompt),
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
