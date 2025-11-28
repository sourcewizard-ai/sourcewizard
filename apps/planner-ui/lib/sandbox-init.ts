import { Sandbox } from '@vercel/sandbox';
import ms from 'ms';

export interface SandboxInitOptions {
  sandboxId?: string;
  repoUrl: string;
  apiKey: string;
  onProgress: (message: any) => void;
  onSandboxCreated?: (sandboxId: string) => void;
}

export interface InitializedSandbox {
  sandbox: Sandbox;
  isNewSandbox: boolean;
}

/**
 * Initialize or reuse a Vercel Sandbox with the repository and dependencies
 */
export async function initializeSandbox(
  options: SandboxInitOptions
): Promise<InitializedSandbox> {
  const { sandboxId, repoUrl, apiKey, onProgress, onSandboxCreated } = options;

  let sandbox: Sandbox | null = null;
  let isNewSandbox = false;

  // Try to reuse existing sandbox if ID provided
  if (sandboxId) {
    onProgress({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Reusing existing Vercel Sandbox...' }]
      }
    });

    try {
      sandbox = await Sandbox.get({ sandboxId });

      // Check if sandbox is still running
      if (sandbox.status !== 'running') {
        console.log('Sandbox not running, status:', sandbox.status);
        sandbox = null;
      } else {
        console.log('Successfully reconnected to sandbox:', sandboxId);
      }
    } catch (e) {
      console.log('Failed to reconnect to sandbox, creating new one:', e);
      sandbox = null;
    }
  }

  // Create new sandbox if we don't have one
  if (!sandbox) {
    isNewSandbox = true;
    onProgress({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Creating Vercel Sandbox environment...' }]
      }
    });

    // Create sandbox with the repository
    sandbox = await Sandbox.create({
      source: {
        url: repoUrl,
        type: 'git',
      },
      resources: { vcpus: 4 },
      timeout: ms('30m'),
      runtime: 'node22',
    });

    // Notify about new sandbox creation
    if (onSandboxCreated && sandbox.sandboxId) {
      onSandboxCreated(sandbox.sandboxId);
    }
  }

  // Only install dependencies if this is a new sandbox
  if (isNewSandbox) {
    onProgress({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Sandbox created. Installing dependencies...' }]
      }
    });

    // Install Claude Code CLI globally (required by Agent SDK)
    onProgress({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Installing Claude Code CLI...' }]
      }
    });

    const cliInstallResult = await sandbox.runCommand({
      cmd: 'npm',
      args: ['install', '-g', '@anthropic-ai/claude-code'],
      cwd: '/vercel/sandbox',
    });

    if (cliInstallResult.exitCode !== 0) {
      const cliStderr = await cliInstallResult.stderr();
      const cliStdout = await cliInstallResult.stdout();
      throw new Error(`Failed to install Claude Code CLI: ${cliStderr || cliStdout}`);
    }

    // Verify CLI installation
    const verifyResult = await sandbox.runCommand({
      cmd: 'which',
      args: ['claude'],
      cwd: '/vercel/sandbox',
    });
    const claudePath = await verifyResult.stdout();
    console.log('Claude CLI installed at:', claudePath);

    // Test running the CLI directly to see actual error
    const testCliResult = await sandbox.runCommand({
      cmd: 'bash',
      args: ['-c', `export ANTHROPIC_API_KEY="${apiKey}" && /home/vercel-sandbox/.global/npm/bin/claude --version 2>&1 || echo "Exit code: $?"`],
      cwd: '/vercel/sandbox',
    });
    const testOutput = await testCliResult.stdout();
    const testError = await testCliResult.stderr();
    console.log('CLI test output:', testOutput);
    console.log('CLI test error:', testError);
    console.log('CLI test exit code:', testCliResult.exitCode);

    // Initialize package.json in the sandbox
    await sandbox.runCommand({
      cmd: 'npm',
      args: ['init', '-y'],
      cwd: '/vercel/sandbox',
    });

    // Install Claude Agent SDK and dependencies
    const installResult = await sandbox.runCommand({
      cmd: 'npm',
      args: ['install', '@anthropic-ai/claude-agent-sdk', 'zod', 'zod-to-json-schema'],
      cwd: '/vercel/sandbox',
    });

    if (installResult.exitCode !== 0) {
      const installStderr = await installResult.stderr();
      const installStdout = await installResult.stdout();
      throw new Error(`Failed to install dependencies: ${installStderr || installStdout}`);
    }

    onProgress({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Dependencies installed. Starting analysis...' }]
      }
    });
  } else {
    onProgress({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Sandbox ready. Continuing analysis...' }]
      }
    });
  }

  return { sandbox, isNewSandbox };
}
