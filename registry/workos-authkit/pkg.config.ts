import fs from "fs";
import type { PackageConfig } from "../types/all.js";
import path from "path";

const config: PackageConfig = {
  name: "workos-authkit",
  description: "Full-fledged authentication platform with enterprise SSO",
  language: "typescript",
  tags: ["auth", "sso", "rbac", "security"],
  env: ["WORKOS_API_KEY", "WORKOS_CLIENT_ID"],
  packages: ["@workos-inc/node"],
  relevant_files_pattern: [
    "**/auth/**/*.ts",
    "**/middleware/**/*.ts",
    "**/api/auth/**/*.ts",
    "**/app/layout.tsx",
    ".env.local",
  ],
  setup_prompt: fs.readFileSync(
    path.join(process.cwd(), "registry/workos-authkit/INSTALL.md"),
    "utf8"
  ),
};

export default config;
