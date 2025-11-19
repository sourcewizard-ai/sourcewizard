export interface RepositoryAction {
  command: string;
  flags?: string[]; // Optional flags that can be appended to the command
}

export interface RepositoryActions {
  build: RepositoryAction[];
  test: RepositoryAction[];
  deploy: RepositoryAction[];
  dev: RepositoryAction[];
  lint: RepositoryAction[];
  format: RepositoryAction[];
  install: RepositoryAction[];
  clean: RepositoryAction[];
  check: RepositoryAction[];
  add: RepositoryAction[];
  [key: string]: RepositoryAction[];
}

export interface ProjectContext {
  name: string;
  targets?: Record<string, TargetInfo>; // Map of "path:name" -> target info
  target_dependencies?: BulkTargetData;
}

export interface TargetInfo {
  name: string;
  path: string;
  language: string;
  version?: string;
  framework?: string;
  package_manager?:
  | "npm"
  | "yarn"
  | "pnpm"
  | "bun"
  | "pip"
  | "cargo"
  | "go"
  | "maven"
  | "gradle"
  | "composer"
  | "bundle";
  dependency_files?: string[]; // Full paths relative to repo root (e.g., "./package.json", "./frontend/package.json")
  env_files?: string[]; // Full paths relative to repo root, includes inherited env files
  entrypoint?: string; // For script targets, the main script file
  target_type?: "package" | "script"; // Type of target
  internal_dependencies?: string[]; // Internal project dependencies (relative paths to modules/packages)
  actions?: RepositoryActions; // Target-specific actions
}
export type BulkTargetData = Record<
  string,
  {
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
    envNames: string[];
  }
>;
