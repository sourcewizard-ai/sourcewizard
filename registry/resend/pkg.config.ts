import fs from "fs";
import type { PackageConfig } from "../types/all.js";
import path from "path";

const config: PackageConfig = {
  name: "resend",
  description: "Resend mail sending infrastructure",
  language: "typescript",
  env: ["RESEND_API_KEY"],
  packages: ["resend"],
  tags: ["auth"],
  relevant_files_pattern: [
    "**/middleware.ts",
    "**/app/layout.tsx",
  ],
  setup_prompt: fs.readFileSync(
    path.join(process.cwd(), "registry/resend/INSTALL.md"),
    "utf8"
  ),
};

export default config;
