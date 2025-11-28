import fs from "fs";
import type { PackageConfig } from "../types/all.js";
import path from "path";

const config: PackageConfig = {
  name: "react-ai-agent-chat-sdk",
  description: "Full stack agentic AI chat module with conversation storage and tools support",
  language: "typescript",
  env: [],
  packages: ["react-ai-agent-chat-sdk"],
  tags: ["agent", "ai-sdk", "react", "ai"],
  relevant_files_pattern: [
    "**/app/layout.tsx",
  ],
  setup_prompt: fs.readFileSync(
    path.join(process.cwd(), "registry/react-ai-agent-chat-sdk/INSTALL.md"),
    "utf8"
  ),
};

export default config;
