import { readFileSync, writeFileSync, existsSync, createWriteStream, mkdirSync } from 'fs';
import { resolve, isAbsolute, join } from 'path';
import {
  QuestionsOutputSchema,
  runStructuredStage,
  type QuestionsOutput,
} from './index.js';
import z from 'zod';

export interface Compile2Options {
  transcriptFile: string;
  docType: string;
  sessionId?: string;
  sectionsFile?: string;
  questionsFile?: string;
  logFile?: string;
  cwd: string; // Working directory (session directory)
}

export interface Compile2Result {
  type: 'sections_saved' | 'questions_saved' | 'variants_generated';
  sectionsFile?: string;
  questionsFile?: string;
  variantsDir?: string;
  sessionId?: string;
  sectionCount?: number;
  questionCount?: number;
  variantCount?: number;
}

// Schema for sections output
const SectionsOutputSchema = z.object({
  sections: z.array(
    z.object({
      sectionId: z.string().describe('Unique section identifier (lowercase, hyphenated, e.g., "executive-summary"). This will be used as the directory name.'),
      title: z.string().describe('Section title'),
      description: z.string().describe('Brief description of what this section should contain'),
    })
  ).describe('List of document sections to generate'),
});

type SectionsOutput = z.infer<typeof SectionsOutputSchema>;

// Schema for section variant output
const SectionVariantOutputSchema = z.object({
  outputFilePath: z.string().describe('The relative path to the file where the section variant was written')
});

/**
 * Compile2 - Multi-stage document compilation
 * Stage 1: Generate sections list
 * Stage 2: Ask clarifying questions
 * Stage 3: Generate 3 variants per section (with refinement pass)
 */
export class Compile2Runner {
  private logStream: any;
  private options: Compile2Options;

  constructor(options: Compile2Options) {
    this.options = options;

    // Set up log file
    const logFilePath = options.logFile || join(options.cwd, 'compile.log');
    this.logStream = createWriteStream(logFilePath, { flags: 'a' });
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.logStream.write(`[${timestamp}] ${message}\n`);
  }

  /**
   * Run the compile2 process
   */
  async run(): Promise<Compile2Result> {
    try {
      this.log('Starting compile2 command');
      this.log(`Transcript file: ${this.options.transcriptFile}`);
      this.log(`Doc type: ${this.options.docType}`);
      this.log(`CWD: ${this.options.cwd}`);
      this.log(`Write validation enabled for session directory: ${this.options.cwd}`);

      // Determine which stage we're at by checking for input files
      const userSectionsPath = join(this.options.cwd, 'inputs', 'user_sections.json');
      const answersPath = join(this.options.cwd, 'inputs', 'answers.json');

      const hasUserSections = existsSync(userSectionsPath);
      const hasAnswers = existsSync(answersPath);

      this.log(`Checking stage: hasUserSections=${hasUserSections}, hasAnswers=${hasAnswers}`);

      if (!hasUserSections) {
        // Stage 1: Generate sections
        return await this.handleSectionsGeneration();
      } else if (!hasAnswers) {
        // Stage 2: Ask questions (sections approved, no answers yet)
        return await this.handleQuestions();
      } else {
        // Stage 3: Generate variants (sections + answers provided)
        return await this.handleVariantGeneration();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';

      this.log(`ERROR: ${errorMessage}`);
      if (errorStack) {
        this.log(`Stack trace: ${errorStack}`);
      }

      this.logStream.end();
      throw error;
    }
  }

  /**
   * Stage 1: Generate document sections
   */
  private async handleSectionsGeneration(): Promise<Compile2Result> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.log('Stage 1: Generating document sections...');

    // Read prompt from file
    const sectionsPromptPath = join(this.options.cwd, 'inputs', 'sections_prompt.txt');
    if (!existsSync(sectionsPromptPath)) {
      throw new Error(`Sections prompt file not found: ${sectionsPromptPath}`);
    }
    const sectionsPrompt = readFileSync(sectionsPromptPath, 'utf-8');

    // Call Claude SDK to generate sections
    const result = await runStructuredStage<SectionsOutput>(
      sectionsPrompt,
      SectionsOutputSchema,
      this.options.cwd,
      'json',
      this.options.sessionId,
      (msg) => this.log(msg),
      'haiku',
      3,
      this.options.cwd // Restrict writes to session directory
    );

    // Save sections to file
    const sectionsFilePath = this.options.sectionsFile || join(this.options.cwd, 'sections.json');
    const sectionsData = {
      sessionId: result.sessionId,
      sections: result.output.sections || []
    };

    writeFileSync(sectionsFilePath, JSON.stringify(sectionsData, null, 2), 'utf-8');

    this.log(`Sections saved to: ${sectionsFilePath}`);
    this.log(`Generated ${sectionsData.sections.length} sections`);
    this.logStream.end();

    return {
      type: 'sections_saved',
      sectionsFile: sectionsFilePath,
      sessionId: result.sessionId,
      sectionCount: sectionsData.sections.length,
    };
  }

  /**
   * Stage 2: Ask clarifying questions based on approved sections
   */
  private async handleQuestions(): Promise<Compile2Result> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.log('Stage 2: Asking clarifying questions...');

    // Read user approved sections from file
    const userSectionsPath = join(this.options.cwd, 'inputs', 'user_sections.json');
    const sections = JSON.parse(readFileSync(userSectionsPath, 'utf-8'));
    this.log(`Using ${sections.length} approved sections from ${userSectionsPath}`);

    // Read prompt from file
    const questionsPromptPath = join(this.options.cwd, 'inputs', 'questions_prompt.txt');
    if (!existsSync(questionsPromptPath)) {
      throw new Error(`Questions prompt file not found: ${questionsPromptPath}`);
    }
    const questionsPrompt = readFileSync(questionsPromptPath, 'utf-8');

    // Call Claude SDK to get questions
    const result = await runStructuredStage<QuestionsOutput>(
      questionsPrompt,
      QuestionsOutputSchema,
      this.options.cwd,
      'json',
      this.options.sessionId,
      (msg) => this.log(msg),
      'haiku',
      3,
      this.options.cwd // Restrict writes to session directory
    );

    // Save questions to file
    const questionsFilePath = this.options.questionsFile || join(this.options.cwd, 'questions.json');
    const questionsData = {
      sessionId: result.sessionId,
      questions: result.output.questions || []
    };

    writeFileSync(questionsFilePath, JSON.stringify(questionsData, null, 2), 'utf-8');

    this.log(`Questions saved to: ${questionsFilePath}`);
    this.log(`Generated ${questionsData.questions.length} questions`);
    this.logStream.end();

    return {
      type: 'questions_saved',
      questionsFile: questionsFilePath,
      sessionId: result.sessionId,
      questionCount: questionsData.questions.length,
    };
  }

  /**
   * Stage 3: Generate 3 variants per section with refinement pass
   */
  private async handleVariantGeneration(): Promise<Compile2Result> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.log('Stage 3: Generating section variants...');

    // Read user sections and answers from input files
    const userSectionsPath = join(this.options.cwd, 'inputs', 'user_sections.json');
    const answersPath = join(this.options.cwd, 'inputs', 'answers.json');

    const sections = JSON.parse(readFileSync(userSectionsPath, 'utf-8'));
    const answers = JSON.parse(readFileSync(answersPath, 'utf-8'));

    this.log(`Generating 3 variants for ${sections.length} sections`);
    this.log(`Using answers from ${answersPath}`);

    // Read variant prompts from file
    const variantsPromptsPath = join(this.options.cwd, 'inputs', 'variants_prompts.json');
    if (!existsSync(variantsPromptsPath)) {
      throw new Error(`Variants prompts file not found: ${variantsPromptsPath}`);
    }
    const variantPrompts = JSON.parse(readFileSync(variantsPromptsPath, 'utf-8'));

    let totalVariants = 0;

    // Create sections directory
    const sectionsBaseDir = join(this.options.cwd, 'sections');
    if (!existsSync(sectionsBaseDir)) {
      mkdirSync(sectionsBaseDir, { recursive: true });
      this.log(`Created sections directory: ${sectionsBaseDir}`);
    }

    // Prepare all directories first
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionId = section.sectionId;

      // Create section directory under sections/
      const sectionDir = join(sectionsBaseDir, sectionId);
      if (!existsSync(sectionDir)) {
        mkdirSync(sectionDir, { recursive: true });
      }

      // Create refined subdirectory
      const refinedDir = join(sectionDir, 'refined');
      if (!existsSync(refinedDir)) {
        mkdirSync(refinedDir, { recursive: true });
      }

      this.log(`Prepared directories for section: ${section.title}`);
    }

    // Generate all variants in parallel
    const variantTasks = [];

    for (const variantPromptData of variantPrompts) {
      const { sectionId, variantNumber, generatePrompt, refinePrompt } = variantPromptData;

      // Find the section object for logging
      const section = sections.find((s: any) => s.sectionId === sectionId);
      if (!section) {
        this.log(`Warning: Section ${sectionId} not found in sections list, skipping`);
        continue;
      }

      const sectionDir = join(sectionsBaseDir, sectionId);
      const refinedDir = join(sectionDir, 'refined');

      const task = (async () => {
        this.log(`Starting generation: ${section.title} - Variant ${variantNumber}/3`);

        // Pass 1: Generate initial variant in section directory
        this.log(`  Write validation restricted to: ${sectionDir}`);

        const generateResult = await runStructuredStage<z.infer<typeof SectionVariantOutputSchema>>(
          generatePrompt,
          SectionVariantOutputSchema,
          sectionDir,
          'json',
          this.options.sessionId,
          (msg) => this.log(msg),
          'haiku',
          3,
          sectionDir // Restrict writes to section directory only
        );

        const initialFilePath = join(sectionDir, `variant-${variantNumber}.md`);
        this.log(`  Initial draft complete: ${section.title} - Variant ${variantNumber}`);

        // Pass 2: Refine the variant in refined subdirectory
        this.log(`  Write validation restricted to: ${refinedDir}`);

        await runStructuredStage<z.infer<typeof SectionVariantOutputSchema>>(
          refinePrompt,
          SectionVariantOutputSchema,
          refinedDir,
          'json',
          this.options.sessionId,
          (msg) => this.log(msg),
          'haiku',
          3,
          refinedDir // Restrict writes to refined directory only
        );

        this.log(`  Refinement complete: ${section.title} - Variant ${variantNumber}`);
        return 1; // Return 1 for counting
      })();

      variantTasks.push(task);
    }

    this.log(`\nGenerating ${variantTasks.length} variants in parallel...`);

    // Wait for all variants to complete
    const results = await Promise.all(variantTasks);
    totalVariants = results.reduce((sum, count) => sum + count, 0);

    this.log(`\nCompleted: Generated ${totalVariants} variants for ${sections.length} sections`);
    this.logStream.end();

    return {
      type: 'variants_generated',
      variantsDir: this.options.cwd,
      variantCount: totalVariants,
    };
  }
}

/**
 * Factory function to create and run a Compile2Runner
 */
export async function runCompile2(options: Compile2Options): Promise<Compile2Result> {
  const runner = new Compile2Runner(options);
  return await runner.run();
}
