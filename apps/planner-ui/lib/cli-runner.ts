import type { ChildProcess } from 'child_process';
import path from 'path';

export interface CLIOptions {
  integration: string;
  projectPath: string;
  clarifications?: string;
  sessionId?: string;
  sdkSessionId?: string;
  existingStage?: string;
  planId?: number;
  apiKey: string;
  context7Key: string;
  additionalInstructions?: string;
}

export interface CLIMessage {
  type: string;
  [key: string]: any;
}

export interface CLICallbacks {
  onMessage: (message: CLIMessage) => Promise<void> | void;
  onError: (error: Error) => void;
  onClose: (code: number | null) => void;
}

export interface ICLIRunner {
  start(): void;
  kill(): void;
  isRunning(): boolean;
}

export class CLIRunner implements ICLIRunner {
  private process: ChildProcess | null = null;
  private buffer = '';

  constructor(
    private options: CLIOptions,
    private callbacks: CLICallbacks
  ) { }

  start(): void {
    // Dynamically import spawn only at runtime
    const { spawn } = require('child_process');

    // Dynamically resolve CLI path at runtime (not build time)
    // Using eval to prevent Turbopack from analyzing this path
    const cliPath = eval(`require('path').join(process.cwd(), '../sw-plan', 'dist', 'cli.js')`);

    // Build the CLI command
    const args = [
      cliPath,
      '--prompt', this.options.integration,
      '--cwd', this.options.projectPath,
      '--output-mode', 'json'
    ];

    // Add session ID if resuming
    if (this.options.sdkSessionId) {
      args.push('--session-id', this.options.sdkSessionId);
    }

    // Add clarifications if provided (this skips questions stage)
    if (this.options.clarifications) {
      args.push('--clarifications', this.options.clarifications);
    }
    // Add stage if resuming from a specific stage (and no clarifications)
    else if (this.options.existingStage && this.options.existingStage !== 'start') {
      args.push('--stage', this.options.existingStage);
    }

    // Add plan ID if specified
    if (this.options.planId) {
      args.push('--plan-id', this.options.planId.toString());
    }

    // Add additional instructions if specified
    if (this.options.additionalInstructions) {
      args.push('--additional-instructions', this.options.additionalInstructions);
    }

    // Spawn the CLI process
    this.process = spawn('node', args, {
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: this.options.apiKey,
        CONTEXT7_API_KEY: this.options.context7Key,
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle stdout (JSON messages)
    this.process?.stdout?.on('data', async (data) => {
      const text = data.toString();
      this.buffer += text;

      // Split by newlines to process complete JSON objects
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const message = JSON.parse(line);
          await this.callbacks.onMessage(message);
        } catch (e) {
          console.error('Failed to parse CLI output:', line, e);
        }
      }
    });

    // Handle stderr (logs)
    this.process?.stderr?.on('data', (data) => {
      console.log('[CLI stderr]:', data.toString());
    });

    // Handle process exit
    this.process?.on('close', (code) => {
      console.log(`CLI process exited with code ${code}`);
      this.callbacks.onClose(code);
    });

    // Handle process errors
    this.process?.on('error', (error) => {
      console.error('CLI process error:', error);
      this.callbacks.onError(error);
    });
  }

  kill(): void {
    if (this.process && !this.process.killed) {
      console.log('[DEBUG] Killing CLI process');
      this.process.kill('SIGTERM');
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

// Factory function to create CLI runner instances
export function createCLIRunner(options: CLIOptions, callbacks: CLICallbacks): ICLIRunner {
  return new CLIRunner(options, callbacks);
}
