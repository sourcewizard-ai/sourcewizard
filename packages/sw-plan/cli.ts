#!/usr/bin/env node

/**
 * Planner CLI
 *
 * A CLI tool that runs in a git repository and uses Claude Agent SDK to:
 * 1. Analyze the codebase and ask clarifying questions
 * 2. Generate plan metadata (titles, descriptions)
 * 3. Generate setup sections for each plan
 * 4. Generate integration sections for each plan
 * 5. Generate verification sections for each plan
 * 6. Generate next steps sections for each plan
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... planner-cli --prompt "Integrate Stripe payments" [options]
 *
 * Options:
 *   --prompt <text>            User prompt describing the task (required)
 *   --project-context <json>   Project context as JSON string
 *   --cwd <path>               Working directory (defaults to current directory)
 */

import { McpServerConfig, query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { Command } from 'commander';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { select } from '@inquirer/prompts';
import { z } from 'zod';
import { analyzeRepositoryV2 } from 'sourcewizard/repodetect';
import { readFileSync, existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import {
  QuestionsOutputSchema,
  PlanMetadataSchema,
  PlanMetadataOutputSchema,
  SectionSummarySchema,
  type Question,
  type QuestionsOutput,
  type IntegrationPlan,
  type PlanMetadata,
  type SectionSummary,
  Stage,
  InternalMessage,
  runStructuredStage,
  runTextStage,
  displayInternalMessage,
} from './index.js';

import {
  DocumentCompiler
} from './docs.js';
import { runCompile2 } from './compile2.js';
import { registerExecuteCommand } from './execute.js';
import { required } from 'zod/v4-mini';

// Schema for document compilation output
const DocumentOutputSchema = z.object({
  outputFilePath: z.string().describe('The relative path to the file where the document was written')
});

interface CLIParams {
  prompt: string;
  projectContext?: any;
  cwd?: string;
  outputMode: 'json' | 'pretty';
  sessionId?: string;
  stage?: Stage;
  clarifications?: string;
  planId?: number; // Specific plan ID to generate (1=Medium, 2=Easy, 3=Hard)
  additionalInstructions?: string;
}

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

/**
 * Build the prompt for stage 1: Questions
 */
function buildQuestionsPrompt(params: CLIParams): string {
  const { prompt, projectContext, additionalInstructions } = params;

  return `You are a software architecture expert analyzing a project.

## User Request

The user wants to integrate: **${prompt}**

Note: This may be a package name (e.g., "stripe", "auth0") or a description (e.g., "payment processing with Stripe"). Treat it accordingly.

${projectContext ? `
## Project Context

The repository has been pre-analyzed with the following structure:

\`\`\`json
${JSON.stringify(projectContext, null, 2)}
\`\`\`

This context includes:
- All detected targets (packages/modules) with their languages and frameworks
- Package managers used in each target
- Dependency file locations
- Project structure overview
` : ''}

${additionalInstructions ? `
## Additional Instructions

${additionalInstructions}
` : ''}

## Your Task

1. **Analyze the codebase** - Use Read, Glob, Grep tools to understand:
   - IMPORTANT: Always use RELATIVE paths (e.g., "./package.json", "src/index.ts", "README.md")
   - NEVER use absolute paths like "/Users/..." or "/home/..."
   - The working directory is already set correctly, so all paths should be relative to it
   - Start by reading package.json to understand the project type and dependencies
   - Use targeted Glob patterns (e.g., "src/**/*.ts", "app/**/*.tsx") instead of "**/*" to avoid scanning node_modules
   - The project structure and main entry points
   - Existing authentication/integration patterns
   - Package managers and dependencies
   - Framework and language setup

2. **Ask clarifying questions** - You MUST ask 1-4 clarifying questions about:
   - Specific requirements or constraints for the integration
   - Preferences for third-party services vs self-hosted solutions
   - Authentication methods or existing auth patterns to maintain
   - Data storage preferences or existing database patterns
   - Any breaking changes they're willing to accept
   - Scale expectations (current users, growth plans)
   - Budget constraints (API costs, infrastructure)
   - If there are multiple targets in the project always ask which target it should be integrated into.

IMPORTANT:
- You MUST ask at least 1 question - questions are REQUIRED
- Do NOT ask contradictory questions. Questions must be logically consistent with each other.
- You MUST AVOID migrations at all cost, ALWAYS try to make things work side-by-side.
- Act like you're a founder and do it in a simplest way as possible, just make sure it works.
- ALWAYS use Context7 MCP for retrieving up to date documentation for the library or SDK before integration

## Output Format

Output your questions in this EXACT JSON format:

\`\`\`json
{
  "questions": [
    {
      "question": "Your question text?",
      "options": ["Option 1", "Option 2", "Option 3"],
      "additionalInfo": "Optional context about why this matters"
    }
  ]
}
\`\`\`

Rules:
- You MUST provide at least 1 question (1-4 questions is ideal)
- NEVER use vague options like "Not sure", "Recommend me", "Let you decide", "Other", or "I don't know"
- Each option MUST be a specific implementation approach, tool, or technology`;
}

/**
 * Build the prompt for plan metadata
 */
function buildPlanMetadataPrompt(userAnswers: string, difficulty: 'Easy' | 'Medium' | 'Hard', planId: number): string {
  const difficultyDescriptions = {
    'Easy': 'Quick and simple integration with minimal changes, may sacrifice some best practices for speed',
    'Medium': 'Balanced approach with reasonable complexity, follows common patterns',
    'Hard': 'Comprehensive solution with proper architecture, more complex but future-proof'
  };

  const timeEstimates = {
    'Easy': '15 minutes',
    'Medium': '30 minutes',
    'Hard': '1 hour'
  };

  return `Based on the codebase analysis and user requirements:

${userAnswers}

Generate a ${difficulty.toUpperCase()} difficulty integration plan overview.

${difficulty} approach: ${difficultyDescriptions[difficulty]}

IMPORTANT: Do NOT ask any questions. All clarifications were already gathered. Proceed with the plan based on the user's answers above.

You must provide structured metadata:
- id: ${planId}
- difficulty: "${difficulty}"
- title: A short descriptive title (e.g., "${difficulty}: Stripe Checkout Integration")
- description: A single concise sentence (10-15 words max) in plain text describing this specific approach. NO markdown, NO formatting, just plain text.
- estimatedTime: Use exactly "${timeEstimates[difficulty]}" for ${difficulty} difficulty

The description should be plain text only - no markdown, no code formatting, no special characters beyond basic punctuation.`;
}

/**
 * Build the prompt for setup section
 */
function buildSetupPrompt(): string {
  return `Generate the SETUP section for this integration plan.

Provide only the necessary numbered setup steps that can be completed by a coding agent:
- Package installation commands (npm install, etc.)
- Configuration file creation
- Database migrations/schema setup

IMPORTANT:
- Do NOT ask any questions. All clarifications were already gathered. Generate the plan based on the context.
- Only include steps that are actually needed - don't add unnecessary steps just to reach a certain count.
- Only include steps that can be automated through code. Do NOT include manual steps like OAuth app creation, API key generation, or external service configuration (those belong in Next Steps).
- Do NOT include section headers like "## Setup" or "# Setup Section" - just provide the numbered list directly.
- Do NOT include any preamble, introduction, or explanatory text like "I'll generate...", "Here's the...", "Perfect!", etc.
- Do NOT wrap the output in markdown code blocks (\`\`\`) or any other formatting.
- Start IMMEDIATELY with step 1.
- Act like you're a founder and do it in a simplest way as possible, just make sure it works.
- ALWAYS use Context7 MCP for retrieving up to date documentation for the library or SDK before integration

Format as a simple numbered list. Each step should include specific commands.`;
}

/**
 * Build the prompt for integration section
 */
function buildIntegrationPrompt(): string {
  return `Generate the INTEGRATION section for this plan.

Provide only the necessary numbered integration steps covering:
- File changes with exact paths
- Code snippets (what to add/modify)
- API endpoints
- Component modifications
- Database schema changes

IMPORTANT:
- Do NOT ask any questions. All clarifications were already gathered. Generate the plan based on the context.
- Only include steps that are actually needed - don't add unnecessary steps just to reach a certain count.
- ALL steps must be executable by a coding agent. Do NOT include any manual steps like "Sign up for service", "Create API keys", "Configure OAuth app", etc. Those belong in Next Steps.
- Do NOT include section headers like "## Integration" or "# Integration Section" - just provide the numbered list directly.
- Do NOT include any preamble, introduction, or explanatory text like "I'll generate...", "Here's the...", "Perfect!", etc.
- Do NOT wrap the output in markdown code blocks (\`\`\`) or any other formatting.
- Start IMMEDIATELY with step 1.
- Act like you're a founder and do it in a simplest way as possible, just make sure it works.
- ALWAYS use Context7 MCP for retrieving up to date documentation for the library or SDK before integration

Format as a simple numbered list. Include short code snippets (5 lines max) where needed.`;
}

/**
 * Build the prompt for verification section
 */
function buildVerificationPrompt(): string {
  return `Generate the VERIFICATION section for this plan.

Provide only the necessary numbered verification steps with:
- Commands to run
- Expected outputs
- How to confirm success

IMPORTANT:
- Do NOT ask any questions. All clarifications were already gathered. Generate the plan based on the context.
- Only include steps that are actually needed - don't add unnecessary steps just to reach a certain count.
- ALL steps must be executable by a coding agent. Do NOT include any manual steps like "Check dashboard", "Manually test in browser", etc. Those belong in Next Steps.
- Do NOT include section headers like "## Verification" or "# Verification Section" - just provide the numbered list directly.
- Do NOT include any preamble, introduction, or explanatory text like "I'll generate...", "Here's the...", "Perfect!", etc.
- Do NOT wrap the output in markdown code blocks (\`\`\`) or any other formatting.
- Start IMMEDIATELY with step 1.
- Act like you're a founder and do it in a simplest way as possible, just make sure it works.
- ALWAYS use Context7 MCP for retrieving up to date documentation for the library or SDK before integration

Format as a simple numbered list.`;
}

/**
 * Build the prompt for next steps section
 */
function buildNextStepsPrompt(): string {
  return `Generate the NEXT STEPS section for this plan.

Provide only the necessary numbered manual steps for:
- External service configuration
- DNS/domain setup
- Production deployment

IMPORTANT:
- Do NOT ask any questions. All clarifications were already gathered. Generate the plan based on the context.
- Only include steps that are actually needed - don't add unnecessary steps just to reach a certain count.
- Do NOT include section headers like "## Next Steps" or "# Next Steps Section" - just provide the numbered list directly.
- Do NOT include any preamble, introduction, or explanatory text like "I'll generate...", "Here's the...", "Perfect!", etc.
- Do NOT wrap the output in markdown code blocks (\`\`\`) or any other formatting.
- Start IMMEDIATELY with step 1, or if no steps are needed, output "No manual steps required."
- Act like you're a founder and do it in a simplest way as possible, just make sure it works.
- ALWAYS use Context7 MCP for retrieving up to date documentation for the library or SDK before integration

If no manual steps are needed, just say "No manual steps required."
Format as a simple numbered list (or the no-steps message).`;
}

/**
 * Build the prompt for summarizing a section
 */
function buildSummarizePrompt(sectionName: string, sectionContent: string): string {
  return `You are summarizing the ${sectionName} section of an integration plan.

Section content:
${sectionContent}

Generate a brief, plain text summary (1-2 sentences, max 20 words) that captures the essence of this section.
Output ONLY the summary text - no markdown, no formatting, no special characters beyond basic punctuation.`;
}

/**
 * Create an interactive selection box for multiple choice questions
 */
async function selectOptions(questions: Question[]): Promise<string> {
  const answers: string[] = [];

  for (const q of questions) {
    if (q.additionalInfo) {
      console.error(`\nℹ️  ${q.additionalInfo}\n`);
    }

    const answer = await select({
      message: q.question,
      choices: q.options.map((opt: string) => ({
        name: opt,
        value: opt
      }))
    });

    answers.push(`Q: ${q.question}\nA: ${answer}`);
  }

  return answers.join('\n\n');
}

/**
 * Run the planner agent through all stages
 */
async function runPlanner(params: CLIParams): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const npmGlobalBin = '/home/vercel-sandbox/.global/npm/bin';
  process.env.PATH = `${npmGlobalBin}:${process.env.PATH}`;

  const cwd = params.cwd || process.cwd();
  console.error(`Working directory: ${cwd}`);

  // Determine starting stage
  const startingStage = params.stage || 'start';
  let sessionId = params.sessionId || '';
  let userAnswers = '';

  // If clarifications are provided, skip questions stage and use them
  if (params.clarifications) {
    userAnswers = params.clarifications;
    outputStage('plan1', params.outputMode);
  }
  // Stage: Start (questions stage)
  else if (startingStage === 'start') {
    outputStage('start', params.outputMode);
    console.error('\n=== Stage 1: Analyzing codebase and gathering requirements ===\n');
    const questionsPrompt = buildQuestionsPrompt(params);
    const result = await runStructuredStage<QuestionsOutput>(
      questionsPrompt,
      QuestionsOutputSchema,
      cwd,
      params.outputMode,
      params.sessionId // Resume from existing session if provided
    );
    sessionId = result.sessionId;

    // Output stage transition
    outputStage('questions', params.outputMode);

    // Output questions as internal message
    const questionsMessage: InternalMessage = {
      type: 'questions',
      questions: result.output.questions || []
    };

    if (params.outputMode === 'json') {
      console.log(JSON.stringify(questionsMessage));
    } else {
      displayInternalMessage(questionsMessage);
    }

    // Handle questions - they should always be present
    if (result.output.questions && result.output.questions.length > 0) {
      if (params.outputMode === 'json') {
        // In JSON mode, output questions and exit - the API will restart with clarifications
        console.error('\n[Questions outputted, exiting. API will restart with clarifications]');
        process.exit(0);
      } else {
        // In pretty mode, show interactive selector
        userAnswers = await selectOptions(result.output.questions);
        console.error(`\n[Submitting answers to agent...]\n`);
      }
    } else {
      // This should not happen - questions are required
      console.error('\n[ERROR] No questions were generated. This should not happen.');
      console.error('[ERROR] Questions are required for proper plan generation.');
      throw new Error('Questions are required but none were generated');
    }
  } else if (startingStage === 'questions') {
    // If resuming from questions stage, we cannot proceed without conversation history
    // This stage is meant to be handled by providing clarifications directly
    console.error('[ERROR] Cannot resume from questions stage without clarifications');
    console.error('[Please provide --clarifications argument to continue]');
    throw new Error('Resuming from questions stage requires --clarifications argument');
  }

  // Generate first plan (Easy) fully by default, metadata for others
  // If planId is specified, generate full plan for that specific ID only
  console.error(`[DEBUG] params.planId = ${params.planId}`);

  const difficulties: Array<{ difficulty: 'Easy' | 'Medium' | 'Hard'; id: number; fullPlan: boolean }> = [
    { difficulty: 'Easy', id: 1, fullPlan: params.planId === 1 || !params.planId },   // Full by default or if specifically requested
    { difficulty: 'Medium', id: 2, fullPlan: params.planId === 2 },  // Full only if specifically requested
    { difficulty: 'Hard', id: 3, fullPlan: params.planId === 3 }     // Full only if specifically requested
  ];

  const completePlans: IntegrationPlan[] = [];

  // Determine which plans to generate based on starting stage or planId filter
  const shouldSkipPlan = (planId: number): boolean => {
    // If specific planId requested, skip all others
    if (params.planId && params.planId !== planId) {
      return true;
    }

    if (startingStage === 'start' || startingStage === 'questions') return false;

    // Parse stage format: plan1, plan2, plan3
    const stageMatch = startingStage.match(/^plan(\d+)$/);
    if (!stageMatch) return false;

    const stagePlanId = parseInt(stageMatch[1]);
    return planId < stagePlanId;
  };

  for (const { difficulty, id, fullPlan } of difficulties) {
    console.error(`[DEBUG] Checking plan ${id} (${difficulty}), shouldSkip=${shouldSkipPlan(id)}, fullPlan=${fullPlan}`);

    if (shouldSkipPlan(id)) {
      if (params.planId) {
        console.error(`[DEBUG] Skipping ${difficulty} Plan ${id} - not requested (planId=${params.planId})`);
      } else {
        console.error(`\n[Skipping ${difficulty} Plan - already completed in previous session]\n`);
      }
      continue;
    }

    if (fullPlan) {
      console.error(`\n\n=== Generating ${difficulty} Plan (${id}/3) - FULL PLAN ===\n`);
    } else {
      console.error(`\n\n=== Generating ${difficulty} Plan (${id}/3) - METADATA ONLY ===\n`);
    }

    // Output stage for this plan
    outputStage(`plan${id}` as Stage, params.outputMode);

    // Generate plan metadata using structured output
    console.error(`Generating ${difficulty} plan overview...`);
    console.error(`[DEBUG] Resuming with session ID: ${sessionId || '(none)'}`);
    const metadataResult = await runStructuredStage<{ plan: PlanMetadata }>(
      buildPlanMetadataPrompt(userAnswers, difficulty, id),
      PlanMetadataOutputSchema,
      cwd,
      params.outputMode,
      sessionId
    );
    console.error(`[DEBUG] Received session ID: ${metadataResult.sessionId}`);
    sessionId = metadataResult.sessionId;

    // Fallback if structured output is missing or malformed
    const metadata: PlanMetadata = metadataResult.output?.plan || {
      id,
      difficulty,
      title: `${difficulty}: Integration Plan`,
      description: `${difficulty} difficulty integration plan for ${params.prompt}`,
      estimatedTime: difficulty === 'Easy' ? '15 minutes' : difficulty === 'Medium' ? '30 minutes' : '1 hour'
    };

    let setupText = '';
    let setupSummary = '';
    let integrationText = '';
    let integrationSummary = '';
    let verificationText = '';
    let verificationSummary = '';
    let nextStepsText = '';
    let nextStepsSummary = '';

    // Only generate full sections for fullPlan
    if (fullPlan) {
      // Generate setup section
      console.error(`Generating ${difficulty} setup section...`);
      const setupResult = await runTextStage(
        buildSetupPrompt(),
        cwd,
        params.outputMode,
        sessionId
      );
      sessionId = setupResult.sessionId;
      setupText = setupResult.response;

      // Summarize setup section
      console.error(`Summarizing setup section...`);
      const setupSummaryResult = await runTextStage(
        buildSummarizePrompt('Setup', setupText),
        cwd,
        params.outputMode,
        sessionId
      );
      sessionId = setupSummaryResult.sessionId;
      setupSummary = setupSummaryResult.response.trim();

      // Generate integration section
      console.error(`Generating ${difficulty} integration section...`);
      const integrationResult = await runTextStage(
        buildIntegrationPrompt(),
        cwd,
        params.outputMode,
        sessionId
      );
      sessionId = integrationResult.sessionId;
      integrationText = integrationResult.response;

      // Summarize integration section
      console.error(`Summarizing integration section...`);
      const integrationSummaryResult = await runTextStage(
        buildSummarizePrompt('Integration', integrationText),
        cwd,
        params.outputMode,
        sessionId
      );
      sessionId = integrationSummaryResult.sessionId;
      integrationSummary = integrationSummaryResult.response.trim();

      // Generate verification section
      console.error(`Generating ${difficulty} verification section...`);
      const verificationResult = await runTextStage(
        buildVerificationPrompt(),
        cwd,
        params.outputMode,
        sessionId
      );
      sessionId = verificationResult.sessionId;
      verificationText = verificationResult.response;

      // Summarize verification section
      console.error(`Summarizing verification section...`);
      const verificationSummaryResult = await runTextStage(
        buildSummarizePrompt('Verification', verificationText),
        cwd,
        params.outputMode,
        sessionId
      );
      sessionId = verificationSummaryResult.sessionId;
      verificationSummary = verificationSummaryResult.response.trim();

      // Generate next steps section
      console.error(`Generating ${difficulty} next steps section...`);
      const nextStepsResult = await runTextStage(
        buildNextStepsPrompt(),
        cwd,
        params.outputMode,
        sessionId
      );
      sessionId = nextStepsResult.sessionId;
      nextStepsText = nextStepsResult.response;

      // Summarize next steps section
      console.error(`Summarizing next steps section...`);
      const nextStepsSummaryResult = await runTextStage(
        buildSummarizePrompt('Next Steps', nextStepsText),
        cwd,
        params.outputMode,
        sessionId
      );
      sessionId = nextStepsSummaryResult.sessionId;
      nextStepsSummary = nextStepsSummaryResult.response.trim();
    } else {
      console.error(`Skipping detailed sections for ${difficulty} plan (metadata only)`);
    }

    // Combine into structured plan
    {
      const plan: IntegrationPlan = {
        id,
        title: metadata.title,
        description: metadata.description,
        estimatedTime: metadata.estimatedTime,
        difficulty,
        sections: {
          setup: setupText ? [setupText] : [],
          integration: integrationText ? [integrationText] : [],
          verification: verificationText ? [verificationText] : [],
          nextSteps: nextStepsText ? [nextStepsText] : []
        },
        summaries: {
          setup: setupSummary,
          integration: integrationSummary,
          verification: verificationSummary,
          nextSteps: nextStepsSummary
        }
      };
      completePlans.push(plan);

      // Output plan as internal message
      const planMessage: InternalMessage = {
        type: 'plan',
        plan
      };

      if (params.outputMode === 'json') {
        console.log(JSON.stringify(planMessage));
      } else {
        displayInternalMessage(planMessage);
      }

      console.error(`\n${difficulty} plan complete!\n`);
    }
  }

  console.error(`\n\nAll plans generated!\n`);

  // Output complete stage
  outputStage('complete', params.outputMode);

  // Output the plans
  if (params.outputMode === 'pretty') {
    console.error('\n\n=== Integration Plans ===\n');
    for (const plan of completePlans) {
      console.error(`\n## ${plan.difficulty.toUpperCase()} PLAN\n`);
      console.error(`${plan.description}\n`);
      if (plan.sections.setup[0]) {
        console.error(`\n### Setup\n${plan.sections.setup[0]}\n`);
      }
      if (plan.sections.integration[0]) {
        console.error(`\n### Integration\n${plan.sections.integration[0]}\n`);
      }
      if (plan.sections.verification[0]) {
        console.error(`\n### Verification\n${plan.sections.verification[0]}\n`);
      }
      if (plan.sections.nextSteps[0]) {
        console.error(`\n### Next Steps\n${plan.sections.nextSteps[0]}\n`);
      }
      console.error('---\n');
    }
  }
}


/**
 * Main entry point
 */
async function main() {
  const program = new Command();

  program
    .name('planner-cli')
    .description('Integration planning tool using Claude Agent SDK')
    .version('0.1.0');

  // Plan subcommand (default)
  program
    .command('plan', { isDefault: true })
    .description('Generate integration plans for a project')
    .requiredOption('--prompt <text>', 'User prompt describing the task')
    .option('--project-context <json>', 'Project context as JSON string')
    .option('--cwd <path>', 'Working directory (defaults to current directory)')
    .option('--output-mode <mode>', 'Output mode: json or pretty', 'json')
    .option('--session-id <id>', 'Session ID to resume from')
    .option('--stage <stage>', 'Stage to resume from (start, questions, plan1, plan2, plan3, complete)')
    .option('--clarifications <text>', 'Answers to clarification questions (formatted as: 1. Question\\nAnswer: answer\\n\\n2. ...)')
    .option('--plan-id <id>', 'Generate specific plan only (1=Medium, 2=Easy, 3=Hard). If not specified, generates Medium full plan + Easy/Hard metadata.')
    .option('--additional-instructions <text>', 'Additional instructions to include in the prompt')
    .addHelpText('after', '\nEnvironment Variables:\n  ANTHROPIC_API_KEY    Anthropic API key (required)')
    .action(async (options) => {
      try {
        const cwd = options.cwd || process.cwd();
        console.error(`Initial working directory: ${cwd}`);

        if (options.outputMode !== 'json' && options.outputMode !== 'pretty') {
          throw new Error('Invalid output mode. Must be "json" or "pretty"');
        }

        let projectContext;
        if (options.projectContext) {
          projectContext = JSON.parse(options.projectContext);
        } else {
          if (options.outputMode === 'pretty') {
            console.error('Analyzing repository structure...');
          }
          projectContext = await analyzeRepositoryV2(cwd);
          if (options.outputMode === 'pretty') {
            console.error('Project context built successfully\n');
          }
        }

        const params: CLIParams = {
          prompt: options.prompt,
          projectContext,
          cwd,
          outputMode: options.outputMode,
          sessionId: options.sessionId,
          stage: options.stage as Stage | undefined,
          clarifications: options.clarifications,
          planId: options.planId ? parseInt(options.planId) : undefined,
          additionalInstructions: options.additionalInstructions
        };

        await runPlanner(params);
      } catch (error) {
        console.error(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : ''
        }));
        process.exit(1);
      }
    });

  // Compile subcommand
  program
    .command('compile')
    .description('Compile notes/transcripts into structured documents')
    .requiredOption('--transcript-file <path>', 'Path to file containing transcript')
    .requiredOption('--doc-type <type>', 'Document type: design-doc, prd, rfp, sow, technical-spec, user-story')
    .option('--session-id <text>', 'ID of the previous session', 'session id')
    .option('--output-mode <mode>', 'Output mode: json or pretty', 'json')
    .option('--clarifications <text>', 'Answers to clarification questions (formatted as: 1. Question\\nAnswer: answer\\n\\n2. ...)')
    .option('--cwd <path>', 'Working directory', process.cwd())
    .action(async (options) => {
      try {
        if (options.outputMode !== 'json' && options.outputMode !== 'pretty') {
          throw new Error('Invalid output mode. Must be "json" or "pretty"');
        }

        const compiler = new DocumentCompiler(options.cwd, options.outputMode);
        if (!options.clarifications) {
          const result = await compiler.clarify(options.transcriptFile, options.docType);

          // Output questions using InternalMessage type
          const questionsMessage: InternalMessage = {
            type: 'questions',
            questions: result.questions.questions || []
          };

          if (options.outputMode === 'json') {
            console.log(JSON.stringify(questionsMessage));
          } else {
            console.log('\n=== Questions produced ===\n');
            console.log(`Questions ${JSON.stringify(result.questions, null, 2)}`);
          }
          return;
        }
        if (!options.sessionId) {
          throw new Error('Session ID is required to continue the document generation.');
        }
        const outputFilePath = await compiler.compile(options.sessionId, options.clarifications, options.transcriptFile, options.docType);

        // Read the generated document
        // Check if the path is already absolute or starts from repo root
        let absolutePath: string;
        if (isAbsolute(outputFilePath)) {
          absolutePath = outputFilePath;
        } else if (existsSync(outputFilePath)) {
          // Path is relative to CWD where CLI is run from
          absolutePath = resolve(outputFilePath);
        } else {
          // Try resolving relative to options.cwd
          absolutePath = resolve(options.cwd, outputFilePath);
        }

        if (!existsSync(absolutePath)) {
          throw new Error(`Document file was not generated at expected path: ${absolutePath}\nOriginal path from compiler: ${outputFilePath}`);
        }

        const documentContent = readFileSync(absolutePath, 'utf-8');

        if (options.outputMode === 'json') {
          // Create a plan message with the document content
          const documentPlan: IntegrationPlan = {
            id: 1,
            title: `${options.docType.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
            description: `Generated ${options.docType} document`,
            estimatedTime: '',
            difficulty: 'Medium',
            sections: {
              setup: [],
              integration: [],
              verification: [],
              nextSteps: [documentContent]
            },
            summaries: {
              setup: '',
              integration: `Full ${options.docType} document`,
              verification: '',
              nextSteps: ''
            }
          };

          const planMessage: InternalMessage = {
            type: 'plan',
            plan: documentPlan
          };

          console.log(JSON.stringify(planMessage));

          // Also output complete message
          const completeMessage: InternalMessage = {
            type: 'complete',
            document: outputFilePath
          };
          console.log(JSON.stringify(completeMessage));
        } else {
          console.error('\n=== Document Generated ===\n');
          console.error(`File: ${outputFilePath}\n`);
          console.error('---\n');
          console.error(documentContent);
          console.error('\n---\n');
        }
      } catch (error) {
        console.error(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : ''
        }));
        process.exit(1);
      }
    });

  // Compile2 subcommand - multi-stage document generation with sections, questions, and variants
  program
    .command('compile2')
    .description('Compile notes/transcripts into structured documents (multi-stage: sections → questions → variants)')
    .requiredOption('--transcript-file <path>', 'Path to file containing transcript')
    .requiredOption('--doc-type <type>', 'Document type: design-doc, prd, rfp, sow, technical-spec, user-story')
    .option('--session-id <text>', 'ID of the previous session')
    .option('--sections-file <path>', 'Path to save sections to (default: sections.json)')
    .option('--questions-file <path>', 'Path to save questions to (default: questions.json)')
    .option('--log-file <path>', 'Path to save log output to (default: compile.log)')
    .option('--cwd <path>', 'Working directory (session directory)', process.cwd())
    .action(async (options) => {
      try {
        const result = await runCompile2({
          transcriptFile: options.transcriptFile,
          docType: options.docType,
          sessionId: options.sessionId,
          sectionsFile: options.sectionsFile,
          questionsFile: options.questionsFile,
          logFile: options.logFile,
          cwd: options.cwd
        });

        // Output result to stdout for API consumption
        console.log(JSON.stringify(result));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';

        console.error(JSON.stringify({
          type: 'error',
          error: errorMessage,
          stack: errorStack
        }));

        process.exit(1);
      }
    });

  // Register execute subcommand
  registerExecuteCommand(program);

  await program.parseAsync(process.argv);
}

main();
