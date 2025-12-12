import z from 'zod';
import {
  QuestionsOutputSchema,
  runStructuredStage,
  type QuestionsOutput,
  Stage,
  InternalMessage,
} from './index.js';

interface ClarifyingResult {
  questions: QuestionsOutput;
  sessionId: string;
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

// Schema for document compilation output
const DocumentOutputSchema = z.object({
  outputFilePath: z.string().describe('The relative path to the file where the document was written')
});

/**
 * Document Compiler - Converts transcripts/notes into structured documents
 */
export class DocumentCompiler {
  private outputMode: 'json' | 'pretty';
  private cwd: string;
  private docTypeLabels: Record<string, string> = {
    'design-doc': 'Technical Design Document',
    'brd': 'BRD (Business Requirements Document)',
    'prd': 'PRD (Product Requirements Document)',
    'rfp': 'RFP (Request for Proposal)',
    'sow': 'SOW (Statement of Work)',
    'technical-spec': 'Technical Specification',
    'user-story': 'User Stories',
  };

  private docQuestions: Record<string, string[]> = {
    'brd': [
      'What problem are we solving?',
      'Who is it for?',
      'Why does it matter (business impact)?',
      'What does success look like (metrics / outcomes)?',
      'What must the solution do (requirements)?',
      'What constraints exist (tech, legal, timeline, budget)?',
      'What is explicitly out of scope?',
      'How will we know it\'s done (acceptance criteria)?',
    ],

  };

  constructor(cwd: string, outputMode: 'json' | 'pretty' = 'json') {
    this.cwd = cwd;
    this.outputMode = outputMode;
  }

  /**
   * Build the prompt for asking clarifying questions for the document
   */
  private askQuestionsPrompt(filePath: string, docType: string): string {

    const docLabel = this.docTypeLabels[docType] || 'Document';
    const docQuestions = this.docQuestions[docType] || this.docQuestions['brd'];

    return `You are a senior technical manager creating a ${docLabel} from meeting notes.

The transcript is in a file at: ${filePath}

Your task:
1. Read the transcript file
2. Analyze the content
3. **Ask clarifying questions** - You MUST ask 1-4 clarifying questions about:
   - Specific requirements or constraints for the implementation
   - Preferences for third-party services vs self-hosted solutions
   - Authentication methods or existing auth patterns to maintain
   - Data storage preferences or existing database patterns
   - Any breaking changes they're willing to accept
   - Scale expectations (current users, growth plans)
   - Budget constraints (API costs, infrastructure)

The purpose of this document is to answer these questions:
${docQuestions.join('\n')}
If any of these are unclear from the transcript ask for clarification.

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
   * Build the prompt for document compilation from file
   */
  private buildDocumentPrompt(clarifications: string, filePath: string, docType: string): string {
    const docLabel = this.docTypeLabels[docType] || 'Document';
    const docQuestions = this.docQuestions[docType] || this.docQuestions['brd'];

    return `You are a senior technical manager creating a ${docLabel} from meeting notes.

The transcript is in a file at: ${filePath}
Clarifications: ${clarifications}

Your task:
1. Read the transcript file
2. Analyze the content and clarifications
3. Write a structured ${docLabel} to a file based on clarifications

The purpose of this document is to answer these questions:
${docQuestions.join('\n')}
Make sure to create a document focused on answering these questions.
The document should be comprehensive but concise and follow standard ${docLabel} structure.

IMPORTANT:
- Do NOT ask any questions. All clarifications were already gathered. Generate the plan based on the context.
- Don't include details that are not mentioned in the transcript.
- Don't generate document date, add a placeholder.
- Don't make decisions by yourself.

After writing the document, return the relative path to the output file in the structured output.`;
  }

  private refineDocumentPrompt(clarifications: string, filePath: string, transcriptFilePath: string, docType: string): string {
    const docLabel = this.docTypeLabels[docType] || 'Document';
    const docQuestions = this.docQuestions[docType] || this.docQuestions['brd'];

    return `You are a technical consultant working on a ${docLabel} and meeting notes.

The document is in a file at: ${filePath}
The transcript is in a file at: ${transcriptFilePath}
Clarifications: ${clarifications}

Your task:
1. Read the document
2. Analyze the content and clarifications
3. Refine the document, make it more concise and verify against the meeting notes transcript.

The purpose of this document is to answer these questions:
${docQuestions.join('\n')}
Make sure that the document is focused on answering these questions.

IMPORTANT:
- Do NOT ask any questions. All clarifications were already gathered. Generate the plan based on the context.

Write the refined document to a new path, and return the relative path to the output file in the structured output.`;
  }

  async clarify(transcriptFilePath: string, docType: string): Promise<ClarifyingResult> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    outputStage('start', this.outputMode);

    const questionsPrompt = this.askQuestionsPrompt(transcriptFilePath, docType);

    const result = await runStructuredStage<QuestionsOutput>(
      questionsPrompt,
      QuestionsOutputSchema,
      this.cwd,
      this.outputMode,
      undefined, // sessionId
      undefined, // logCallback
      'haiku',   // model
      3,         // maxRetries
      this.cwd   // allowedWriteDir
    );

    outputStage('questions', this.outputMode);

    return {
      questions: result.output,
      sessionId: result.sessionId,
    };
  }

  /**
   * Generate a document from transcript file and return the output file path
   */
  async compile(sessionId: string, clarifications: string, transcriptFilePath: string, docType: string): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    outputStage('plan1', this.outputMode);

    const buildPrompt = this.buildDocumentPrompt(clarifications, transcriptFilePath, docType);

    const initialResult = await runStructuredStage<z.infer<typeof DocumentOutputSchema>>(
      buildPrompt,
      DocumentOutputSchema,
      this.cwd,
      this.outputMode,
      sessionId,
      undefined, // logCallback
      'haiku',   // model
      3,         // maxRetries
      this.cwd   // allowedWriteDir - enables write tracking
    );

    // Get the actual file path from the Write tool call
    const initialFilePath = initialResult.lastWrittenFilePath;
    if (!initialFilePath) {
      throw new Error('No file was written during document generation');
    }

    const prompt = this.refineDocumentPrompt(clarifications, initialFilePath, transcriptFilePath, docType);
    const refinedResult = await runStructuredStage<z.infer<typeof DocumentOutputSchema>>(
      prompt,
      DocumentOutputSchema,
      this.cwd,
      this.outputMode,
      undefined, // sessionId
      undefined, // logCallback
      'haiku',   // model
      3,         // maxRetries
      this.cwd   // allowedWriteDir - enables write tracking
    );

    // Get the actual refined file path from the Write tool call
    const refinedFilePath = refinedResult.lastWrittenFilePath;
    if (!refinedFilePath) {
      throw new Error('No file was written during document refinement');
    }

    outputStage('complete', this.outputMode);

    return refinedFilePath;
  }
}
