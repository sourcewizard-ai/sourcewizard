import * as z from "zod";

// Repository Action Schema
export const RepositoryActionSchema = z.object({
  command: z.string(),
});

// Repository Actions Schema
export const RepositoryActionsSchema = z.object({
  build: z.array(RepositoryActionSchema),
  test: z.array(RepositoryActionSchema),
  deploy: z.array(RepositoryActionSchema),
  dev: z.array(RepositoryActionSchema),
  lint: z.array(RepositoryActionSchema),
  format: z.array(RepositoryActionSchema),
  install: z.array(RepositoryActionSchema),
  clean: z.array(RepositoryActionSchema),
  check: z.array(RepositoryActionSchema),
  add: z.array(RepositoryActionSchema),
}).catchall(z.array(RepositoryActionSchema));

// Target Info Schema
export const TargetInfoSchema = z.object({
  name: z.string(),
  path: z.string(),
  language: z.string(),
  version: z.string().optional(),
  framework: z.string().optional(),
  package_manager: z.enum([
    "npm",
    "yarn",
    "pnpm",
    "bun",
    "pip",
    "cargo",
    "go",
    "maven",
    "gradle",
    "composer",
    "bundle",
  ]).optional(),
  dependency_files: z.array(z.string()),
  env_files: z.array(z.string()),
  entrypoint: z.string().optional(),
  target_type: z.enum(["package", "script"]).optional(),
  internal_dependencies: z.array(z.string()).optional(),
  actions: RepositoryActionsSchema,
});

// Bulk Target Data Schema
export const BulkTargetDataSchema = z.record(
  z.string(),
  z.object({
    dependencies: z.record(z.string(), z.string()),
    devDependencies: z.record(z.string(), z.string()).optional(),
    envNames: z.array(z.string()),
  })
);

// Project Context Schema
export const ProjectContextSchema = z.object({
  name: z.string(),
  targets: z.record(z.string(), TargetInfoSchema).optional(),
  target_dependencies: BulkTargetDataSchema.optional(),
});

export const agentInstallRequest = z.object({
  package: z.string(),
  project_context: ProjectContextSchema.optional(),
});
export const agentInstallResponse = z.object({
  agent_id: z.string(),
});

export const agentSearchRequest = z.object({
  query: z.string(),
  project_context: ProjectContextSchema,
});
export const agentSearchResponse = z.object({
  agent_id: z.string(),
});

export const agentEventsRequest = z.object({
  agent_id: z.string(),
  payload: z.string().optional(),
  project_context: ProjectContextSchema.optional(),
});
export const agentEventsResponse = z.object({
  tool_name: z.string().optional(),
  message: z.string().optional(),
  action: z.enum([
    "tool_call",
    "response",
    "step_finish",
    "status_update",
    "connected",
    "error"
  ]),
  status: z.string().optional(),
  data: z.any().optional(),
  timestamp: z.number().optional(),
});
