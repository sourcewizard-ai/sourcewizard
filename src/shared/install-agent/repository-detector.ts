import { promises as fs } from "fs";
import * as path from "path";
import type {
  ProjectContext,
  RepositoryActions,
  RepositoryAction,
  TargetInfo,
} from "../types.js";

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

export async function detectRepo(repoPath: string): Promise<ProjectContext> {
  const defaultContext: ProjectContext = {
    name: "unknown",
    actions: {
      build: [],
      test: [],
      deploy: [],
      dev: [],
      lint: [],
      format: [],
      install: [],
      clean: [],
      typecheck: [],
    },
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

  // Build repository actions from all packages
  context.actions = await buildRepositoryActionsFromPackages(
    repoPath,
    packages,
    context
  );

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
        const packageJson = JSON.parse(content);
        return {
          path: packagePath,
          relativePath: relativePath || ".",
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
          relativePath: relativePath || ".",
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
          relativePath: relativePath || ".",
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
          relativePath: relativePath || ".",
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
          relativePath: relativePath || ".",
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
          relativePath: relativePath || ".",
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
          relativePath: relativePath || ".",
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
          relativePath: relativePath || ".",
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
    console.debug(`Error analyzing package file ${filePath}: ${error}`);
    return null;
  }
}

async function determinePrimaryPackage(
  repoPath: string,
  packages: PackageInfo[]
): Promise<PackageInfo | null> {
  // First, look for a package in the root directory
  const rootPackage = packages.find(
    (pkg) => pkg.relativePath === "." || pkg.relativePath === ""
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
        pkg.relativePath === "."
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
    const isRoot = pkg.relativePath === "." || pkg.relativePath === "";
    const targetPath = isRoot ? "." : pkg.relativePath;
    const targetName = pkg.name || path.basename(pkg.path);

    // Detect dependency files with full paths
    const dependencyFiles = await detectDependencyFilesWithPaths(pkg, repoPath);

    // Get env files for this package only
    const envFiles = getPackageEnvFiles(pkg, allEnvFiles, repoPath);

    // Get version from package
    const version = await getPackageVersion(pkg);

    const targetKey = isRoot ? `:${targetName}` : `${targetPath}:${targetName}`;
    targets[targetKey] = {
      name: targetName,
      path: targetPath,
      language: pkg.language,
      version,
      framework: pkg.framework,
      package_manager: pkg.packageManager as TargetInfo["package_manager"],
      dependency_files: dependencyFiles,
      env_files: envFiles,
    };
  }

  return targets;
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
    console.debug(`Error parsing dependencies for ${pkg.path}: ${error}`);
    return {
      dependencies: {},
      devDependencies: {},
    };
  }
}

async function buildRepositoryActionsFromPackages(
  repoPath: string,
  packages: PackageInfo[],
  context: Partial<ProjectContext>
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
    typecheck: [],
  };

  // Add actions for each package
  for (const pkg of packages) {
    await addPackageActions(pkg, actions);
  }

  return actions;
}

async function addPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions
): Promise<void> {
  const isRoot =
    packageInfo.relativePath === "." || packageInfo.relativePath === "";
  const scope = isRoot ? "root" : packageInfo.relativePath;
  switch (packageInfo.type) {
    case "node":
      await addNodePackageActions(packageInfo, actions, scope);
      break;

    case "python":
      await addPythonPackageActions(packageInfo, actions, scope);
      break;

    case "go":
      await addGoPackageActions(packageInfo, actions, scope);
      break;

    case "rust":
      await addRustPackageActions(packageInfo, actions, scope);
      break;

    case "java-maven":
      await addMavenPackageActions(packageInfo, actions, scope);
      break;

    case "java-gradle":
      await addGradlePackageActions(packageInfo, actions, scope);
      break;

    case "php":
      await addPhpPackageActions(packageInfo, actions, scope);
      break;

    case "ruby":
      await addRubyPackageActions(packageInfo, actions, scope);
      break;
  }
}

async function addNodePackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions,
  scope: string
): Promise<void> {
  const packageManager = packageInfo.packageManager || "npm";

  // Add install action
  actions.install.push({
    command: getInstallCommand(packageManager),
    scope,
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
      dev: ["dev", "start", "serve", "watch", "development"],
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
            scope,
          });
        }
      }
    }
    if (packageInfo.language === "typescript") {
      actions.typecheck.push({
        command: "npx tsc --noEmit",
        scope,
      });
    }
  } catch {
    // Error reading package.json
  }
}

async function addPythonPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions,
  scope: string
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
      scope,
    });
  }

  if (hasPipfile) {
    actions.install.push({
      command: "pipenv install",
      scope,
    });
  }

  // Test actions
  actions.test.push({
    command: "python -m pytest",
    scope,
  });

  // Build actions
  if (hasSetupPy) {
    actions.build.push({
      command: "python setup.py build",
      scope,
    });
  }

  if (hasPyprojectToml) {
    actions.build.push({
      command: "python -m build",
      scope,
    });
  }
}

async function addGoPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions,
  scope: string
): Promise<void> {
  actions.install.push({
    command: "go mod download",
    scope,
  });

  actions.build.push({
    command: "go build ./...",
    scope,
  });

  actions.test.push({
    command: "go test ./...",
    scope,
  });
}

async function addRustPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions,
  scope: string
): Promise<void> {
  actions.install.push({
    command: "cargo fetch",
    scope,
  });

  actions.build.push({
    command: "cargo build",
    scope,
  });

  actions.test.push({
    command: "cargo test",
    scope,
  });
}

async function addMavenPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions,
  scope: string
): Promise<void> {
  actions.install.push({
    command: "mvn install",
    scope,
  });

  actions.build.push({
    command: "mvn compile",
    scope,
  });

  actions.test.push({
    command: "mvn test",
    scope,
  });
}

async function addGradlePackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions,
  scope: string
): Promise<void> {
  actions.build.push({
    command: "./gradlew build",
    scope,
  });

  actions.test.push({
    command: "./gradlew test",
    scope,
  });
}

async function addPhpPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions,
  scope: string
): Promise<void> {
  actions.install.push({
    command: "composer install",
    scope,
  });

  actions.test.push({
    command: "composer test",
    scope,
  });
}

async function addRubyPackageActions(
  packageInfo: PackageInfo,
  actions: RepositoryActions,
  scope: string
): Promise<void> {
  actions.install.push({
    command: "bundle install",
    scope,
  });

  actions.test.push({
    command: "bundle exec rspec",
    scope,
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

export async function getBulkTargetData(
  targets: Record<string, TargetInfo>,
  repoPath: string
): Promise<
  Record<
    string,
    {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
      envNames: string[];
    }
  >
> {
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
