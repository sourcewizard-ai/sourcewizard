import { promises as fs } from "fs";
import * as path from "path";
import { executeCommand, CommandResult } from "./util.js";
import { Target, detectPackages, shouldSkipDirectory, findDetectorForTarget, ActionType } from "./package.js";
import { RepositoryAction, RepositoryActions, ProjectContext, TargetInfo, BulkTargetData } from "./types.js";

export * from "./types.js";

export { getBulkTargetData } from "./target-data.js";

// Re-export ActionType so it can be used by consumers
export type { ActionType };

async function gatherTargets(workingDir: string): Promise<Target[]> {
  // recursively go over the repository, and detect all targets in package.json or language equivalent
  const targets: Target[] = [];
  await scanDirectory(workingDir, workingDir, targets);
  return targets;
}

async function scanDirectory(currentPath: string, repoRoot: string, targets: Target[]): Promise<void> {
  try {
    // Detect packages in current directory
    const currentTargets = await detectPackages(currentPath, repoRoot);
    targets.push(...currentTargets);

    // Recursively scan subdirectories
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !shouldSkipDirectory(entry.name)) {
        await scanDirectory(path.join(currentPath, entry.name), repoRoot, targets);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}


async function normalizePath(workingDir: string, targetPath: string, currentDir: string): Promise<string> {
  if (!targetPath) {
    throw new Error("targetPath must not be empty");
  }

  // If already in //path:name format, extract the path part
  if (targetPath.includes(":")) {
    const [pathPart] = targetPath.split(":");
    targetPath = pathPart;
  }

  // If it starts with //, it's already normalized
  if (targetPath.startsWith("//")) {
    return targetPath.replace(/\/$/, ""); // Remove trailing slash
  }

  if (!path.isAbsolute(targetPath)) {
    targetPath = path.resolve(currentDir, targetPath);
  }

  // Handle absolute paths by making them relative to workingDir
  const relativePath = path.relative(workingDir, targetPath);
  if (relativePath.startsWith("..")) {
    throw new Error(`Target path "${targetPath}" ${relativePath} is outside repository root`);
  }
  return relativePath === "" ? "//" : `//${relativePath}`;
}


async function findMatchingTarget(workingDir: string, currentDir: string, targets: Target[], targetId?: string, actionType?: ActionType): Promise<{ target: Target | null, availableTargets: Target[], normalizedPath: string }> {
  if (!targetId) {
    targetId = currentDir;
  }

  const parts = targetId.split(":");
  let targetPath = !!parts[0] ? parts[0] : currentDir;
  let targetName = !!parts[1] ? parts[1] : "";

  // Try to find by path first
  const normalizedTargetPath = await normalizePath(workingDir, targetPath, currentDir);
  let pathMatches = targets.filter(t => t.path === normalizedTargetPath);

  // Filter targets by action support if actionType is provided
  if (actionType) {
    const supportedTargets: Target[] = [];
    for (const target of pathMatches) {
      if (await targetSupportsAction(target, actionType, workingDir)) {
        supportedTargets.push(target);
      }
    }
    pathMatches = supportedTargets;
  }

  if (pathMatches.length === 1 && targetName === "") {
    return { target: pathMatches[0], availableTargets: pathMatches, normalizedPath: normalizedTargetPath };
  }
  if (pathMatches.length > 1 && targetName === "") {
    throw new Error(
      `Multiple targets found at path "${normalizedTargetPath}". Please specify one of: ${pathMatches.map(t => t.id).join(", ")}`
    );
  }


  const idMatches = pathMatches.filter(t => t.id.endsWith(`:${targetName}`));

  if (idMatches.length === 1) {
    return { target: idMatches[0], availableTargets: pathMatches, normalizedPath: normalizedTargetPath };
  }

  if (idMatches.length > 1) {
    throw new Error(
      `Multiple targets found with name "${targetId}". Please specify one of: ${idMatches.map(t => t.id).join(", ")}`
    );
  }

  return { target: null, availableTargets: pathMatches, normalizedPath: normalizedTargetPath };
}

async function targetSupportsAction(target: Target, actionType: ActionType, workingDir: string): Promise<boolean> {
  try {
    const additionalArgs = (actionType === "add-package" || actionType === "remove-package")
      ? ["dummy-package"]
      : [];
    const commands = await generateCommands(target, actionType, workingDir, additionalArgs);
    return commands.length > 0;
  } catch {
    return false;
  }
}

async function generateCommands(target: Target, actionType: ActionType, workingDir: string, additionalArgs?: string[]): Promise<string[]> {
  const detector = await findDetectorForTarget(target);

  if (!detector) {
    console.log(`⚠️No detector found for language: ${target.language}`);
    return [];
  }

  return await detector.generateCommands(target, actionType, workingDir, additionalArgs);
}

export async function executeRepositoryCommandV2(
  workingDir: string,
  currentDir: string,
  actionType: ActionType,
  targetId: string | undefined,
  additionalArgs: string[] = []
): Promise<CommandResult[]> {
  console.log(`Analyzing repository at ${workingDir}`);

  // Get all packages
  const targets = await gatherTargets(workingDir);

  if (targets.length === 0) {
    throw new Error("No targets found in repository");
  }
  // Find matching target
  const { target: selectedTarget, availableTargets, normalizedPath } = await findMatchingTarget(workingDir, currentDir, targets, targetId, actionType);

  if (!selectedTarget) {
    const formattedTargets = availableTargets.map(t => `  ${t.id}`).join('\n');
    throw new Error(`No target found for: ${targetId || "current directory"}\nResolved path: ${normalizedPath}\nAvailable targets:\n${formattedTargets}`);
  }

  console.log(`Selected target: ${selectedTarget.id}`);

  // Normalize path and determine working directory
  const targetWorkingDir = selectedTarget.path === "//"
    ? workingDir
    : path.join(workingDir, selectedTarget.path.substring(2));

  // Generate commands for the action type
  const commands = await generateCommands(selectedTarget, actionType, workingDir, additionalArgs);

  if (commands.length === 0) {
    console.log(`No commands defined for ${actionType} in ${selectedTarget.language} projects`);
    if (actionType == "check") {
      throw new Error(`No commands defined for: ${targetId}\nResolved path: ${normalizedPath}`);
    }
    return [];
  }

  // Write commands to file in /tmp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const commandsFilePath = path.join('/tmp', `sourcewizard-commands-${timestamp}-${process.pid}.sh`);

  const commandsFileContent = [
    '#!/bin/bash',
    `# SourceWizard Commands Log`,
    `# Target: ${selectedTarget.id}`,
    `# Action: ${actionType}`,
    `# Working Directory: ${targetWorkingDir}`,
    `# Timestamp: ${new Date().toISOString()}`,
    '',
    ...commands.map(cmd => `# Command: ${cmd}`),
    '',
    ...commands
  ].join('\n');

  try {
    await fs.writeFile(commandsFilePath, commandsFileContent, { mode: 0o755 });
    console.log(`Commands written to: ${commandsFilePath}`);
  } catch (error) {
    console.error(`Failed to write commands file: ${error}`);
  }

  // Execute commands
  console.log(`Running ${actionType} commands for ${selectedTarget.name}...`);

  const results: CommandResult[] = [];

  for (const command of commands) {
    console.log(`Running: ${command}`);

    try {
      const result = await executeCommand(command, targetWorkingDir);
      results.push(result);

      if (result.exitCode !== 0) {
        console.error(`Command failed with exit code ${result.exitCode}: ${command}`);
        return results;
      }
    } catch (error) {
      console.error(`Command error: ${command}`, error);
      throw error;
    }
  }

  console.log(`${actionType} completed successfully!`);
  return results;
}

export async function analyzeRepositoryV2(workingDir: string): Promise<ProjectContext> {
  const targets = await gatherTargets(workingDir);
  const repoName = path.basename(workingDir);

  // Convert targets to TargetInfo format without actions
  const convertedTargets: Record<string, TargetInfo> = {};

  for (const target of targets) {
    const targetKey = target.path === "//" ? `:${target.name}` : `${target.path.substring(2)}:${target.name}`;

    // Determine dependency files based on language
    const dependencyFiles: string[] = [];
    const targetDir = target.path === "//" ? "" : target.path.substring(2);

    if (target.language === "javascript" || target.language === "typescript") {
      dependencyFiles.push(targetDir ? `${targetDir}/package.json` : "package.json");
    } else if (target.language === "python") {
      dependencyFiles.push(targetDir ? `${targetDir}/requirements.txt` : "requirements.txt");
    } else if (target.language === "go") {
      dependencyFiles.push(targetDir ? `${targetDir}/go.mod` : "go.mod");
    } else if (target.language === "rust") {
      dependencyFiles.push(targetDir ? `${targetDir}/Cargo.toml` : "Cargo.toml");
    } else if (target.language === "php") {
      dependencyFiles.push(targetDir ? `${targetDir}/composer.json` : "composer.json");
    }

    convertedTargets[targetKey] = {
      name: target.name,
      path: target.path,
      language: target.language,
      version: undefined, // Not available in Target interface
      framework: target.framework,
      package_manager: target.packageManager as TargetInfo["package_manager"],
      dependency_files: dependencyFiles.length > 0 ? dependencyFiles : undefined,
      env_files: undefined, // TODO: Implement env file detection if needed
      target_type: "package", // Default to package type
      internal_dependencies: undefined, // Not available in Target interface
      // Deliberately omit actions field
    };
  }

  return {
    name: repoName,
    targets: convertedTargets,
    // Don't set target_dependencies
  };
}
