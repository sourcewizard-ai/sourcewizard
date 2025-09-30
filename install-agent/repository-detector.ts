import { promises as fs } from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { act } from "react";

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

// Common directories to ignore even if not in .gitignore
const DEFAULT_IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "target", // Rust/Java
  "build",
  "dist",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  ".cache",
  "tmp",
  "temp",
  ".tmp",
  ".temp",
  "__pycache__",
  "*.pyc",
  ".pytest_cache",
  ".venv",
  "venv",
  "env",
  "Pods", // iOS
  "DerivedData", // iOS
  "vendor", // PHP/Go
];

interface GitignorePattern {
  pattern: string;
  isNegated: boolean;
  isDirectory: boolean;
}

interface PackageInfo {
  path: string;
  relativePath: string;
  type:
  | "node"
  | "python"
  | "go"
  | "rust"
  | "java-maven"
  | "java-gradle"
  | "php"
  | "ruby";
  configFile: string;
  name?: string;
  language: string;
  framework?: string;
  packageManager?: string;
}

interface EntrypointScript {
  name: string;
  path: string;
  relativePath: string;
}

interface InternalDependency {
  module: string;
  relativePath: string;
}

export async function detectRepo(repoPath: string): Promise<ProjectContext> {
  const defaultContext: ProjectContext = {
    name: "unknown",
  };

  try {
    const repoInfo = await analyzeRepositoryRecursive(repoPath);
    return {
      ...defaultContext,
      ...repoInfo,
    };
  } catch (error) {
    console.error("Error detecting repository:", error);
    return defaultContext;
  }
}

async function analyzeRepositoryRecursive(
  repoPath: string
): Promise<Partial<ProjectContext>> {
  const context: Partial<ProjectContext> = {};

  // Root name always comes from directory name
  context.name = path.basename(repoPath);

  // Parse gitignore patterns
  const gitignorePatterns = await parseGitignorePatterns(repoPath);

  // Recursively find all packages in the repository
  const packages = await findAllPackages(repoPath, gitignorePatterns);

  // Convert ALL packages to TargetInfo (including root packages)
  const targets = await convertPackagesToTargets(packages, repoPath);
  if (Object.keys(targets).length > 0) {
    context.targets = targets;
  }

  return context;
}

async function parseGitignorePatterns(
  repoPath: string
): Promise<GitignorePattern[]> {
  const patterns: GitignorePattern[] = [];

  // Add default ignore patterns
  for (const pattern of DEFAULT_IGNORE_PATTERNS) {
    patterns.push({
      pattern,
      isNegated: false,
      isDirectory: pattern.endsWith("/") || !pattern.includes("."),
    });
  }

  // Parse .gitignore files
  const gitignoreFiles = [
    path.join(repoPath, ".gitignore"),
    path.join(repoPath, ".git", "info", "exclude"),
  ];

  for (const gitignoreFile of gitignoreFiles) {
    try {
      const content = await fs.readFile(gitignoreFile, "utf-8");
      const lines = content.split("\n");

      for (let line of lines) {
        line = line.trim();

        // Skip empty lines and comments
        if (!line || line.startsWith("#")) continue;

        const isNegated = line.startsWith("!");
        if (isNegated) {
          line = line.substring(1);
        }

        const isDirectory = line.endsWith("/");
        if (isDirectory) {
          line = line.substring(0, line.length - 1);
        }

        patterns.push({
          pattern: line,
          isNegated,
          isDirectory,
        });
      }
    } catch {
      // .gitignore file doesn't exist or can't be read
    }
  }

  return patterns;
}

function shouldIgnorePath(
  filePath: string,
  repoPath: string,
  patterns: GitignorePattern[]
): boolean {
  const relativePath = path.relative(repoPath, filePath);
  const pathParts = relativePath.split(path.sep);

  let ignored = false;

  for (const pattern of patterns) {
    const matches = matchesGitignorePattern(relativePath, pathParts, pattern);

    if (matches) {
      ignored = !pattern.isNegated;
    }
  }


  return ignored;
}

function matchesGitignorePattern(
  relativePath: string,
  pathParts: string[],
  pattern: GitignorePattern
): boolean {
  const { pattern: pat, isDirectory } = pattern;

  // Simple glob matching
  if (pat === "*") return true;

  // Exact match
  if (relativePath === pat) return true;

  // Check if any path component matches
  for (const part of pathParts) {
    if (part === pat) return true;

    // Simple wildcard matching
    if (pat.includes("*")) {
      const regex = new RegExp(pat.replace(/\*/g, ".*"));
      if (regex.test(part)) return true;
    }
  }

  // Directory-specific matching
  if (isDirectory) {
    return pathParts.includes(pat);
  }

  // Pattern with path separators
  if (pat.includes("/")) {
    return relativePath.includes(pat);
  }

  return false;
}

async function findAllPackages(
  repoPath: string,
  gitignorePatterns: GitignorePattern[]
): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];

  await scanDirectory(repoPath, repoPath, packages, gitignorePatterns);

  return packages;
}

async function scanDirectory(
  currentPath: string,
  repoPath: string,
  packages: PackageInfo[],
  patterns: GitignorePattern[]
): Promise<void> {
  try {
    // Check if this directory should be ignored
    if (shouldIgnorePath(currentPath, repoPath, patterns)) {
      return;
    }

    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    // Check for package files in current directory
    const packageFiles = [
      { file: "package.json", type: "node" as const, language: "javascript" },
      { file: "Cargo.toml", type: "rust" as const, language: "rust" },
      { file: "go.mod", type: "go" as const, language: "go" },
      { file: "pom.xml", type: "java-maven" as const, language: "java" },
      { file: "build.gradle", type: "java-gradle" as const, language: "java" },
      {
        file: "build.gradle.kts",
        type: "java-gradle" as const,
        language: "kotlin",
      },
      { file: "composer.json", type: "php" as const, language: "php" },
      { file: "Gemfile", type: "ruby" as const, language: "ruby" },
      { file: "setup.py", type: "python" as const, language: "python" },
      { file: "pyproject.toml", type: "python" as const, language: "python" },
      { file: "requirements.txt", type: "python" as const, language: "python" },
      { file: "Pipfile", type: "python" as const, language: "python" },
    ];

    for (const { file, type, language } of packageFiles) {
      const filePath = path.join(currentPath, file);
      try {
        await fs.access(filePath);

        // Found a package file, analyze it
        const packageInfo = await analyzePackageFile(
          filePath,
          currentPath,
          repoPath,
          type,
          language
        );
        if (packageInfo) {
          packages.push(packageInfo);
        }

        // For Python, we might have multiple package files, so don't break early
        if (type !== "python") {
          break; // Only one package type per directory (except Python)
        }
      } catch {
        // File doesn't exist
      }
    }

    // Recursively scan subdirectories
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = path.join(currentPath, entry.name);
        await scanDirectory(subPath, repoPath, packages, patterns);
      }
    }
  } catch (error) {
    // Directory access error, skip
    console.debug(`Skipping directory ${currentPath}: ${error}`);
  }
}

async function analyzePackageFile(
  filePath: string,
  packagePath: string,
  repoPath: string,
  type: PackageInfo["type"],
  language: string
): Promise<PackageInfo | null> {
  try {
    const relativePath = path.relative(repoPath, packagePath);

    switch (type) {
      case "node": {
        const content = await fs.readFile(filePath, "utf-8");
        let packageJson;
        try {
          packageJson = JSON.parse(content);
        } catch (parseError) {
          throw new Error(`JSON syntax error in ${filePath}: ${parseError instanceof Error ? parseError.message : parseError}`);
        }
        return {
          path: packagePath,
          relativePath: relativePath || "//",
          type,
          configFile: "package.json",
          name: packageJson.name,
          language: await detectJavaScriptLanguage(packageJson, packagePath),
          framework: detectFramework(packageJson),
          packageManager: await detectPackageManager(packagePath, repoPath),
        };
      }

      case "rust": {
        const content = await fs.readFile(filePath, "utf-8");
        const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
        return {
          path: packagePath,
          relativePath: relativePath || "//",
          type,
          configFile: "Cargo.toml",
          name: nameMatch?.[1],
          language: "rust",
          packageManager: "cargo",
        };
      }

      case "go": {
        const content = await fs.readFile(filePath, "utf-8");
        const moduleMatch = content.match(/module\s+(.+)/);
        const moduleName = moduleMatch?.[1] || "unknown";
        return {
          path: packagePath,
          relativePath: relativePath || "//",
          type,
          configFile: "go.mod",
          name: moduleName.split("/").pop(),
          language: "go",
          packageManager: "go",
        };
      }

      case "java-maven": {
        const content = await fs.readFile(filePath, "utf-8");
        const nameMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
        return {
          path: packagePath,
          relativePath: relativePath || "//",
          type,
          configFile: "pom.xml",
          name: nameMatch?.[1],
          language: "java",
          framework: "maven",
          packageManager: "maven",
        };
      }

      case "java-gradle": {
        const content = await fs.readFile(filePath, "utf-8");
        const nameMatch = content.match(
          /rootProject\.name\s*=\s*['"]([^'"]+)['"]/
        );
        return {
          path: packagePath,
          relativePath: relativePath || "//",
          type,
          configFile: path.basename(filePath),
          name: nameMatch?.[1] || path.basename(packagePath),
          language: filePath.endsWith(".kts") ? "kotlin" : "java",
          framework: "gradle",
          packageManager: "gradle",
        };
      }

      case "php": {
        const content = await fs.readFile(filePath, "utf-8");
        const composer = JSON.parse(content);
        return {
          path: packagePath,
          relativePath: relativePath || "//",
          type,
          configFile: "composer.json",
          name: composer.name,
          language: "php",
          framework: detectPHPFramework(composer),
          packageManager: "composer",
        };
      }

      case "ruby": {
        return {
          path: packagePath,
          relativePath: relativePath || "//",
          type,
          configFile: "Gemfile",
          name: path.basename(packagePath),
          language: "ruby",
          framework: await detectRubyFramework(packagePath),
          packageManager: "bundle",
        };
      }

      case "python": {
        let name = path.basename(packagePath);

        if (filePath.endsWith("setup.py")) {
          const content = await fs.readFile(filePath, "utf-8");
          const nameMatch = content.match(/name\s*=\s*['""]([^'"]*)['"]/);
          if (nameMatch) name = nameMatch[1];
        } else if (filePath.endsWith("pyproject.toml")) {
          const content = await fs.readFile(filePath, "utf-8");
          const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
          if (nameMatch) name = nameMatch[1];
        }

        return {
          path: packagePath,
          relativePath: relativePath || "//",
          type,
          configFile: path.basename(filePath),
          name,
          language: "python",
          framework: await detectPythonFramework(packagePath),
          packageManager: "pip",
        };
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`Error analyzing package file ${filePath}: ${error}`);
    return null;
  }
}

async function determinePrimaryPackage(
  repoPath: string,
  packages: PackageInfo[]
): Promise<PackageInfo | null> {
  // First, look for a package in the root directory
  const rootPackage = packages.find(
    (pkg) => pkg.relativePath === "//" || pkg.relativePath === ""
  );
  if (rootPackage) {
    return rootPackage;
  }

  // If no root package, find the most common language/type
  const typeCounts = packages.reduce((acc, pkg) => {
    acc[pkg.type] = (acc[pkg.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostCommonType = Object.entries(typeCounts).sort(
    ([, a], [, b]) => b - a
  )[0]?.[0];

  if (mostCommonType) {
    return packages.find((pkg) => pkg.type === mostCommonType) || packages[0];
  }

  return packages[0] || null;
}

function determinePrimaryLanguage(packages: PackageInfo[]): string | undefined {
  if (packages.length === 0) return undefined;

  // Count languages by frequency
  const languageCounts = packages.reduce((acc, pkg) => {
    acc[pkg.language] = (acc[pkg.language] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Return most common language
  const mostCommonLanguage = Object.entries(languageCounts).sort(
    ([, a], [, b]) => b - a
  )[0]?.[0];

  return mostCommonLanguage || packages[0].language;
}

// This function is no longer needed since we don't populate root context from packages

async function collectAllEnvFiles(
  repoPath: string,
  packages: PackageInfo[]
): Promise<Map<string, string[]>> {
  const envFileMap = new Map<string, string[]>();

  // Only check each package's own directory for env files
  for (const pkg of packages) {
    const envFiles = await detectEnvFiles(pkg.path);
    if (envFiles.length > 0) {
      envFileMap.set(pkg.relativePath, envFiles);
    }
  }

  return envFileMap;
}

async function detectDependencyFilesWithPaths(
  pkg: PackageInfo,
  repoPath: string
): Promise<string[]> {
  const files: string[] = [];

  const dependencyFileMap = {
    node: ["package.json"],
    python: ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"],
    go: ["go.mod"],
    rust: ["Cargo.toml"],
    "java-maven": ["pom.xml"],
    "java-gradle": ["build.gradle", "build.gradle.kts"],
    php: ["composer.json"],
    ruby: ["Gemfile"],
  };

  const possibleFiles = dependencyFileMap[pkg.type] || [];

  for (const file of possibleFiles) {
    try {
      const filePath = path.join(pkg.path, file);
      await fs.access(filePath);

      // Create path relative to repo root
      const relativePath = path.relative(repoPath, filePath);
      files.push(
        relativePath.startsWith(".") ? relativePath : `./${relativePath}`
      );
    } catch {
      // File doesn't exist
    }
  }

  return files;
}

function getPackageEnvFiles(
  pkg: PackageInfo,
  allEnvFiles: Map<string, string[]>,
  repoPath: string
): string[] {
  const envFiles: string[] = [];
  const packageEnvFiles = allEnvFiles.get(pkg.relativePath);

  if (packageEnvFiles) {
    for (const envFile of packageEnvFiles) {
      // Construct proper relative path from repo root
      const fullPath =
        pkg.relativePath === "//"
          ? `./${envFile}`
          : `./${path.join(pkg.relativePath, envFile)}`;

      envFiles.push(fullPath);
    }
  }

  return envFiles;
}

async function convertPackagesToTargets(
  packages: PackageInfo[],
  repoPath: string
): Promise<Record<string, TargetInfo>> {
  const targets: Record<string, TargetInfo> = {};

  // First, collect all env files in the repository for inheritance
  const allEnvFiles = await collectAllEnvFiles(repoPath, packages);

  for (const pkg of packages) {
    const isRoot = pkg.relativePath === "//" || pkg.relativePath === "";
    const targetPath = isRoot ? "//" : pkg.relativePath;
    const targetName = pkg.name || path.basename(pkg.path);

    // Detect dependency files with full paths
    const dependencyFiles = await detectDependencyFilesWithPaths(pkg, repoPath);

    // Get env files for this package only
    const envFiles = getPackageEnvFiles(pkg, allEnvFiles, repoPath);

    // Get version from package
    const version = await getPackageVersion(pkg);

    // Create the main package target
    const targetKey = isRoot ? `:${targetName}` : `${targetPath}:${targetName}`;

    const packageActions = await generatePackageActions(pkg, targetPath);

    targets[targetKey] = {
      name: targetName,
      path: targetPath,
      language: pkg.language,
      version,
      framework: pkg.framework,
      package_manager: pkg.packageManager as TargetInfo["package_manager"],
      dependency_files: dependencyFiles,
      env_files: envFiles,
      target_type: "package",
      actions: packageActions,
    };

    // Detect entrypoint scripts for this package
    const entrypoints = await detectEntrypointScripts(pkg, repoPath);

    // Create additional targets for each entrypoint script
    for (const entrypoint of entrypoints) {
      // Calculate the script's directory relative to repo root
      const scriptDir = path.dirname(entrypoint.relativePath);
      const scriptPath =
        scriptDir === "." ? "//" : scriptDir.replace(/^\.\//, "");

      // Create target key based on script location, not package location
      const scriptTargetKey =
        scriptPath === "//"
          ? `:${entrypoint.name}`
          : `${scriptPath}:${entrypoint.name}`;

      // Detect internal dependencies for the script
      const internalDeps = await detectInternalDependencies(
        entrypoint,
        pkg,
        repoPath
      );

      // Generate script-specific actions
      const scriptActions = await generateScriptActions(
        entrypoint,
        pkg,
        scriptPath
      );

      targets[scriptTargetKey] = {
        name: entrypoint.name,
        path: scriptPath,
        language: pkg.language,
        version,
        framework: pkg.framework,
        package_manager: pkg.packageManager as TargetInfo["package_manager"],
        dependency_files: dependencyFiles,
        env_files: envFiles,
        entrypoint: entrypoint.relativePath,
        target_type: "script",
        internal_dependencies:
          internalDeps.length > 0 ? internalDeps : undefined,
        actions: scriptActions,
      };
    }

    // Create additional targets for each package.json script (Node.js packages only)
    if (pkg.type === "node") {
      await addPackageScriptTargets(pkg, targetName, targetPath, isRoot, targets, packageActions);
    }
  }

  return targets;
}

async function addPackageScriptTargets(
  pkg: PackageInfo,
  targetName: string,
  targetPath: string,
  isRoot: boolean,
  targets: Record<string, TargetInfo>,
  packageActions: RepositoryActions
): Promise<void> {
  try {
    // Read package.json to get scripts
    const packageJsonPath = path.join(pkg.path, "package.json");
    const packageContent = await fs.readFile(packageJsonPath, "utf-8");
    let packageJson;
    try {
      packageJson = JSON.parse(packageContent);
    } catch (parseError) {
      throw new Error(`JSON syntax error in ${packageJsonPath}: ${parseError instanceof Error ? parseError.message : parseError}`);
    }

    if (!packageJson.scripts) {
      return; // No scripts to create targets for
    }

    // Create a target for each script
    for (const [scriptName, scriptCode] of Object.entries(packageJson.scripts)) {
      if (typeof scriptCode !== 'string') continue;

      // Create script target key in format: <pkg-path>:<pkg-name>-<script-name>
      const scriptTargetKey = isRoot
        ? `:${targetName}-${scriptName}`
        : `${targetPath}:${targetName}-${scriptName}`;

      // Create script-specific actions that just run this one script
      const packageManager = pkg.packageManager || "npm";
      const runCommand = getRunCommand(packageManager);
      const scriptCommand = `${runCommand} ${scriptName}`;

      // Copy actions from the main package target
      const scriptActions: RepositoryActions = {
        build: [...packageActions.build],
        test: [...packageActions.test],
        deploy: [...packageActions.deploy],
        dev: [{ command: scriptCommand }],
        lint: [...packageActions.lint],
        format: [...packageActions.format],
        install: [...packageActions.install],
        clean: [...packageActions.clean],
        check: [...packageActions.check],
        add: [...packageActions.add],
      };

      targets[scriptTargetKey] = {
        name: `${targetName}-${scriptName}`,
        path: targetPath,
        language: pkg.language,
        framework: pkg.framework,
        package_manager: pkg.packageManager as TargetInfo["package_manager"],
        dependency_files: [], // Script targets don't need dependency files
        env_files: [], // Script targets don't need env files  
        target_type: "script",
        actions: scriptActions,
      };
    }
  } catch (error) {
    // Log errors reading package.json for script targets
    console.error(`Could not read package.json for script targets at ${pkg.path}: ${error}`);
  }
}

async function detectEntrypointScripts(
  pkg: PackageInfo,
  repoPath: string
): Promise<EntrypointScript[]> {
  switch (pkg.type) {
    case "python":
      return await detectPythonEntrypoints(pkg, repoPath);
    case "node":
      return await detectNodeEntrypoints(pkg, repoPath);
    case "go":
      return await detectGoEntrypoints(pkg, repoPath);
    case "rust":
      return await detectRustEntrypoints(pkg, repoPath);
    case "java-maven":
    case "java-gradle":
      return await detectJavaEntrypoints(pkg, repoPath);
    default:
      return [];
  }
}

async function detectPythonEntrypoints(
  pkg: PackageInfo,
  repoPath: string
): Promise<EntrypointScript[]> {
  const entrypoints: EntrypointScript[] = [];

  try {
    const files = await findPythonFiles(pkg.path);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, "utf-8");

        // Check if the file contains if __name__ == "__main__": pattern
        const hasMainBlock = /if\s+__name__\s*==\s*["']__main__["']\s*:/.test(
          content
        );

        if (hasMainBlock) {
          const fileName = path.basename(file, ".py");
          const relativePath = path.relative(repoPath, file);

          entrypoints.push({
            name: fileName,
            path: file,
            relativePath: relativePath.startsWith(".")
              ? relativePath
              : `./${relativePath}`,
          });
        }
      } catch (error) {
        // Skip files that can't be read
        console.debug(`Skipping file ${file}: ${error}`);
      }
    }
  } catch (error) {
    console.debug(
      `Error detecting Python entrypoints in ${pkg.path}: ${error}`
    );
  }

  return entrypoints;
}

async function findPythonFiles(dirPath: string): Promise<string[]> {
  const pythonFiles: string[] = [];

  // Common directories to ignore when scanning for Python entrypoints
  const ignoreDirectories = [
    "__pycache__",
    ".pytest_cache",
    "tests",
    "test",
    ".git",
    // Virtual environment directories
    "venv",
    "env",
    ".venv",
    ".env",
    "virtualenv",
    "ENV",
    // Other common directories to skip
    "node_modules",
    ".tox",
    "dist",
    "build",
    "*.egg-info",
    ".coverage",
    "htmlcov",
  ];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isFile() && entry.name.endsWith(".py")) {
        // Skip common non-entrypoint files
        if (!["__init__.py", "setup.py", "conftest.py"].includes(entry.name)) {
          pythonFiles.push(fullPath);
        }
      } else if (entry.isDirectory()) {
        // Check if this directory should be ignored
        const shouldIgnore = ignoreDirectories.some((pattern) => {
          if (pattern.includes("*")) {
            // Simple glob matching for patterns like "*.egg-info"
            const regex = new RegExp(pattern.replace(/\*/g, ".*"));
            return regex.test(entry.name);
          }
          return entry.name === pattern;
        });

        if (!shouldIgnore) {
          const subFiles = await findPythonFiles(fullPath);
          pythonFiles.push(...subFiles);
        }
      }
    }
  } catch (error) {
    console.debug(`Error reading directory ${dirPath}: ${error}`);
  }

  return pythonFiles;
}

// Stub functions for other languages - to be implemented later
async function detectNodeEntrypoints(
  pkg: PackageInfo,
  repoPath: string
): Promise<EntrypointScript[]> {
  // TODO: Implement Node.js entrypoint detection
  // Could look for files with require.main === module or specific patterns
  return [];
}

async function detectGoEntrypoints(
  pkg: PackageInfo,
  repoPath: string
): Promise<EntrypointScript[]> {
  // TODO: Implement Go entrypoint detection
  // Could look for main() functions in main packages
  return [];
}

async function detectRustEntrypoints(
  pkg: PackageInfo,
  repoPath: string
): Promise<EntrypointScript[]> {
  // TODO: Implement Rust entrypoint detection
  // Could look for main.rs files or bin entries in Cargo.toml
  return [];
}

async function detectJavaEntrypoints(
  pkg: PackageInfo,
  repoPath: string
): Promise<EntrypointScript[]> {
  // TODO: Implement Java entrypoint detection
  // Could look for public static void main methods
  return [];
}

async function detectInternalDependencies(
  entrypoint: EntrypointScript,
  pkg: PackageInfo,
  repoPath: string
): Promise<string[]> {
  switch (pkg.type) {
    case "python":
      return await detectPythonInternalDependencies(entrypoint, pkg, repoPath);
    case "node":
      return await detectNodeInternalDependencies(entrypoint, pkg, repoPath);
    case "go":
      return await detectGoInternalDependencies(entrypoint, pkg, repoPath);
    case "rust":
      return await detectRustInternalDependencies(entrypoint, pkg, repoPath);
    case "java-maven":
    case "java-gradle":
      return await detectJavaInternalDependencies(entrypoint, pkg, repoPath);
    default:
      return [];
  }
}

async function generatePackageActions(
  pkg: PackageInfo,
  targetPath: string
): Promise<RepositoryActions> {
  const actions: RepositoryActions = {
    build: [],
    test: [],
    deploy: [],
    dev: [],
    lint: [],
    format: [],
    install: [],
    clean: [],
    check: [],
    add: [],
  };

  await addPackageActions(pkg, actions);
  return actions;
}

async function generateScriptActions(
  entrypoint: EntrypointScript,
  pkg: PackageInfo,
  targetPath: string
): Promise<RepositoryActions> {
  const actions: RepositoryActions = {
    build: [],
    test: [],
    deploy: [],
    dev: [],
    lint: [],
    format: [],
    install: [],
    clean: [],
    check: [],
    add: [],
  };

  // Generate language-specific script actions
  switch (pkg.type) {
    case "python":
      await addPythonScriptActions(entrypoint, actions, targetPath);
      break;
    case "node":
      await addNodeScriptActions(entrypoint, actions, targetPath);
      break;
    case "go":
      await addGoScriptActions(entrypoint, actions, targetPath);
      break;
    case "rust":
      await addRustScriptActions(entrypoint, actions, targetPath);
      break;
    case "java-maven":
    case "java-gradle":
      await addJavaScriptActions(entrypoint, actions, targetPath);
      break;
    default:
      break;
  }

  return actions;
}

async function addPythonScriptActions(
  entrypoint: EntrypointScript,
  actions: RepositoryActions,
  targetPath: string
): Promise<void> {
  const scriptPath = entrypoint.relativePath;

  // Run action - execute the Python script
  actions.dev.push({
    command: `python ${scriptPath}`,
  });

  // Test action - try to run pytest on the script if it looks like a test
  if (entrypoint.name.includes("test") || entrypoint.name.startsWith("test_")) {
    actions.test.push({
      command: `python -m pytest ${scriptPath}`,
    });
  } else {
    // For non-test scripts, add a basic validation run
    actions.test.push({
      command: `python -m py_compile ${scriptPath}`,
    });
  }

  // Install dependencies if requirements.txt exists in the target path
  actions.install.push({
    command: "pip install -r requirements.txt",
  });

  // Lint action
  actions.lint.push({
    command: `python -m flake8 ${scriptPath}`,
  });

  // Format action
  actions.format.push({
    command: `python -m black ${scriptPath}`,
  });

  // Deploy action - leave empty for now
}

// Stub functions for other languages - to be implemented later
async function addNodeScriptActions(
  entrypoint: EntrypointScript,
  actions: RepositoryActions,
  targetPath: string
): Promise<void> {
  const scriptPath = entrypoint.relativePath;

  // TODO: Implement Node.js script actions
  actions.dev.push({
    command: `node ${scriptPath}`,
  });

  // Deploy action - leave empty for now
}

async function addGoScriptActions(
  entrypoint: EntrypointScript,
  actions: RepositoryActions,
  targetPath: string
): Promise<void> {
  const scriptPath = entrypoint.relativePath;

  // TODO: Implement Go script actions
  actions.dev.push({
    command: `go run ${scriptPath}`,
  });

  // Deploy action - leave empty for now
}

async function addRustScriptActions(
  entrypoint: EntrypointScript,
  actions: RepositoryActions,
  targetPath: string
): Promise<void> {
  // TODO: Implement Rust script actions
  // Deploy action - leave empty for now
}

async function addJavaScriptActions(
  entrypoint: EntrypointScript,
  actions: RepositoryActions,
  targetPath: string
): Promise<void> {
  // TODO: Implement Java script actions
  // Deploy action - leave empty for now
}

async function detectPythonInternalDependencies(
  entrypoint: EntrypointScript,
  pkg: PackageInfo,
  repoPath: string
): Promise<string[]> {
  const internalDeps: string[] = [];

  try {
    const content = await fs.readFile(entrypoint.path, "utf-8");
    const imports = parsePythonImports(content);

    for (const importModule of imports) {
      const internalPath = await resolveInternalPythonModule(
        importModule,
        entrypoint.path,
        repoPath
      );

      if (internalPath) {
        internalDeps.push(internalPath);
      }
    }
  } catch (error) {
    console.debug(
      `Error detecting internal dependencies for ${entrypoint.path}: ${error}`
    );
  }

  return Array.from(new Set(internalDeps)); // Remove duplicates
}

function parsePythonImports(content: string): string[] {
  const imports: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Parse "import module" statements
    const importMatch = trimmed.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/);
    if (importMatch) {
      imports.push(importMatch[1]);
      continue;
    }

    // Parse "from module import ..." statements
    const fromImportMatch = trimmed.match(
      /^from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import/
    );
    if (fromImportMatch) {
      imports.push(fromImportMatch[1]);
      continue;
    }

    // Handle relative imports "from .module import ..." or "from ..module import ..."
    const relativeImportMatch = trimmed.match(
      /^from\s+(\.{1,}[a-zA-Z_][a-zA-Z0-9_.]*)\s+import/
    );
    if (relativeImportMatch) {
      imports.push(relativeImportMatch[1]);
      continue;
    }
  }

  return imports;
}

async function resolveInternalPythonModule(
  moduleName: string,
  scriptPath: string,
  repoPath: string
): Promise<string | null> {
  // Handle relative imports
  if (moduleName.startsWith(".")) {
    const scriptDir = path.dirname(scriptPath);
    const relativePath = resolveRelativePythonImport(
      moduleName,
      scriptDir,
      repoPath
    );
    return relativePath;
  }

  // Check if it's an internal module by looking for corresponding files
  const possiblePaths = [
    // Look for module.py in current directory and parent directories
    path.join(path.dirname(scriptPath), `${moduleName}.py`),
    path.join(repoPath, `${moduleName}.py`),
    // Look for module/__init__.py
    path.join(path.dirname(scriptPath), moduleName, "__init__.py"),
    path.join(repoPath, moduleName, "__init__.py"),
    // Look for nested modules (e.g., package.module -> package/module.py)
    ...moduleName.split(".").reduce((paths: string[], part, index, parts) => {
      const subPath = parts.slice(0, index + 1).join("/");
      paths.push(
        path.join(path.dirname(scriptPath), `${subPath}.py`),
        path.join(repoPath, `${subPath}.py`),
        path.join(path.dirname(scriptPath), subPath, "__init__.py"),
        path.join(repoPath, subPath, "__init__.py")
      );
      return paths;
    }, []),
  ];

  for (const possiblePath of possiblePaths) {
    try {
      await fs.access(possiblePath);
      const relativePath = path.relative(repoPath, possiblePath);
      return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
    } catch {
      // File doesn't exist, continue
    }
  }

  return null; // Not an internal module
}

function resolveRelativePythonImport(
  relativePath: string,
  scriptDir: string,
  repoPath: string
): string | null {
  const dots = relativePath.match(/^\.+/)?.[0] || "";
  const modulePart = relativePath.substring(dots.length);

  let targetDir = scriptDir;

  // Navigate up directories based on number of dots
  for (let i = 1; i < dots.length; i++) {
    targetDir = path.dirname(targetDir);
    if (targetDir === path.dirname(targetDir)) break; // Reached filesystem root
  }

  if (modulePart) {
    const possiblePaths = [
      path.join(targetDir, `${modulePart}.py`),
      path.join(targetDir, modulePart, "__init__.py"),
    ];

    for (const possiblePath of possiblePaths) {
      try {
        if (possiblePath.startsWith(repoPath)) {
          const relativePath = path.relative(repoPath, possiblePath);
          return relativePath.startsWith(".")
            ? relativePath
            : `./${relativePath}`;
        }
      } catch {
        // Continue
      }
    }
  }

  return null;
}

// Stub functions for internal dependency detection in other languages
async function detectNodeInternalDependencies(
  entrypoint: EntrypointScript,
  pkg: PackageInfo,
  repoPath: string
): Promise<string[]> {
  // TODO: Implement Node.js internal dependency detection
  // Could parse require() and import statements for relative paths
  return [];
}

async function detectGoInternalDependencies(
  entrypoint: EntrypointScript,
  pkg: PackageInfo,
  repoPath: string
): Promise<string[]> {
  // TODO: Implement Go internal dependency detection
  // Could parse import statements for internal module references
  return [];
}

async function detectRustInternalDependencies(
  entrypoint: EntrypointScript,
  pkg: PackageInfo,
  repoPath: string
): Promise<string[]> {
  // TODO: Implement Rust internal dependency detection
  // Could parse mod and use statements for internal crate references
  return [];
}

async function detectJavaInternalDependencies(
  entrypoint: EntrypointScript,
  pkg: PackageInfo,
  repoPath: string
): Promise<string[]> {
  // TODO: Implement Java internal dependency detection
  // Could parse import statements for internal package references
  return [];
}

async function detectDependencyFiles(
  packagePath: string,
  packageType: PackageInfo["type"]
): Promise<string[]> {
  const files: string[] = [];

  const dependencyFileMap = {
    node: ["package.json"],
    python: ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"],
    go: ["go.mod"],
    rust: ["Cargo.toml"],
    "java-maven": ["pom.xml"],
    "java-gradle": ["build.gradle", "build.gradle.kts"],
    php: ["composer.json"],
    ruby: ["Gemfile"],
  };

  const possibleFiles = dependencyFileMap[packageType] || [];

  for (const file of possibleFiles) {
    try {
      const filePath = path.join(packagePath, file);
      await fs.access(filePath);
      files.push(file);
    } catch {
      // File doesn't exist
    }
  }

  return files;
}

async function detectEnvFiles(packagePath: string): Promise<string[]> {
  const files: string[] = [];
  const envFileNames = [".env", ".env.local"];

  for (const fileName of envFileNames) {
    try {
      const filePath = path.join(packagePath, fileName);
      await fs.access(filePath);
      files.push(fileName);
    } catch {
      // File doesn't exist
    }
  }

  return files;
}

async function getPackageVersion(
  pkg: PackageInfo
): Promise<string | undefined> {
  try {
    switch (pkg.type) {
      case "node": {
        const packageJsonPath = path.join(pkg.path, "package.json");
        const content = await fs.readFile(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(content);
        return packageJson.version;
      }

      case "rust": {
        const cargoTomlPath = path.join(pkg.path, "Cargo.toml");
        const content = await fs.readFile(cargoTomlPath, "utf-8");
        const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
        return versionMatch?.[1];
      }

      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

async function parseEnvFiles(
  packagePath: string
): Promise<Record<string, string>> {
  const envs: Record<string, string> = {};
  const envFiles = [".env", ".env.local"];

  for (const envFile of envFiles) {
    try {
      const envFilePath = path.join(packagePath, envFile);
      const content = await fs.readFile(envFilePath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#")) continue;

        // Parse KEY=VALUE format
        const equalIndex = trimmed.indexOf("=");
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim();
          let value = trimmed.substring(equalIndex + 1).trim();

          // Remove quotes if present
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }

          envs[key] = value;
        }
      }
    } catch {
      // File doesn't exist or can't be read, continue
    }
  }

  return envs;
}

async function parsePackageDependencies(pkg: PackageInfo): Promise<{
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
}> {
  try {
    switch (pkg.type) {
      case "node": {
        const packageJsonPath = path.join(pkg.path, "package.json");
        const content = await fs.readFile(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(content);
        return {
          dependencies: packageJson.dependencies || {},
          devDependencies: packageJson.devDependencies || {},
        };
      }

      case "python": {
        const dependencies = await parsePythonDependencies(pkg.path);
        return {
          dependencies,
          devDependencies: {},
        };
      }

      case "go": {
        const goModPath = path.join(pkg.path, "go.mod");
        const content = await fs.readFile(goModPath, "utf-8");
        const dependencies = await parseGoDependencies(content);
        return {
          dependencies,
          devDependencies: {},
        };
      }

      case "rust": {
        const cargoTomlPath = path.join(pkg.path, "Cargo.toml");
        const content = await fs.readFile(cargoTomlPath, "utf-8");
        const dependencies = await parseRustDependencies(content);
        return {
          dependencies,
          devDependencies: {},
        };
      }

      case "php": {
        const composerJsonPath = path.join(pkg.path, "composer.json");
        const content = await fs.readFile(composerJsonPath, "utf-8");
        const composer = JSON.parse(content);
        return {
          dependencies: composer.require || {},
          devDependencies: composer["require-dev"] || {},
        };
      }

      case "java-maven": {
        // For Maven, we'd need to parse pom.xml - simplified for now
        return {
          dependencies: {},
          devDependencies: {},
        };
      }

      case "java-gradle": {
        // For Gradle, we'd need to parse build.gradle - simplified for now
        return {
          dependencies: {},
          devDependencies: {},
        };
      }

      case "ruby": {
        // For Ruby, we'd need to parse Gemfile - simplified for now
        return {
          dependencies: {},
          devDependencies: {},
        };
      }

      default:
        return {
          dependencies: {},
          devDependencies: {},
        };
    }
  } catch (error) {
    console.error(`Error parsing dependencies for ${pkg.path}: ${error}`);
    return {
      dependencies: {},
      devDependencies: {},
    };
  }
}

async function addPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions
): Promise<void> {
  switch (packageInfo.type) {
    case "node":
      await addNodePackageActions(packageInfo, actions);
      break;

    case "python":
      await addPythonPackageActions(packageInfo, actions);
      break;

    case "go":
      await addGoPackageActions(packageInfo, actions);
      break;

    case "rust":
      await addRustPackageActions(packageInfo, actions);
      break;

    case "java-maven":
      await addMavenPackageActions(packageInfo, actions);
      break;

    case "java-gradle":
      await addGradlePackageActions(packageInfo, actions);
      break;

    case "php":
      await addPhpPackageActions(packageInfo, actions);
      break;

    case "ruby":
      await addRubyPackageActions(packageInfo, actions);
      break;
  }
}

async function addNodePackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions
): Promise<void> {
  const packageManager = packageInfo.packageManager || "npm";

  // Add install action
  actions.install.push({
    command: getInstallCommand(packageManager),
  });

  // Add package add action with flags support
  const addFlags: string[] = [];

  // Add dev dependency flags
  if (packageManager === "npm") {
    addFlags.push("--save-dev");
  } else if (packageManager === "yarn") {
    addFlags.push("--dev");
  } else if (packageManager === "pnpm") {
    addFlags.push("--save-dev", "-w"); // Include workspace flag for pnpm
  } else if (packageManager === "bun") {
    addFlags.push("--dev");
  }

  actions.add.push({
    command: getAddCommand(packageManager),
    flags: addFlags,
  });

  try {
    const packageJsonPath = path.join(packageInfo.path, "package.json");
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    const scripts = packageJson.scripts || {};

    // Map scripts to actions
    const scriptMappings = {
      build: ["build", "compile", "dist", "bundle"],
      test: [
        "test",
        "test:unit",
        "test:integration",
        "test:e2e",
        "spec",
        "jest",
        "mocha",
      ],
      deploy: ["deploy", "publish", "release", "ship"],
      dev: ["dev", "serve", "watch", "development"],
      lint: ["lint", "eslint", "tslint", "check"],
      format: ["format", "prettier", "fmt"],
      clean: ["clean", "clear", "reset"],
    };

    for (const [actionType, patterns] of Object.entries(scriptMappings)) {
      for (const [scriptName] of Object.entries(scripts)) {
        if (
          patterns.some((pattern) => scriptName.toLowerCase().includes(pattern))
        ) {
          actions[actionType].push({
            command: `${getRunCommand(packageManager)} ${scriptName}`,
          });
        }
      }
    }
    if (packageInfo.language === "typescript") {
      actions.check.push({
        command: "tsc --noEmit",
      });
    }
  } catch {
    // Error reading package.json
  }
}

async function addPythonPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions
): Promise<void> {
  // Check for different Python package files
  const hasRequirements = await fileExists(
    path.join(packageInfo.path, "requirements.txt")
  );
  const hasSetupPy = await fileExists(path.join(packageInfo.path, "setup.py"));
  const hasPyprojectToml = await fileExists(
    path.join(packageInfo.path, "pyproject.toml")
  );
  const hasPipfile = await fileExists(path.join(packageInfo.path, "Pipfile"));

  // Install actions
  if (hasRequirements) {
    actions.install.push({
      command: "pip install -r requirements.txt",
    });
  }

  if (hasPipfile) {
    actions.install.push({
      command: "pipenv install",
    });
  }

  // Add package actions
  if (hasPipfile) {
    actions.add.push({
      command: "pipenv install",
    });
  } else {
    actions.add.push({
      command: "pip install",
    });
  }

  // Test actions
  actions.test.push({
    command: "python -m pytest",
  });

  // Build actions
  if (hasSetupPy) {
    actions.build.push({
      command: "python setup.py build",
    });
  }

  if (hasPyprojectToml) {
    actions.build.push({
      command: "python -m build",
    });
  }
}

async function addGoPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions
): Promise<void> {
  actions.install.push({
    command: "go mod download",
  });

  actions.add.push({
    command: "go get",
  });

  actions.build.push({
    command: "go build ./...",
  });

  actions.test.push({
    command: "go test ./...",
  });
}

async function addRustPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions
): Promise<void> {
  actions.install.push({
    command: "cargo fetch",
  });

  actions.add.push({
    command: "cargo add",
  });

  actions.build.push({
    command: "cargo build",
  });

  actions.test.push({
    command: "cargo test",
  });
}

async function addMavenPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions
): Promise<void> {
  actions.install.push({
    command: "mvn install",
  });

  actions.add.push({
    command: "mvn dependency:get -Dartifact=",
  });

  actions.build.push({
    command: "mvn compile",
  });

  actions.test.push({
    command: "mvn test",
  });
}

async function addGradlePackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions
): Promise<void> {
  actions.add.push({
    command: "./gradlew dependencies --write-locks",
  });

  actions.build.push({
    command: "./gradlew build",
  });

  actions.test.push({
    command: "./gradlew test",
  });
}

async function addPhpPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions
): Promise<void> {
  actions.install.push({
    command: "composer install",
  });

  actions.add.push({
    command: "composer require",
  });

  actions.test.push({
    command: "composer test",
  });
}

async function addRubyPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions
): Promise<void> {
  actions.install.push({
    command: "bundle install",
  });

  actions.add.push({
    command: "bundle add",
  });

  actions.test.push({
    command: "bundle exec rspec",
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectPackageManager(
  packagePath: string,
  repoPath?: string
): Promise<TargetInfo["package_manager"]> {
  const lockFiles = [
    { file: "yarn.lock", manager: "yarn" as const },
    { file: "pnpm-lock.yaml", manager: "pnpm" as const },
    { file: "bun.lockb", manager: "bun" as const },
    { file: "package-lock.json", manager: "npm" as const },
  ];

  const searchPaths = [];

  // If we have repoPath, check repo root first (for monorepos)
  if (repoPath && repoPath !== packagePath) {
    searchPaths.push(repoPath);
  }

  // Then check the package directory
  searchPaths.push(packagePath);

  // Also check parent directories up to repo root
  if (repoPath) {
    let currentPath = path.dirname(packagePath);
    while (
      currentPath !== repoPath &&
      currentPath !== path.dirname(currentPath)
    ) {
      searchPaths.push(currentPath);
      currentPath = path.dirname(currentPath);
    }
  }

  for (const searchPath of searchPaths) {
    for (const { file, manager } of lockFiles) {
      try {
        await fs.access(path.join(searchPath, file));
        return manager;
      } catch {
        continue;
      }
    }
  }

  return "npm";
}

async function detectJavaScriptLanguage(
  packageJson: any,
  cwd: string
): Promise<string> {
  // Check for tsconfig.json first - this is the primary indicator
  try {
    await fs.access(path.join(cwd, "tsconfig.json"));
    return "typescript";
  } catch {
    // Continue to other checks
  }

  // Check for TypeScript dependency as fallback
  if (
    packageJson.devDependencies?.typescript ||
    packageJson.dependencies?.typescript
  ) {
    return "typescript";
  }

  return "javascript";
}

function detectFramework(packageJson: any): string | undefined {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (dependencies["vue"]) return "vue";
  if (dependencies["angular"] || dependencies["@angular/core"])
    return "angular";
  if (dependencies["svelte"]) return "svelte";
  if (dependencies["express"]) return "express";
  if (dependencies["fastify"]) return "fastify";
  if (dependencies["koa"]) return "koa";
  if (dependencies["next"]) return "next";
  if (dependencies["nuxt"]) return "nuxt";
  if (dependencies["gatsby"]) return "gatsby";
  if (dependencies["react"]) return "react";

  return undefined;
}

// Export utility functions for reading target-specific data

export async function getTargetEnvNames(
  targetInfo: TargetInfo,
  repoPath: string
): Promise<string[]> {
  const envNames: string[] = [];
  if (!targetInfo.env_files) {
    return [];
  }

  for (const envFile of targetInfo.env_files) {
    try {
      // envFile is now a full path relative to repo root
      const envFilePath = path.join(repoPath, envFile);
      const content = await fs.readFile(envFilePath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#")) continue;

        // Parse KEY=VALUE format, only extract key names
        const equalIndex = trimmed.indexOf("=");
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim();
          if (!envNames.includes(key)) {
            envNames.push(key);
          }
        }
      }
    } catch {
      // File doesn't exist or can't be read, continue
    }
  }

  return envNames;
}

export async function getTargetDependencies(
  targetInfo: TargetInfo,
  repoPath: string
): Promise<{
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
}> {
  if (!targetInfo.dependency_files) {
    return {
      dependencies: {},
    };
  }
  for (const dependencyFile of targetInfo.dependency_files) {
    try {
      // dependencyFile is now a full path relative to repo root
      const filePath = path.join(repoPath, dependencyFile);
      const fileName = path.basename(dependencyFile);

      if (fileName === "package.json") {
        const content = await fs.readFile(filePath, "utf-8");
        const packageJson = JSON.parse(content);
        return {
          dependencies: packageJson.dependencies || {},
          devDependencies: packageJson.devDependencies || {},
        };
      } else if (fileName === "requirements.txt") {
        const dependencies = await parsePythonDependencies(
          path.dirname(filePath)
        );
        return {
          dependencies,
          devDependencies: {},
        };
      } else if (fileName === "go.mod") {
        const content = await fs.readFile(filePath, "utf-8");
        const dependencies = await parseGoDependencies(content);
        return {
          dependencies,
          devDependencies: {},
        };
      } else if (fileName === "Cargo.toml") {
        const content = await fs.readFile(filePath, "utf-8");
        const dependencies = await parseRustDependencies(content);
        return {
          dependencies,
          devDependencies: {},
        };
      } else if (fileName === "composer.json") {
        const content = await fs.readFile(filePath, "utf-8");
        const composer = JSON.parse(content);
        return {
          dependencies: composer.require || {},
          devDependencies: composer["require-dev"] || {},
        };
      }
    } catch (error) {
      console.debug(
        `Error reading dependency file ${dependencyFile}: ${error}`
      );
    }
  }

  return {
    dependencies: {},
    devDependencies: {},
  };
}

async function parsePythonDependencies(
  cwd: string
): Promise<Record<string, string>> {
  const dependencies: Record<string, string> = {};

  try {
    const requirementsPath = path.join(cwd, "requirements.txt");
    const content = await fs.readFile(requirementsPath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const match = trimmed.match(/^([a-zA-Z0-9\-_]+)([>=<~!]+.*)?$/);
        if (match) {
          dependencies[match[1]] = match[2] || "*";
        }
      }
    }
  } catch {
    // Try pyproject.toml or other files
  }

  return dependencies;
}

async function detectPythonFramework(cwd: string): Promise<string | undefined> {
  const dependencies = await parsePythonDependencies(cwd);

  if (dependencies["django"]) return "django";
  if (dependencies["flask"]) return "flask";
  if (dependencies["fastapi"]) return "fastapi";
  if (dependencies["tornado"]) return "tornado";

  return undefined;
}

async function parseGoDependencies(
  goModContent: string
): Promise<Record<string, string>> {
  const dependencies: Record<string, string> = {};
  const lines = goModContent.split("\n");
  let inRequireBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "require (") {
      inRequireBlock = true;
      continue;
    }
    if (trimmed === ")") {
      inRequireBlock = false;
      continue;
    }

    if (inRequireBlock || trimmed.startsWith("require ")) {
      const match = trimmed.match(/([^\s]+)\s+([^\s]+)/);
      if (match) {
        dependencies[match[1]] = match[2];
      }
    }
  }

  return dependencies;
}

async function parseRustDependencies(
  cargoContent: string
): Promise<Record<string, string>> {
  const dependencies: Record<string, string> = {};
  const lines = cargoContent.split("\n");
  let inDependenciesSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "[dependencies]") {
      inDependenciesSection = true;
      continue;
    }
    if (trimmed.startsWith("[") && trimmed !== "[dependencies]") {
      inDependenciesSection = false;
      continue;
    }

    if (inDependenciesSection && trimmed.includes("=")) {
      const equalIndex = trimmed.indexOf("=");
      const name = trimmed.substring(0, equalIndex).trim();
      const version = trimmed.substring(equalIndex + 1).trim();
      dependencies[name] = version;
    }
  }

  return dependencies;
}

async function getJavaProjectName(
  cwd: string,
  configFile: string
): Promise<string> {
  try {
    const configPath = path.join(cwd, configFile);
    const content = await fs.readFile(configPath, "utf-8");

    if (configFile === "pom.xml") {
      const match = content.match(/<artifactId>([^<]+)<\/artifactId>/);
      if (match) return match[1];
    } else if (configFile.includes("gradle")) {
      const match = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
      if (match) return match[1];
    }
  } catch {
    // Continue
  }

  return path.basename(cwd);
}

function detectPHPFramework(composer: any): string | undefined {
  const dependencies = { ...composer.require, ...composer["require-dev"] };

  if (dependencies["laravel/framework"]) return "laravel";
  if (dependencies["symfony/symfony"]) return "symfony";
  if (dependencies["cakephp/cakephp"]) return "cakephp";
  if (dependencies["codeigniter/framework"]) return "codeigniter";

  return undefined;
}

async function detectRubyFramework(cwd: string): Promise<string | undefined> {
  try {
    const gemfilePath = path.join(cwd, "Gemfile");
    const content = await fs.readFile(gemfilePath, "utf-8");

    if (content.includes("rails")) return "rails";
    if (content.includes("sinatra")) return "sinatra";
    if (content.includes("hanami")) return "hanami";
  } catch {
    // Continue
  }

  return undefined;
}

function getInstallCommand(packageManager: string): string {
  switch (packageManager) {
    case "yarn":
      return "yarn install";
    case "pnpm":
      return "pnpm install";
    case "bun":
      return "bun install";
    default:
      return "npm install";
  }
}

function getRunCommand(packageManager: string): string {
  switch (packageManager) {
    case "yarn":
      return "yarn run";
    case "pnpm":
      return "pnpm run";
    case "bun":
      return "bun run";
    default:
      return "npm run";
  }
}

function getAddCommand(packageManager: string): string {
  switch (packageManager) {
    case "yarn":
      return "yarn add";
    case "pnpm":
      return "pnpm add";
    case "bun":
      return "bun add";
    default:
      return "npm install";
  }
}

export async function getBulkTargetData(
  targets: Record<string, TargetInfo>,
  repoPath: string
): Promise<BulkTargetData> {
  const result: Record<
    string,
    {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
      envNames: string[];
    }
  > = {};

  // Process all targets in parallel for better performance
  const promises = Object.entries(targets).map(
    async ([targetKey, targetInfo]) => {
      const [dependenciesData, envNames] = await Promise.all([
        getTargetDependencies(targetInfo, repoPath),
        getTargetEnvNames(targetInfo, repoPath),
      ]);

      result[targetKey] = {
        dependencies: dependenciesData.dependencies,
        devDependencies: dependenciesData.devDependencies,
        envNames,
      };
    }
  );

  await Promise.all(promises);
  return result;
}

export interface ExecuteCommandOptions {
  onOutput?: (message: string, type: 'info' | 'error' | 'success') => void;
  additionalArgs?: string[];
}

export interface ExecuteAddCommandOptions extends ExecuteCommandOptions {
  packageName: string;
  isDev?: boolean;
  useWorkspace?: boolean;
  additionalFlags?: string[];
}

export async function executeRepositoryCommand(
  actionType: "build" | "dev" | "run" | "check" | "test" | "add",
  targetArg: string | undefined,
  repoPath: string,
  options: ExecuteCommandOptions = {}
): Promise<void> {
  const { onOutput = () => { }, additionalArgs = [] } = options;

  try {
    onOutput(`🔍 Analyzing repository at ${repoPath}`, 'info');

    const repo = await detectRepo(repoPath);

    if (!repo.targets || Object.keys(repo.targets).length === 0) {
      throw new Error("No targets found in repository");
    }

    // Normalize current directory relative to repo root for smart target matching
    const currentDir = process.cwd();
    const normalizedCurrentPath = path.relative(repoPath, currentDir);
    const currentPathForMatching = normalizedCurrentPath === "" ? "//" : normalizedCurrentPath;

    // Determine target to use
    let targetInfo: TargetInfo;
    let targetKey: string;

    if (targetArg) {
      // Normalize targetArg by removing ./ prefix if present
      let normalizedTargetArg = targetArg;
      if (targetArg.startsWith("./")) {
        normalizedTargetArg = targetArg.substring(2);
      }

      // Find target by name, key, or path variations
      let matchingTarget = Object.entries(repo.targets).find(
        ([key, target]) => {
          // Exact key match (both original and normalized)
          if (key === targetArg || key === normalizedTargetArg) return true;


          // Handle // prefixed target paths
          if (targetArg.startsWith("//")) {
            const pathWithoutSlashes = targetArg.substring(2);
            // Match against target.path directly (highest priority for // prefix)
            if (target.path === pathWithoutSlashes) {
              return true;
            }

            // Match against path:name format
            if (key === `${pathWithoutSlashes}:${target.name}`) return true;

            // Match against full key
            if (key === pathWithoutSlashes) return true;

          }

          // Handle relative path matching (both original and normalized)
          if (target.path !== "//" && (target.path === targetArg || target.path === normalizedTargetArg)) return true;

          // Handle relative target with colon prefix (e.g., ":sourcewizard" when in sourcewizard directory)
          if (targetArg.startsWith(":")) {
            const targetName = targetArg.substring(1);
            // ONLY search in current directory - this is the key fix
            if (target.path === currentPathForMatching && target.name === targetName) return true;
            // No fallback to global search - path is implied to be current directory
          }

          // Exact name match (both original and normalized) - only if target argument doesn't look like a path
          if (!targetArg.includes("/") && !targetArg.includes(":")) {
            if (target.name === targetArg || target.name === normalizedTargetArg) return true;
          }

          return false;
        }
      );

      // If no match found and this is a // prefixed path, try root target name match as last resort
      if (!matchingTarget && targetArg.startsWith("//")) {
        const pathWithoutSlashes = targetArg.substring(2);
        matchingTarget = Object.entries(repo.targets).find(([key, target]) =>
          key.startsWith(":") && key.substring(1) === pathWithoutSlashes
        );
      }

      if (!matchingTarget) {
        const availableTargets = Object.entries(repo.targets)
          .map(([key, target]) => `  ${key} (${target.name}) - path: ${target.path}`)
          .join('\n');
        throw new Error(`Target "${targetArg}" not found.\nCurrent path: ${currentPathForMatching}\nAvailable targets:\n${availableTargets}`);
      }

      [targetKey, targetInfo] = matchingTarget;
    } else {
      // Smart default target selection based on current directory
      let defaultTarget: [string, TargetInfo] | undefined;

      // First, try to find a target in the current directory
      defaultTarget = Object.entries(repo.targets).find(([key, target]) =>
        target.path === currentPathForMatching
      );

      // If not found, use root target
      if (!defaultTarget) {
        defaultTarget = Object.entries(repo.targets).find(([key]) => key.startsWith(":"));
      }

      // If still not found, use first available
      if (!defaultTarget) {
        defaultTarget = Object.entries(repo.targets)[0];
      }

      [targetKey, targetInfo] = defaultTarget;
    }

    onOutput(`📦 Using target: ${targetKey} (${targetInfo.name})`, 'info');

    // Always run install first
    onOutput("🔧 Running install actions...", 'info');
    await executeActions(targetInfo.actions.install, targetInfo.path, repoPath, onOutput);

    // Always run check actions before the main command
    onOutput("✅ Running check actions...", 'info');
    await executeActions(targetInfo.actions.check, targetInfo.path, repoPath, onOutput);

    // Run the specific action type
    if (actionType !== "check") {
      onOutput(`🚀 Running ${actionType} actions...`, 'info');
      const shouldPassArgs = actionType === "dev" && additionalArgs.length > 0;
      await executeActions(
        targetInfo.actions[actionType],
        targetInfo.path,
        repoPath,
        onOutput,
        shouldPassArgs ? additionalArgs : undefined
      );
    }

    onOutput(`✅ ${actionType} completed successfully!`, 'success');

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onOutput(`❌ ${actionType} failed: ${message}`, 'error');
    throw error;
  }
}

async function executeActions(
  actions: RepositoryAction[],
  targetPath: string,
  repoPath: string,
  onOutput: (message: string, type: 'info' | 'error' | 'success') => void,
  additionalArgs?: string[]
): Promise<void> {
  if (actions.length === 0) {
    onOutput("⚠️  No actions defined", 'info');
    return;
  }

  for (const action of actions) {
    // Append additional arguments to the command if provided
    const finalCommand = additionalArgs && additionalArgs.length > 0
      ? `${action.command} ${additionalArgs.join(' ')}`
      : action.command;

    onOutput(`  Running: ${finalCommand}`, 'info');

    // Determine working directory - replace // with repo root
    const workingDir = targetPath === "//"
      ? repoPath
      : path.join(repoPath, targetPath);

    const { stdout, stderr } = await executeCommand(finalCommand, workingDir);
  }
}

async function executeCommand(command: string, cwd: string): Promise<{ stdout: string, stderr: string }> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(" ");

    const child = spawn(cmd, args, {
      cwd,
      stdio: ["inherit", "pipe", "pipe"], // Inherit stdin, pipe stdout/stderr for capture
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
      if (process.stdout.isTTY) {
        process.stdout.uncork?.();
      }
    });

    child.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
      if (process.stderr.isTTY) {
        process.stderr.uncork?.();
      }
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command "${command}" exited with code ${code}. stdout: ${stdout.trim()}. stderr: ${stderr.trim()}`));
      }
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to execute command "${command}": ${error.message}. stdout: ${stdout.trim()}. stderr: ${stderr.trim()}`));
    });
  });
}

export async function executeAddCommand(
  targetArg: string | undefined,
  repoPath: string,
  options: ExecuteAddCommandOptions
): Promise<void> {
  const { onOutput = () => { }, packageName, isDev = false, useWorkspace, additionalFlags = [] } = options;

  try {
    onOutput(`🔍 Analyzing repository at ${repoPath}`, 'info');

    const repo = await detectRepo(repoPath);

    if (!repo.targets || Object.keys(repo.targets).length === 0) {
      throw new Error("No targets found in repository");
    }

    // Normalize current directory relative to repo root for smart target matching
    const currentDir = process.cwd();
    const normalizedCurrentPath = path.relative(repoPath, currentDir);
    const currentPathForMatching = normalizedCurrentPath === "" ? "//" : normalizedCurrentPath;

    // Determine target to use
    let targetInfo: TargetInfo;
    let targetKey: string;

    if (targetArg) {
      // Normalize targetArg by removing ./ prefix if present
      let normalizedTargetArg = targetArg;
      if (targetArg.startsWith("./")) {
        normalizedTargetArg = targetArg.substring(2);
      }

      // Find target by name, key, or path variations
      let matchingTarget = Object.entries(repo.targets).find(
        ([key, target]) => {
          // Exact key match (both original and normalized)
          if (key === targetArg || key === normalizedTargetArg) return true;


          // Handle // prefixed target paths
          if (targetArg.startsWith("//")) {
            const pathWithoutSlashes = targetArg.substring(2);
            // Match against target.path directly (highest priority for // prefix)
            if (target.path === pathWithoutSlashes) {
              return true;
            }

            // Match against path:name format
            if (key === `${pathWithoutSlashes}:${target.name}`) return true;

            // Match against full key
            if (key === pathWithoutSlashes) return true;

          }

          // Handle relative path matching (both original and normalized)
          if (target.path !== "//" && (target.path === targetArg || target.path === normalizedTargetArg)) return true;

          // Handle relative target with colon prefix (e.g., ":sourcewizard" when in sourcewizard directory)
          if (targetArg.startsWith(":")) {
            const targetName = targetArg.substring(1);
            // ONLY search in current directory - this is the key fix
            if (target.path === currentPathForMatching && target.name === targetName) return true;
            // No fallback to global search - path is implied to be current directory
          }

          // Exact name match (both original and normalized) - only if target argument doesn't look like a path
          if (!targetArg.includes("/") && !targetArg.includes(":")) {
            if (target.name === targetArg || target.name === normalizedTargetArg) return true;
          }

          return false;
        }
      );

      // If no match found and this is a // prefixed path, try root target name match as last resort
      if (!matchingTarget && targetArg.startsWith("//")) {
        const pathWithoutSlashes = targetArg.substring(2);
        matchingTarget = Object.entries(repo.targets).find(([key, target]) =>
          key.startsWith(":") && key.substring(1) === pathWithoutSlashes
        );
      }

      if (!matchingTarget) {
        const availableTargets = Object.entries(repo.targets)
          .map(([key, target]) => `  ${key} (${target.name}) - path: ${target.path}`)
          .join('\n');
        throw new Error(`Target "${targetArg}" not found.\nCurrent path: ${currentPathForMatching}\nAvailable targets:\n${availableTargets}`);
      }

      [targetKey, targetInfo] = matchingTarget;
    } else {
      // Smart default target selection based on current directory
      let defaultTarget: [string, TargetInfo] | undefined;

      // First, try to find a target in the current directory
      defaultTarget = Object.entries(repo.targets).find(([key, target]) =>
        target.path === currentPathForMatching
      );

      // If not found, use root target
      if (!defaultTarget) {
        defaultTarget = Object.entries(repo.targets).find(([key]) => key.startsWith(":"));
      }

      // If still not found, use first available
      if (!defaultTarget) {
        defaultTarget = Object.entries(repo.targets)[0];
      }

      [targetKey, targetInfo] = defaultTarget;
    }

    onOutput(`📦 Using target: ${targetKey} (${targetInfo.name})`, 'info');

    // Build the specific add command with package name
    if (targetInfo.actions.add.length === 0) {
      throw new Error(`No add command configured for target ${targetKey}`);
    }

    const addAction = targetInfo.actions.add[0];
    const baseCommand = addAction.command;
    let fullCommand = `${baseCommand} ${packageName}`;

    // Build flags based on requirements
    const flagsToUse: string[] = [];

    // Add workspace flag if explicitly requested or if it's pnpm and available
    if (useWorkspace !== false && targetInfo.package_manager === "pnpm" && addAction.flags?.includes("-w")) {
      flagsToUse.push("-w");
    }

    // Add dev dependency flag if requested and available
    if (isDev && addAction.flags) {
      const devFlags = addAction.flags.filter(flag =>
        flag === "--save-dev" || flag === "--dev"
      );
      if (devFlags.length > 0) {
        flagsToUse.push(devFlags[0]);
      }
    }

    // Add any additional flags passed via the tool
    if (additionalFlags.length > 0) {
      flagsToUse.push(...additionalFlags);
    }

    // Build final command with flags
    if (flagsToUse.length > 0) {
      fullCommand = `${baseCommand} ${flagsToUse.join(" ")} ${packageName}`;
    }

    onOutput(`🚀 Adding package: ${packageName}`, 'info');
    onOutput(`  Running: ${fullCommand}`, 'info');

    // Determine working directory - replace // with repo root
    const workingDir = targetInfo.path === "//"
      ? repoPath
      : path.join(repoPath, targetInfo.path);

    const { stdout, stderr } = await executeCommand(fullCommand, workingDir);

    onOutput(`✅ Package ${packageName} added successfully!`, 'success');

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onOutput(`❌ Failed to add package ${packageName}: ${message}`, 'error');
    throw error;
  }
}

