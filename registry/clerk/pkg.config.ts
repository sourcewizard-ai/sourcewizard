import fs from "fs";
import type { PackageConfig } from "../types/all.js";
import path from "path";
import { fileURLToPath } from "url";

const config: PackageConfig = {
  name: "clerk",
  description: "Clerk auth",
  language: "typescript",
  env: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
  packages: ["@clerk/nextjs"],
  tags: ["auth"],
  relevant_files_pattern: [
    "**/middleware.ts",
    "**/app/layout.tsx",
    ".env.local",
  ],
  setup_prompt: fs.readFileSync(
    path.join(process.cwd(), "registry/clerk/INSTALL.md"),
    "utf8"
  ),
};

export default config;
