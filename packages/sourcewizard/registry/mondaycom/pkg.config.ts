import fs from "fs";
import type { PackageConfig } from "../types/all.js";
import path from "path";

const config: PackageConfig = {
  name: "mondaycom",
  description: "Monday.com CRM framework SDK",
  language: "typescript",
  tags: ["graphql", "api", "monday", "crm"],
  env: ["MONDAY_API_KEY"],
  packages: ["monday-sdk-js"],
  relevant_files_pattern: [],
  setup_prompt: fs.readFileSync(
    path.join(process.cwd(), "registry/mondaycom/INSTALL.md"),
    "utf8"
  ),
};

export default config;
