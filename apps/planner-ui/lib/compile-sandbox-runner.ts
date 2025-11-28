import { build } from 'esbuild';
import { join } from 'path';

/**
 * Compiles the planner CLI package to a single JavaScript file
 */
export async function compileSandboxRunner(): Promise<string> {
  // Path to the CLI entry point
  const cliEntryPath = join(__dirname, '..', 'planner-cli', 'src', 'index.ts');

  // Use esbuild to compile TypeScript to JavaScript
  const result = await build({
    entryPoints: [cliEntryPath],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    write: false,
    external: ['@anthropic-ai/claude-agent-sdk'],
    banner: {
      js: '#!/usr/bin/env node'
    }
  });

  if (result.outputFiles && result.outputFiles.length > 0) {
    return result.outputFiles[0].text;
  }

  throw new Error('Failed to compile planner CLI');
}
