/**
 * Planner CLI Library
 *
 * Exports schemas and types for integration planning.
 */

import { McpServerConfig, query, SDKMessage, type PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import { resolve as pathResolve } from 'path';

// Define the schema for questions
export const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(3),
  additionalInfo: z.string().optional()
});

// Stage 1: Questions only
export const QuestionsOutputSchema = z.object({
  questions: z.array(QuestionSchema)
});

// Stage 2: Single plan metadata
export const PlanMetadataSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  estimatedTime: z.string(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard'])
});

export const PlanMetadataOutputSchema = z.object({
  plan: PlanMetadataSchema
});

// Stage 3: Setup section for single plan
export const PlanSetupOutputSchema = z.object({
  setup: z.array(z.string())
});

// Stage 4: Integration section for single plan
export const PlanIntegrationOutputSchema = z.object({
  integration: z.array(z.string())
});

// Stage 5: Verification section for single plan
export const PlanVerificationOutputSchema = z.object({
  verification: z.array(z.string())
});

// Stage 6: Next steps section for single plan
export const PlanNextStepsOutputSchema = z.object({
  nextSteps: z.array(z.string())
});

// Summary schema for section summarization
export const SectionSummarySchema = z.object({
  summary: z.string()
});

// Complete plan structure (for final output)
export const IntegrationPlanSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  estimatedTime: z.string(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  sections: z.object({
    setup: z.array(z.string()),
    integration: z.array(z.string()),
    verification: z.array(z.string()),
    nextSteps: z.array(z.string())
  }),
  summaries: z.object({
    setup: z.string(),
    integration: z.string(),
    verification: z.string(),
    nextSteps: z.string()
  })
});

// Infer TypeScript types from Zod schemas
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionsOutput = z.infer<typeof QuestionsOutputSchema>;
export type PlanMetadata = z.infer<typeof PlanMetadataSchema>;
export type PlanMetadataOutput = z.infer<typeof PlanMetadataOutputSchema>;
export type PlanSetupOutput = z.infer<typeof PlanSetupOutputSchema>;
export type PlanIntegrationOutput = z.infer<typeof PlanIntegrationOutputSchema>;
export type PlanVerificationOutput = z.infer<typeof PlanVerificationOutputSchema>;
export type PlanNextStepsOutput = z.infer<typeof PlanNextStepsOutputSchema>;
export type SectionSummary = z.infer<typeof SectionSummarySchema>;
export type IntegrationPlan = z.infer<typeof IntegrationPlanSchema>;

// Stage types for resumption
export type Stage = 'start' | 'questions' | 'plan1' | 'plan2' | 'plan3' | 'complete';

// Internal message types for display
export type InternalMessage =
  | { type: 'tool_call'; tool_name: string; tool_params: any; tool_use_id: string }
  | { type: 'tool_result'; tool_use_id: string; tool_response: string }
  | { type: 'agent_response'; text: string }
  | { type: 'status'; message: string }
  | { type: 'questions'; questions: Question[] }
  | { type: 'plan'; plan: IntegrationPlan }
  | { type: 'sdk_session'; sessionId: string }
  | { type: 'stage'; stage: Stage }
  | { type: 'progress'; message: string }
  | { type: 'document_chunk'; content: string }
  | { type: 'complete'; document: string };

// Track active tool calls to match with results
const activeToolCalls = new Map<string, { tool_name: string; tool_params: any }>();

/**
 * Create a PreToolUse hook that restricts Write operations to a specific directory
 * and tracks the last written file path
 */
function createWriteRestrictionHook(
  allowedDir: string,
  onFileWritten: (filePath: string) => void
) {
  return async (
    input: any,
    toolUseID: string | undefined,
    options: { signal: AbortSignal }
  ): Promise<any> => {
    console.error(`[DEBUG] PreToolUse hook called: tool_name=${input.tool_name}`);

    // Only validate Write tool
    if (input.tool_name !== 'Write') {
      return {};  // Continue normally for other tools
    }

    const toolInput = input.tool_input as Record<string, unknown>;
    const filePath = toolInput.file_path as string;
    console.error(`[DEBUG] Write tool about to execute with file_path=${filePath}`);

    if (!filePath) {
      return {};  // Continue if no path
    }

    // Normalize paths for comparison
    const normalizedFilePath = pathResolve(filePath);
    const normalizedAllowedDir = pathResolve(allowedDir);

    // Check if file path is within allowed directory
    const isWithinAllowed = normalizedFilePath.startsWith(normalizedAllowedDir);

    if (!isWithinAllowed) {
      console.error(`[DEBUG] Write DENIED: ${normalizedFilePath} not in ${normalizedAllowedDir}`);
      return {
        decision: 'block',
        reason: `Cannot write to ${filePath}. Writes are restricted to ${allowedDir} directory.`
      };
    }

    // Track the file path via callback
    console.error(`[DEBUG] Write ALLOWED: tracking path ${filePath}`);
    onFileWritten(filePath);

    return {};  // Continue normally
  };
}

function getMCPServersConfig(): Record<string, McpServerConfig> {
  return {
    "context7": {
      type: "http",
      url: "https://mcp.context7.com/mcp",
      headers: {
        "CONTEXT7_API_KEY": process.env.CONTEXT7_API_KEY || "",
      },
    },
  }
}

function getAllowedTools(): string[] {
  return ['Read', 'Write', 'Glob', 'Grep', 'Bash', 'mcp__context7__resolve-library-id', 'mcp__context7__get-library-docs'];
}

/**
 * Parse SDK messages into internal format
 */
function parseSDKMessage(message: SDKMessage): InternalMessage[] {
  const results: InternalMessage[] = [];

  switch (message.type) {
    case 'stream_event':
      const event = message.event;
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta') {
          results.push({ type: 'agent_response', text: delta.text });
        }
      }
      break;

    case 'user':
      if (!message.isSynthetic) {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_result') {
              const response = typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content);
              results.push({ type: 'tool_result', tool_use_id: block.tool_use_id, tool_response: response });
            }
          }
        }
      }
      break;

    case 'assistant':
      if (message.message.content) {
        for (const block of message.message.content) {
          if (block.type === 'tool_use') {
            activeToolCalls.set(block.id, { tool_name: block.name, tool_params: block.input });
            results.push({ type: 'tool_call', tool_name: block.name, tool_params: block.input, tool_use_id: block.id });

            // Note: File path tracking happens in canUseTool hook
          } else if (block.type === 'text') {
            results.push({ type: 'agent_response', text: block.text });
          }
        }
      }
      break;

    case 'system':
      if (message.subtype === 'init') {
        results.push({ type: 'status', message: `Session started (model: ${message.model})` });
      } else if (message.subtype === 'status' && message.status) {
        results.push({ type: 'status', message: `Status: ${message.status}...` });
      }
      break;
  }

  return results;
}

/**
 * Format internal message for display
 */
export function displayInternalMessage(msg: InternalMessage): void {
  switch (msg.type) {
    case 'tool_call':
      const paramsStr = JSON.stringify(msg.tool_params).substring(0, 80);
      console.error(`Tool call: ${msg.tool_name}(${paramsStr}${JSON.stringify(msg.tool_params).length > 80 ? '...' : ''})`);
      break;
    case 'tool_result':
      const toolCall = activeToolCalls.get(msg.tool_use_id);
      const toolName = toolCall ? toolCall.tool_name : 'unknown';
      const size = msg.tool_response.length;
      console.error(`Tool result: ${toolName} -> ${size} bytes`);

      // Debug: Print full StructuredOutput content
      if (toolName === 'StructuredOutput') {
        console.error(`[DEBUG] StructuredOutput full response:\n'${msg.tool_response}'`);
      }

      activeToolCalls.delete(msg.tool_use_id);
      break;
    case 'agent_response':
      console.error(`Agent message: ${msg.text}`);
      break;
    case 'status':
      console.error(msg.message);
      break;
    case 'questions':
      console.error(`\n[Received ${msg.questions.length} questions from agent]`);
      break;
    case 'plan':
      console.error(`\n[Generated ${msg.plan.difficulty} plan: ${msg.plan.title}]`);
      break;
    case 'stage':
      console.error(`\n[Stage: ${msg.stage}]`);
      break;
  }
}


/**
 * Run a stage with structured output (for questions)
 */
export async function runStructuredStage<T>(
  prompt: string,
  schema: any,
  cwd: string,
  outputMode: 'json' | 'pretty',
  sessionId?: string,
  logCallback?: (message: string) => void,
  model: 'sonnet' | 'haiku' = 'haiku',
  maxRetries: number = 3,
  allowedWriteDir?: string
): Promise<{ output: T; sessionId: string; lastWrittenFilePath: string | null }> {
  const jsonSchema = zodToJsonSchema(schema, {
    $refStrategy: 'none',
    target: 'jsonSchema7'
  });

  let lastAttempt = 0;
  let lastSessionId = sessionId || '';
  let lastWrittenFilePath: string | null = null;
  console.error("[DEBUG] runStructuredStage called");
  console.error(`[DEBUG] runStructuredStage called ${allowedWriteDir}`);

  while (lastAttempt < maxRetries) {
    const result = query({
      prompt: lastAttempt > 0
        ? `${prompt}\n\nIMPORTANT: You must return your response in the exact structured format specified. Do not return the data as plain text.`
        : prompt,
      options: {
        cwd,
        model,
        settingSources: [],
        mcpServers: getMCPServersConfig(),
        maxTurns: 30,
        allowedTools: getAllowedTools(),
        additionalDirectories: allowedWriteDir ? [allowedWriteDir] : undefined,
        outputFormat: {
          type: 'json_schema',
          schema: jsonSchema
        },
        resume: lastAttempt === 0 ? sessionId : undefined, // Only resume on first attempt
        hooks: allowedWriteDir
          ? {
              PreToolUse: [{
                hooks: [createWriteRestrictionHook(allowedWriteDir, (path) => { lastWrittenFilePath = path; })]
              }]
            }
          : undefined
      }
    });

    let capturedSessionId = lastSessionId;
    let structuredOutput: T | null = null;
    let sessionIdOutputted = false;

    for await (const message of result) {
      if ('session_id' in message && message.session_id) {
        const newSessionId = message.session_id;

        // Only output if session ID changed or first time
        if (capturedSessionId !== newSessionId) {
          capturedSessionId = newSessionId;

          // Output SDK session ID as internal message (once per new session)
          if (outputMode === 'json' && !sessionIdOutputted) {
            console.log(JSON.stringify({ type: 'sdk_session', sessionId: capturedSessionId }));
            sessionIdOutputted = true;
          }
        }
      }

      if (message.type === 'result' && message.subtype === 'success') {
        if (message.structured_output) {
          structuredOutput = message.structured_output as T;
        }
      }

      // Parse and display messages
      const internalMsgs = parseSDKMessage(message);

      if (outputMode === 'json') {
        // In JSON mode, output internal messages as JSON to stdout
        for (const internalMsg of internalMsgs) {
          console.log(JSON.stringify(internalMsg));

          // Log LLM text responses to callback if provided
          if (logCallback && internalMsg.type === 'agent_response') {
            logCallback(`[LLM] ${internalMsg.text}`);
          }
        }
      } else {
        // In pretty mode, display to stderr
        for (const internalMsg of internalMsgs) {
          displayInternalMessage(internalMsg);

          // Log LLM text responses to callback if provided
          if (logCallback && internalMsg.type === 'agent_response') {
            logCallback(`[LLM] ${internalMsg.text}`);
          }
        }

        if (message.type === 'result') {
          if (message.subtype === 'success') {
            console.error(`\nStage complete (${message.num_turns} turns, $${message.total_cost_usd.toFixed(4)})`);
            if (logCallback) {
              logCallback(`Stage complete (${message.num_turns} turns, $${message.total_cost_usd.toFixed(4)})`);
            }
          } else {
            console.error(`[ERROR] Agent returned error subtype: ${message.subtype}`);
            if (logCallback) {
              logCallback(`[ERROR] Agent returned error subtype: ${message.subtype}`);
            }
          }
        }
      }
    }

    if (structuredOutput) {
      return { output: structuredOutput, sessionId: capturedSessionId, lastWrittenFilePath };
    }

    // No structured output - retry if we have attempts left
    lastAttempt++;
    lastSessionId = capturedSessionId;

    if (lastAttempt < maxRetries) {
      console.error(`[WARNING] No structured output received from agent - retrying (attempt ${lastAttempt + 1}/${maxRetries})...`);
      if (logCallback) {
        logCallback(`[WARNING] No structured output received - retrying (attempt ${lastAttempt + 1}/${maxRetries})...`);
      }
    }
  }

  // All retries exhausted
  console.error('[ERROR] No structured output received after all retries - returning empty object');
  if (logCallback) {
    logCallback('[ERROR] No structured output received after all retries');
  }
  return { output: {} as T, sessionId: lastSessionId, lastWrittenFilePath };
}

/**
 * Run a stage and collect text response (for plan generation)
 */
export async function runTextStage(
  prompt: string,
  cwd: string,
  outputMode: 'json' | 'pretty',
  sessionId?: string,
  logCallback?: (message: string) => void,
  allowedWriteDir?: string
): Promise<{ response: string; sessionId: string; lastWrittenFilePath: string | null }> {
  let lastWrittenFilePath: string | null = null;

  const result = query({
    prompt,
    options: {
      cwd,
      model: 'haiku',
      mcpServers: getMCPServersConfig(),
      settingSources: [],
      maxTurns: 30,
      allowedTools: getAllowedTools(),
      additionalDirectories: allowedWriteDir ? [allowedWriteDir] : undefined,
      resume: sessionId,
      hooks: allowedWriteDir
        ? {
            PreToolUse: [{
              hooks: [createWriteRestrictionHook(allowedWriteDir, (path) => { lastWrittenFilePath = path; })]
            }]
          }
        : undefined
    }
  });

  let capturedSessionId = sessionId || '';
  let responseText = '';
  let sessionIdOutputted = false;

  for await (const message of result) {
    if ('session_id' in message && message.session_id) {
      const newSessionId = message.session_id;

      // Only output if session ID changed or first time
      if (capturedSessionId !== newSessionId) {
        capturedSessionId = newSessionId;

        // Output SDK session ID as internal message (once per new session)
        if (outputMode === 'json' && !sessionIdOutputted) {
          console.log(JSON.stringify({ type: 'sdk_session', sessionId: capturedSessionId }));
          sessionIdOutputted = true;
        }
      }
    }

    // Collect text from assistant messages
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }
    }

    // Parse and display messages
    const internalMsgs = parseSDKMessage(message);

    if (outputMode === 'json') {
      // In JSON mode, output internal messages as JSON to stdout
      for (const internalMsg of internalMsgs) {
        console.log(JSON.stringify(internalMsg));

        // Log LLM text responses to callback if provided
        if (logCallback && internalMsg.type === 'agent_response') {
          logCallback(`[LLM] ${internalMsg.text}`);
        }
      }
    } else {
      // In pretty mode, display to stderr
      for (const internalMsg of internalMsgs) {
        displayInternalMessage(internalMsg);

        // Log LLM text responses to callback if provided
        if (logCallback && internalMsg.type === 'agent_response') {
          logCallback(`[LLM] ${internalMsg.text}`);
        }
      }

      if (message.type === 'result') {
        if (message.subtype === 'success') {
          console.error(`\nStage complete (${message.num_turns} turns, $${message.total_cost_usd.toFixed(4)})`);
          if (logCallback) {
            logCallback(`Stage complete (${message.num_turns} turns, $${message.total_cost_usd.toFixed(4)})`);
          }
        } else {
          console.error(`[ERROR] Agent returned error subtype: ${message.subtype}`);
          if (logCallback) {
            logCallback(`[ERROR] Agent returned error subtype: ${message.subtype}`);
          }
        }
      }
    }
  }

  return { response: responseText, sessionId: capturedSessionId, lastWrittenFilePath };
}


