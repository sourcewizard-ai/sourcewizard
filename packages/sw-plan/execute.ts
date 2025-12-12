/**
 * Execute subcommand - runs a plan with three stages: pre-check, execute, post-verify
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import {
  InternalMessage,
  Stage,
  runTextStage,
} from './index.js';

/**
 * Output stage change message
 */
function outputStage(stage: Stage, outputMode: 'json' | 'pretty'): void {
  const stageMessage: InternalMessage = { type: 'stage', stage };

  if (outputMode === 'json') {
    console.log(JSON.stringify(stageMessage));
  } else {
    console.error(`\n=== Stage: ${stage} ===\n`);
  }
}

interface ExecuteOptions {
  planFile: string;
  repoPath: string;
  outputMode: 'json' | 'pretty';
}

/**
 * Execute command handler
 */
export async function executeCommand(options: ExecuteOptions): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  if (options.outputMode !== 'json' && options.outputMode !== 'pretty') {
    throw new Error('Invalid output mode. Must be "json" or "pretty"');
  }

  const repoPath = options.repoPath || process.cwd();
  console.error(`Executing plan in repository: ${repoPath}`);

  // Read the plan file
  if (!existsSync(options.planFile)) {
    throw new Error(`Plan file not found: ${options.planFile}`);
  }

  const planContent = readFileSync(options.planFile, 'utf-8');
  console.error(`Loaded plan from: ${options.planFile}`);

  // Stage 1: Pre-build check
  outputStage('start', options.outputMode);
  console.error('\n=== Stage 1: Pre-build Check ===\n');
  console.error('Running build verification before making changes...');

  // Read prompt from file
  const preBuildPromptPath = `${repoPath}/.execute-prompts/pre-build-check.txt`;
  if (!existsSync(preBuildPromptPath)) {
    throw new Error(`Pre-build check prompt file not found: ${preBuildPromptPath}`);
  }
  const preBuildPrompt = readFileSync(preBuildPromptPath, 'utf-8');

  const preBuildResult = await runTextStage(
    preBuildPrompt,
    repoPath,
    options.outputMode,
    undefined, // sessionId
    undefined, // logCallback
    repoPath   // allowedWriteDir - auto-approve writes in repo
  );

  console.error(`\nPre-build check complete!`);

  // Stage 2: Execute the plan
  outputStage('plan1' as Stage, options.outputMode);
  console.error('\n=== Stage 2: Execute Integration Plan ===\n');
  console.error('Executing the integration plan...');

  // Read prompt from file
  const executePromptPath = `${repoPath}/.execute-prompts/execute-integration.txt`;
  if (!existsSync(executePromptPath)) {
    throw new Error(`Execute integration prompt file not found: ${executePromptPath}`);
  }
  const executePrompt = readFileSync(executePromptPath, 'utf-8');

  const executionResult = await runTextStage(
    executePrompt,
    repoPath,
    options.outputMode,
    preBuildResult.sessionId, // Resume from pre-build check
    undefined, // logCallback
    repoPath   // allowedWriteDir - auto-approve writes in repo
  );

  console.error(`\nIntegration complete!`);

  // Stage 3: Post-build verification
  outputStage('plan2' as Stage, options.outputMode);
  console.error('\n=== Stage 3: Post-build Verification ===\n');
  console.error('Verifying that everything builds correctly...');

  // Read prompt from file
  const postBuildPromptPath = `${repoPath}/.execute-prompts/post-build-verification.txt`;
  if (!existsSync(postBuildPromptPath)) {
    throw new Error(`Post-build verification prompt file not found: ${postBuildPromptPath}`);
  }
  const postBuildPrompt = readFileSync(postBuildPromptPath, 'utf-8');

  await runTextStage(
    postBuildPrompt,
    repoPath,
    options.outputMode,
    executionResult.sessionId, // Resume from execution
    undefined, // logCallback
    repoPath   // allowedWriteDir - auto-approve writes in repo
  );

  console.error(`\nPost-build verification complete!`);

  // Stage 4: Commit and push changes
  outputStage('plan3' as Stage, options.outputMode);
  console.error('\n=== Stage 4: Commit and Push Changes ===\n');

  // Read prompt from file
  const commitPromptPath = `${repoPath}/.execute-prompts/commit-and-push.txt`;
  if (!existsSync(commitPromptPath)) {
    throw new Error(`Commit and push prompt file not found: ${commitPromptPath}`);
  }
  const commitPrompt = readFileSync(commitPromptPath, 'utf-8');

  await runTextStage(
    commitPrompt,
    repoPath,
    options.outputMode,
    executionResult.sessionId, // Resume from execution
    undefined, // logCallback
    repoPath   // allowedWriteDir - auto-approve writes in repo
  );

  // Output complete stage
  outputStage('complete', options.outputMode);
  console.error('\n=== Execution Complete! ===\n');
  console.error('All stages completed successfully. Changes committed and pushed.');

  if (options.outputMode === 'json') {
    const completeMessage: InternalMessage = {
      type: 'complete',
      document: 'Changes committed and pushed successfully'
    };
    console.log(JSON.stringify(completeMessage));
  }
}

/**
 * Register the execute command with commander
 */
export function registerExecuteCommand(program: Command): void {
  program
    .command('execute')
    .description('Execute an integration plan in a repository (4 stages: pre-check, execute, verify, commit)')
    .requiredOption('--plan-file <path>', 'Path to file containing the integration plan')
    .option('--repo-path <path>', 'Path to the repository to execute in (defaults to current directory)', process.cwd())
    .option('--output-mode <mode>', 'Output mode: json or pretty', 'json')
    .addHelpText('after', '\nEnvironment Variables:\n  ANTHROPIC_API_KEY    Anthropic API key (required)')
    .action(async (options) => {
      try {
        await executeCommand(options);
      } catch (error) {
        console.error(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : ''
        }));
        process.exit(1);
      }
    });
}
