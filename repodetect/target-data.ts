import path from "path";
import { promises as fs } from "fs";
import { TargetInfo, BulkTargetData } from "./types.js";

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
      // Silently ignore errors for missing dependency files
    }
  }

  return {
    dependencies: {},
    devDependencies: {},
  };
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

