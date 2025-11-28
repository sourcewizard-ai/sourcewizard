import { Sandbox } from '@vercel/sandbox';
import ms from 'ms';
import { CLIOptions, CLIMessage, CLICallbacks, ICLIRunner } from './cli-runner';

/**
 * Vercel Sandbox CLI Runner
 *
 * Runs the planner CLI in a Vercel Sandbox environment with full filesystem access.
 * This allows the CLI to run with proper git repository cloning and file system operations
 * even when deployed to Vercel's serverless environment.
 */
export class VercelSandboxCLIRunner implements ICLIRunner {
  private sandbox: Sandbox | null = null;
  private running = false;
  private commandProcess: any = null;

  constructor(
    private options: CLIOptions & { repoUrl: string; sandboxId?: string },
    private callbacks: CLICallbacks
  ) { }

  async start(): Promise<void> {
    try {
      // Create or reuse existing sandbox
      if (this.options.sandboxId) {
        try {
          this.sandbox = await Sandbox.get({ sandboxId: this.options.sandboxId });

          if (this.sandbox.status !== 'running') {
            console.log('[VercelSandboxCLIRunner] Sandbox not running, creating new one');
            this.sandbox = null;
          } else {
            console.log('[VercelSandboxCLIRunner] Reusing existing sandbox:', this.options.sandboxId);
          }
        } catch (e) {
          console.log('[VercelSandboxCLIRunner] Failed to reconnect to sandbox, creating new one:', e);
          this.sandbox = null;
        }
      }

      // Create new sandbox if we don't have one
      if (!this.sandbox) {
        console.log('[VercelSandboxCLIRunner] Creating new sandbox with repo:', this.options.repoUrl);

        // Notify that sandbox creation is starting
        this.callbacks.onMessage?.({
          type: 'status',
          message: 'Creating sandbox environment...'
        });

        this.sandbox = await Sandbox.create({
          source: {
            url: this.options.repoUrl,
            type: 'git',
          },
          resources: { vcpus: 4 },
          timeout: ms('30m'),
          runtime: 'node22',
        });

        console.log('[VercelSandboxCLIRunner] Sandbox created:', this.sandbox.sandboxId);

        // Notify callbacks about sandbox creation with the actual sandbox ID
        this.callbacks.onMessage?.({
          type: 'sandbox_created',
          sandboxId: this.sandbox.sandboxId
        });

        // Notify that repository is being cloned
        this.callbacks.onMessage?.({
          type: 'status',
          message: 'Cloning repository into sandbox...'
        });

        // Wait a moment for git clone to complete (sandbox.create waits for this)
        // The sandbox is ready when create() returns, but we add this message for clarity
        this.callbacks.onMessage?.({
          type: 'status',
          message: 'Repository cloned successfully'
        });

        // Initialize the sandbox with CLI and dependencies
        await this.initializeSandbox();
      }

      this.running = true;

      // Build the CLI command with npx - properly escape arguments for bash
      const escapeArg = (arg: string) => {
        // Escape single quotes and wrap in single quotes for bash
        return `'${arg.replace(/'/g, "'\\''")}'`;
      };

      const cliArgs: string[] = [
        'npx', 'sw-plan',
        '--prompt', escapeArg(this.options.integration),
        '--cwd', escapeArg(this.options.projectPath || '/vercel/sandbox'),
        '--output-mode', 'json'
      ];

      // Add session ID if resuming
      if (this.options.sdkSessionId) {
        cliArgs.push('--session-id', escapeArg(this.options.sdkSessionId));
      }

      // Add clarifications if provided (this skips questions stage)
      if (this.options.clarifications) {
        cliArgs.push('--clarifications', escapeArg(this.options.clarifications));
      }
      // Add stage if resuming from a specific stage (and no clarifications)
      else if (this.options.existingStage && this.options.existingStage !== 'start') {
        cliArgs.push('--stage', escapeArg(this.options.existingStage));
      }

      // Add plan ID if specified
      if (this.options.planId) {
        cliArgs.push('--plan-id', this.options.planId.toString());
      }

      // Add additional instructions if specified
      if (this.options.additionalInstructions) {
        cliArgs.push('--additional-instructions', escapeArg(this.options.additionalInstructions));
      }

      // Join arguments with spaces to form the command
      const command = cliArgs.join(' ');

      // Run the CLI in detached mode so we can stream logs
      this.commandProcess = await this.sandbox.runCommand({
        cmd: 'bash',
        args: ['-c', command],
        cwd: this.options.projectPath || '/vercel/sandbox',
        env: {
          ANTHROPIC_API_KEY: this.options.apiKey,
          CONTEXT7_API_KEY: this.options.context7Key,
        },
        detached: true,
      });

      // Stream logs from the CLI
      let buffer = '';

      for await (const log of this.commandProcess.logs()) {
        if (!this.running) {
          break;
        }

        if (log.stream === 'stdout') {
          buffer += log.data;

          // Split by newlines to process complete JSON objects
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const message: CLIMessage = JSON.parse(line);
              await this.callbacks.onMessage(message);
            } catch (e) {
              console.error('[VercelSandboxCLIRunner] Failed to parse CLI output:', line, e);
            }
          }
        } else if (log.stream === 'stderr') {
          console.error('[VercelSandboxCLIRunner] CLI stderr:', log.data);
        }
      }

      // Wait for command to complete
      const finalCommand = await this.commandProcess.wait();

      console.log('[VercelSandboxCLIRunner] CLI process exited with code:', finalCommand.exitCode);

      this.running = false;
      this.callbacks.onClose(finalCommand.exitCode);

      // Handle non-zero exit codes
      if (finalCommand.exitCode !== 0) {
        const errorOutput = await finalCommand.stderr();
        const stdoutOutput = await finalCommand.stdout();
        const error = new Error(`CLI failed with exit code ${finalCommand.exitCode}: ${errorOutput || stdoutOutput || 'Unknown error'}`);
        this.callbacks.onError(error);
      }
    } catch (error) {
      console.error('[VercelSandboxCLIRunner] Error:', error);
      this.running = false;
      this.callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
      this.callbacks.onClose(1);
    }
  }

  private async initializeSandbox(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    console.log('[VercelSandboxCLIRunner] Installing sw-plan CLI...');

    // Notify that CLI installation is starting
    this.callbacks.onMessage?.({
      type: 'status',
      message: 'Installing sw-plan CLI in sandbox...'
    });

    // Install the published sw-plan CLI globally
    const installResult = await this.sandbox.runCommand({
      cmd: 'npm',
      args: ['install', '-g', 'sw-plan'],
      cwd: '/vercel/sandbox',
    });

    if (installResult.exitCode !== 0) {
      const installStderr = await installResult.stderr();
      const installStdout = await installResult.stdout();
      throw new Error(`Failed to install sw-plan CLI: ${installStderr || installStdout}`);
    }

    console.log('[VercelSandboxCLIRunner] sw-plan CLI installation complete');

    // Notify that CLI installation is complete
    this.callbacks.onMessage?.({
      type: 'status',
      message: 'sw-plan CLI installed successfully'
    });
  }

  kill(): void {
    if (this.running) {
      console.log('[VercelSandboxCLIRunner] Killing CLI process');
      this.running = false;

      // Note: Vercel Sandbox commands don't have a direct kill method
      // The command will be stopped when the sandbox is stopped
      // or when we break out of the log streaming loop
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the sandbox ID for reuse in subsequent calls
   */
  getSandboxId(): string | null {
    return this.sandbox?.sandboxId || null;
  }

  /**
   * Stop and cleanup the sandbox
   */
  async cleanup(): Promise<void> {
    if (this.sandbox) {
      try {
        console.log('[VercelSandboxCLIRunner] Stopping sandbox:', this.sandbox.sandboxId);
        await this.sandbox.stop();
      } catch (e) {
        console.error('[VercelSandboxCLIRunner] Failed to stop sandbox:', e);
      }
    }
  }

  /**
   * Extend the sandbox timeout to keep it alive longer
   */
  async extendTimeout(duration: number): Promise<void> {
    if (this.sandbox) {
      try {
        await this.sandbox.extendTimeout(duration);
        console.log('[VercelSandboxCLIRunner] Extended sandbox timeout');
      } catch (e) {
        console.error('[VercelSandboxCLIRunner] Failed to extend sandbox timeout:', e);
      }
    }
  }
}

/**
 * Factory function to create Vercel Sandbox CLI runner instances
 */
export async function createVercelSandboxCLIRunner(
  options: CLIOptions & { repoUrl: string; sandboxId?: string; installationId?: number },
  callbacks: CLICallbacks
): Promise<VercelSandboxCLIRunner> {
  // Get GitHub access token for private repo access
  let authenticatedRepoUrl = options.repoUrl;

  console.log('[VercelSandboxCLIRunner] Factory - installationId:', options.installationId);
  console.log('[VercelSandboxCLIRunner] Factory - repoUrl:', options.repoUrl);

  if (options.installationId) {
    try {
      const { getInstallationAccessToken } = await import('./github-app');
      const accessToken = await getInstallationAccessToken(options.installationId);

      if (accessToken) {
        // Convert https://github.com/owner/repo.git to https://x-access-token:TOKEN@github.com/owner/repo.git
        authenticatedRepoUrl = options.repoUrl.replace(
          'https://github.com/',
          `https://x-access-token:${accessToken}@github.com/`
        );
        console.log('[VercelSandboxCLIRunner] Using authenticated git URL for private repo access');
      }
    } catch (error) {
      console.error('[VercelSandboxCLIRunner] Failed to get GitHub access token:', error);
      // Continue with unauthenticated URL (will fail for private repos)
    }
  }

  return new VercelSandboxCLIRunner(
    { ...options, repoUrl: authenticatedRepoUrl },
    callbacks
  );
}
