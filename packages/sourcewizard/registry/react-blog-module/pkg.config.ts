import fs from "fs";
import type { PackageConfig } from "../types/all.js";
import path from "path";

const config: PackageConfig = {
  name: "react-blog-module",
  description: "Embeddable blogs module for React/Next.js based apps.",
  language: "typescript",
  env: [],
  packages: ["react-blog-module"],
  tags: ["blog", "react", "next"],
  relevant_files_pattern: [
    "**/blog/*",
    "**/app/layout.tsx",
  ],
  setup_prompt: fs.readFileSync(
    path.join(process.cwd(), "registry/react-blog-module/INSTALL.md"),
    "utf8"
  ),
};

export default config;
