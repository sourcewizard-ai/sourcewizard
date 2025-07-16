import { z } from "zod";

export const PackageConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  language: z.string(),
  tags: z.array(z.string()),
  env: z.array(z.string()),
  packages: z.array(z.string()),
  setup_prompt: z.string().optional(),
  relevant_files_pattern: z.array(z.string()).optional(),
  uninstall: z.string().optional(),
  update: z.string().optional(),
});

const TYPECONF_SCHEMAS_MAP = {
  "registry/clerk/pkg.config.ts": PackageConfigSchema,
};

export default TYPECONF_SCHEMAS_MAP;
