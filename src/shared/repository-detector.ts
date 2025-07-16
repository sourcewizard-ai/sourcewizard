import { promises as fs } from "fs";
import path from "path";
import type { ProjectContext } from "./types.js";

export async function detectRepo(): Promise<ProjectContext> {
  const defaultContext: ProjectContext = {
    name: "unknown",
    version: "1.0.0",
    packageManager: "npm",
    language: "unknown",
    dependencies: {},
    devDependencies: {},
    scripts: {},
    projectType: "other",
  };

  try {
    const repoInfo = await analyzeRepository();
    return {
      ...defaultContext,
      ...repoInfo,
    };
  } catch (error) {
    console.error("Error detecting repository:", error);
    return defaultContext;
  }
}

async function analyzeRepository(): Promise<Partial<ProjectContext>> {
  const cwd = process.cwd();
  const context: Partial<ProjectContext> = {};

  // Check for different project types and languages
  const detectors = [
    () => detectNodeProject(cwd),
    () => detectPythonProject(cwd),
    () => detectGoProject(cwd),
    () => detectRustProject(cwd),
    () => detectJavaProject(cwd),
    () => detectPHPProject(cwd),
    () => detectRubyProject(cwd),
  ];

  for (const detector of detectors) {
    const result = await detector();
    if (result) {
      Object.assign(context, result);
      break; // Use the first successful detection
    }
  }

  // Detect package manager
  context.packageManager = await detectPackageManager(cwd);

  return context;
}

async function detectNodeProject(
  cwd: string
): Promise<Partial<ProjectContext> | null> {
  try {
    const packageJsonPath = path.join(cwd, "package.json");
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    return {
      name: packageJson.name || "unknown",
      version: packageJson.version || "1.0.0",
      language: detectJavaScriptLanguage(packageJson, cwd),
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
      scripts: packageJson.scripts || {},
      projectType: detectProjectType(packageJson),
      framework: detectFramework(packageJson),
    };
  } catch {
    return null;
  }
}

async function detectPythonProject(
  cwd: string
): Promise<Partial<ProjectContext> | null> {
  const pythonFiles = [
    "requirements.txt",
    "pyproject.toml",
    "setup.py",
    "Pipfile",
  ];

  for (const file of pythonFiles) {
    try {
      await fs.access(path.join(cwd, file));
      const dependencies = await parsePythonDependencies(cwd);

      return {
        name: await getPythonProjectName(cwd),
        language: "python",
        dependencies,
        projectType: detectPythonProjectType(cwd),
        framework: await detectPythonFramework(cwd),
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function detectGoProject(
  cwd: string
): Promise<Partial<ProjectContext> | null> {
  try {
    const goModPath = path.join(cwd, "go.mod");
    const goModContent = await fs.readFile(goModPath, "utf-8");
    const moduleName = goModContent.match(/module\s+(.+)/)?.[1] || "unknown";

    return {
      name: moduleName.split("/").pop() || "unknown",
      language: "go",
      dependencies: await parseGoDependencies(goModContent),
      projectType: await detectGoProjectType(cwd),
    };
  } catch {
    return null;
  }
}

async function detectRustProject(
  cwd: string
): Promise<Partial<ProjectContext> | null> {
  try {
    const cargoTomlPath = path.join(cwd, "Cargo.toml");
    const cargoTomlContent = await fs.readFile(cargoTomlPath, "utf-8");

    // Simple TOML parsing for name and dependencies
    const nameMatch = cargoTomlContent.match(/name\s*=\s*"([^"]+)"/);
    const versionMatch = cargoTomlContent.match(/version\s*=\s*"([^"]+)"/);

    return {
      name: nameMatch?.[1] || "unknown",
      version: versionMatch?.[1] || "1.0.0",
      language: "rust",
      dependencies: await parseRustDependencies(cargoTomlContent),
      projectType: cargoTomlContent.includes("[bin]") ? "cli" : "library",
    };
  } catch {
    return null;
  }
}

async function detectJavaProject(
  cwd: string
): Promise<Partial<ProjectContext> | null> {
  const javaFiles = ["pom.xml", "build.gradle", "build.gradle.kts"];

  for (const file of javaFiles) {
    try {
      await fs.access(path.join(cwd, file));
      return {
        name: await getJavaProjectName(cwd, file),
        language: file.includes("kotlin") ? "kotlin" : "java",
        dependencies: {},
        projectType: "library",
        framework: file.includes("pom.xml") ? "maven" : "gradle",
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function detectPHPProject(
  cwd: string
): Promise<Partial<ProjectContext> | null> {
  try {
    const composerPath = path.join(cwd, "composer.json");
    const composerContent = await fs.readFile(composerPath, "utf-8");
    const composer = JSON.parse(composerContent);

    return {
      name: composer.name || "unknown",
      language: "php",
      dependencies: composer.require || {},
      devDependencies: composer["require-dev"] || {},
      projectType: "web",
      framework: detectPHPFramework(composer),
    };
  } catch {
    return null;
  }
}

async function detectRubyProject(
  cwd: string
): Promise<Partial<ProjectContext> | null> {
  try {
    const gemfilePath = path.join(cwd, "Gemfile");
    await fs.access(gemfilePath);

    return {
      name: path.basename(cwd),
      language: "ruby",
      dependencies: {},
      projectType: "web",
      framework: await detectRubyFramework(cwd),
    };
  } catch {
    return null;
  }
}

async function detectPackageManager(
  cwd: string
): Promise<ProjectContext["packageManager"]> {
  const lockFiles = [
    { file: "yarn.lock", manager: "yarn" as const },
    { file: "pnpm-lock.yaml", manager: "pnpm" as const },
    { file: "bun.lockb", manager: "bun" as const },
    { file: "package-lock.json", manager: "npm" as const },
  ];

  for (const { file, manager } of lockFiles) {
    try {
      await fs.access(path.join(cwd, file));
      return manager;
    } catch {
      continue;
    }
  }

  return "npm";
}

function detectJavaScriptLanguage(packageJson: any, cwd: string): string {
  // Check for TypeScript
  if (
    packageJson.devDependencies?.typescript ||
    packageJson.dependencies?.typescript
  ) {
    return "typescript";
  }

  // Check for tsconfig.json
  try {
    require("fs").accessSync(path.join(cwd, "tsconfig.json"));
    return "typescript";
  } catch {
    // Continue
  }

  return "javascript";
}

function detectProjectType(packageJson: any): ProjectContext["projectType"] {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (dependencies["react"] || dependencies["react-dom"]) return "web";
  if (dependencies["vue"] || dependencies["@vue/cli"]) return "web";
  if (dependencies["angular"] || dependencies["@angular/core"]) return "web";
  if (dependencies["express"] || dependencies["fastify"] || dependencies["koa"])
    return "web";
  if (dependencies["next"] || dependencies["nuxt"]) return "web";
  if (dependencies["electron"]) return "desktop";
  if (dependencies["react-native"]) return "mobile";
  if (packageJson.bin) return "cli";
  if (packageJson.main && !packageJson.scripts?.start) return "library";

  return "node";
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

async function getPythonProjectName(cwd: string): Promise<string> {
  try {
    const setupPyPath = path.join(cwd, "setup.py");
    const content = await fs.readFile(setupPyPath, "utf-8");
    const nameMatch = content.match(/name\s*=\s*['""]([^'"]*)['"]/);
    if (nameMatch) return nameMatch[1];
  } catch {
    // Continue
  }

  return path.basename(cwd);
}

function detectPythonProjectType(cwd: string): ProjectContext["projectType"] {
  // Simple heuristics based on common Python frameworks
  const basename = path.basename(cwd).toLowerCase();
  if (basename.includes("api") || basename.includes("web")) return "web";
  if (basename.includes("cli") || basename.includes("tool")) return "cli";
  return "other";
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

async function detectGoProjectType(
  cwd: string
): Promise<ProjectContext["projectType"]> {
  try {
    const mainGoPath = path.join(cwd, "main.go");
    const content = await fs.readFile(mainGoPath, "utf-8");

    if (
      content.includes("http.") ||
      content.includes("gin.") ||
      content.includes("echo.")
    ) {
      return "web";
    }
    if (content.includes("func main")) {
      return "cli";
    }
  } catch {
    // Continue
  }

  return "library";
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
