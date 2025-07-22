import fs from "fs";
import type { PackageConfig } from "../types/all.js";
import path from "path";
import { fileURLToPath } from "url";

const config: PackageConfig = {
  name: "mailchimp",
  description: "Mailchimp integration",
  language: "typescript",
  env: ["MAILCHIMP_API_KEY", "MAILCHIMP_LIST_ID"],
  packages: ["@mailchimp/mailchimp_marketing"],
  tags: ["email"],
  relevant_files_pattern: [
    "**/middleware.ts",
    "**/app/layout.tsx",
    ".env.local",
  ],
  setup_prompt: fs.readFileSync(
    path.join(process.cwd(), "registry/mailchimp/INSTALL.md"),
    "utf8"
  ),
};

export default config;
