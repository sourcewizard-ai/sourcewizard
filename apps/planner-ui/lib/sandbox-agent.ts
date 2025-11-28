import { Sandbox } from '@vercel/sandbox';
import ms from 'ms';
import { z } from 'zod';
import { createVercelSandboxCLIRunner } from './vercel-sandbox-cli-runner';

export interface SandboxAgentOptions {
  integration: string;
  repoUrl: string;
  clarifications?: string;
  projectContext?: any;
  conversationHistory?: any[];
  sandboxId?: string; // Existing sandbox ID to reuse
  apiKey: string;
  schema: z.ZodSchema;
  onProgress: (message: any) => void;
  onComplete: (data: any) => void;
  onError: (error: string) => void;
  onSandboxCreated?: (sandboxId: string) => void; // Callback when new sandbox is created
}

export async function runSandboxAgent(options: SandboxAgentOptions) {
  const {
    integration,
    repoUrl,
    clarifications,
    projectContext,
    conversationHistory,
    sandboxId,
    apiKey,
    schema,
    onProgress,
    onComplete,
    onError,
    onSandboxCreated
  } = options;

  let runner: Awaited<ReturnType<typeof createVercelSandboxCLIRunner>> | null = null;
  let hadError = false;
  let capturedSandboxId: string | null = sandboxId || null;

  try {
    // Create the CLI runner with sandbox configuration
    runner = await createVercelSandboxCLIRunner(
      {
        integration,
        projectPath: '/vercel/sandbox',
        repoUrl,
        sandboxId,
        apiKey,
        context7Key: process.env.CONTEXT7_API_KEY || '',
        clarifications,
      },
      {
        onMessage: async (message) => {
          // Handle different message types from the CLI
          if (message.type === 'questions') {
            // Forward questions to the progress handler
            onProgress({
              type: 'questions',
              questions: message.questions || []
            });
          } else if (message.type === 'plan') {
            // Forward complete plans to progress handler
            onProgress({
              type: 'plan',
              plan: message.plan
            });
          } else if (message.type === 'sdk_session') {
            // Track SDK session ID
            onProgress({
              type: 'sdk_session',
              sessionId: message.sessionId
            });
          } else if (message.type === 'stage') {
            // Forward stage updates
            onProgress({
              type: 'stage',
              stage: message.stage
            });
          } else {
            // Forward all other messages
            onProgress(message);
          }

          // Check if this is a completion message with final plans
          if (message.type === 'stage' && message.stage === 'complete') {
            // The CLI has completed all plans
            // We need to collect the plans and call onComplete
            // For now, we'll rely on the individual plan messages
          }
        },
        onError: (error) => {
          hadError = true;
          onError(error.message);
        },
        onClose: (code) => {
          if (code !== 0 && !hadError) {
            hadError = true;
            onError(`CLI process exited with code ${code}`);
          }
        }
      }
    );

    // Notify about sandbox creation
    if (onSandboxCreated && !sandboxId) {
      // The runner will create a new sandbox, we'll get the ID after start
      onProgress({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Creating Vercel Sandbox...' }]
        }
      });
    }

    // Start the CLI runner
    await runner.start();

    // Get the sandbox ID for potential reuse
    capturedSandboxId = runner.getSandboxId();
    if (capturedSandboxId && onSandboxCreated && !sandboxId) {
      onSandboxCreated(capturedSandboxId);
    }

  } catch (error) {
    hadError = true;
    console.error('Sandbox agent error:', error);
    onError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    // Only stop sandbox if we have clarifications (final call) OR if there was an error
    // Keep it alive after questions phase so it can be reused
    const shouldStopSandbox = clarifications || hadError;

    if (runner && shouldStopSandbox) {
      try {
        await runner.cleanup();
        console.log('Stopped sandbox (final call):', capturedSandboxId);
      } catch (e) {
        console.error('Failed to stop sandbox:', e);
      }
    } else if (runner) {
      console.log('Keeping sandbox alive for reuse:', capturedSandboxId);

      // Extend timeout to keep sandbox alive longer for the second call
      try {
        await runner.extendTimeout(ms('10m')); // Extend by 10 minutes
        console.log('Extended sandbox timeout by 10 minutes');
      } catch (e) {
        console.error('Failed to extend sandbox timeout:', e);
      }
    }
  }
}
