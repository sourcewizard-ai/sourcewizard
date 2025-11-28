/**
 * Planner CLI Library
 *
 * Exports schemas and types for integration planning.
 */

import { z } from 'zod';

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
