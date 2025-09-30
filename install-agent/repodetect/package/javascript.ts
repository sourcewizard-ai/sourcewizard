import { promises as fs, Dirent } from "fs";
import * as path from "path";
import { Target, PackageDetector, ActionType } from "../package.js";

interface PackageJsonInfo {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

async function detectPackageManager(packagePath: string, repoPath?: string): Promise<string> {
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

function detectFramework(packageInfo: PackageJsonInfo): string | undefined {
  const deps = { ...packageInfo.dependencies, ...packageInfo.devDependencies };
  if (deps.next) return "nextjs";
  if (deps.react) return "react";
  if (deps.vue) return "vue";
  if (deps.svelte) return "svelte";
  if (deps.express) return "express";
  if (deps.fastify) return "fastify";
  if (deps.nestjs || deps['@nestjs/core']) return "nestjs";
  return undefined;
}

function detectLanguage(packageInfo: PackageJsonInfo): string {
  const deps = { ...packageInfo.dependencies, ...packageInfo.devDependencies };
  if (deps.typescript || deps['@types/node']) return "typescript";
  return "javascript";
}

export const javascriptDetector: PackageDetector = {
  name: "JavaScript/TypeScript",
  language: "javascript",
  configFiles: ["package.json"],

  async detect(currentPath: string, repoRoot: string, entries: Dirent[]): Promise<Target[]> {
    const packageJsonEntry = entries.find(e => e.name === 'package.json' && e.isFile());
    if (!packageJsonEntry) return [];

    try {
      const packageJsonPath = path.join(currentPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageInfo: PackageJsonInfo = JSON.parse(content);

      const relativePath = path.relative(repoRoot, currentPath);
      const normalizedPath = relativePath === "" ? "//" : `//${relativePath}`;
      const targetName = packageInfo.name || path.basename(currentPath);

      const baseTarget = {
        language: detectLanguage(packageInfo),
        packageManager: await detectPackageManager(currentPath, repoRoot),
        framework: detectFramework(packageInfo),
        path: normalizedPath
      };

      const targets: Target[] = [];

      // Create base target
      targets.push({
        ...baseTarget,
        id: `${normalizedPath}:${targetName}`,
        name: targetName
      });

      // Create additional targets for each script in package.json
      if (packageInfo.scripts) {
        for (const [scriptName, scriptCommand] of Object.entries(packageInfo.scripts)) {
          // Skip common scripts that we already handle as actions
          if (['build', 'dev', 'test', 'lint', 'start'].includes(scriptName)) {
            continue;
          }

          targets.push({
            ...baseTarget,
            id: `${normalizedPath}:${targetName}-${scriptName}`,
            name: `${targetName}-${scriptName}`
          });
        }
      }

      return targets;
    } catch {
      return [];
    }
  },

  async generateCommands(target: Target, actionType: ActionType, workingDir: string, additionalArgs: string[] = []): Promise<string[]> {
    const commands: string[] = [];

    // Read package.json to check for available scripts
    let packageInfo: PackageJsonInfo | null = null;
    try {
      // Use the workingDir parameter to construct the absolute path to the target
      const targetPath = target.path === "//" ? workingDir : path.join(workingDir, target.path.substring(2));
      const packageJsonPath = path.join(targetPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      packageInfo = JSON.parse(content);
    } catch {
      // If we can't read package.json, proceed without script validation
    }

    // Check if this is a script-specific target
    const basePackageName = packageInfo?.name || path.basename(target.path === "//" ? workingDir : target.path.substring(2));
    const isScriptTarget = target.name !== basePackageName && target.name.startsWith(`${basePackageName}-`);
    let specificScript: string | null = null;

    if (isScriptTarget) {
      specificScript = target.name.substring(`${basePackageName}-`.length);
    }

    // If this is a script-specific target, only execute that script for dev action
    if (specificScript && packageInfo?.scripts?.[specificScript]) {
      // Script-specific targets should only handle "dev" action
      if (actionType === "dev") {
        // Add install commands for dev action
        if (target.packageManager === "pnpm") {
          commands.push("pnpm install");
        } else if (target.packageManager === "yarn") {
          commands.push("yarn install");
        } else if (target.packageManager === "bun") {
          commands.push("bun install");
        } else {
          commands.push("npm install");
        }

        let scriptCommand: string;
        const additionalArgsStr = additionalArgs.length > 0 ? ` ${additionalArgs.join(' ')}` : '';

        if (target.packageManager === "pnpm") {
          scriptCommand = `pnpm run ${specificScript}${additionalArgsStr}`;
        } else if (target.packageManager === "yarn") {
          scriptCommand = `yarn ${specificScript}${additionalArgsStr}`;
        } else if (target.packageManager === "bun") {
          scriptCommand = `bun run ${specificScript}${additionalArgsStr}`;
        } else {
          scriptCommand = `npm run ${specificScript}${additionalArgsStr}`;
        }
        commands.push(scriptCommand);
      }
      // For script-specific targets, return empty commands for non-dev actions
      return commands;
    }

    // Global commands for main targets
    if (target.packageManager === "pnpm") {
      commands.push("pnpm install");
    } else if (target.packageManager === "yarn") {
      commands.push("yarn install");
    } else if (target.packageManager === "bun") {
      commands.push("bun install");
    } else {
      commands.push("npm install");
    }
    if (target.language === "typescript") {
      commands.push("tsc --noEmit");
    }

    // Generate the main action command with additional arguments
    let mainActionCommand: string;
    const additionalArgsStr = additionalArgs.length > 0 ? ` ${additionalArgs.join(' ')}` : '';

    switch (actionType) {
      case "build":
        if (target.packageManager === "pnpm") {
          mainActionCommand = `pnpm run build${additionalArgsStr}`;
        } else if (target.packageManager === "yarn") {
          mainActionCommand = `yarn build${additionalArgsStr}`;
        } else if (target.packageManager === "bun") {
          mainActionCommand = `bun run build${additionalArgsStr}`;
        } else {
          mainActionCommand = `npm run build${additionalArgsStr}`;
        }
        commands.push(mainActionCommand);
        break;
      case "dev":
        if (target.packageManager === "pnpm") {
          mainActionCommand = `pnpm run dev${additionalArgsStr}`;
        } else if (target.packageManager === "yarn") {
          mainActionCommand = `yarn dev${additionalArgsStr}`;
        } else if (target.packageManager === "bun") {
          mainActionCommand = `bun run dev${additionalArgsStr}`;
        } else {
          mainActionCommand = `npm run dev${additionalArgsStr}`;
        }
        commands.push(mainActionCommand);
        break;
      case "check":
        // Check action only does type checking - tsc --noEmit is already added above
        // No additional commands needed for check
        break;
      case "lint":
        // Only add lint command if script exists in package.json
        if (packageInfo?.scripts?.lint) {
          if (target.packageManager === "pnpm") {
            mainActionCommand = `pnpm run lint${additionalArgsStr}`;
          } else if (target.packageManager === "yarn") {
            mainActionCommand = `yarn lint${additionalArgsStr}`;
          } else if (target.packageManager === "bun") {
            mainActionCommand = `bun run lint${additionalArgsStr}`;
          } else {
            mainActionCommand = `npm run lint${additionalArgsStr}`;
          }
          commands.push(mainActionCommand);
        }
        break;
      case "test":
        if (target.packageManager === "pnpm") {
          mainActionCommand = `pnpm run test${additionalArgsStr}`;
        } else if (target.packageManager === "yarn") {
          mainActionCommand = `yarn test${additionalArgsStr}`;
        } else if (target.packageManager === "bun") {
          mainActionCommand = `bun run test${additionalArgsStr}`;
        } else {
          mainActionCommand = `npm run test${additionalArgsStr}`;
        }
        commands.push(mainActionCommand);
        break;
      case "add-package":
        // For add-package, expect first arg to be package name
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for add-package action");
        }

        const packageName = additionalArgs[0];
        const isDev = additionalArgs.includes("--dev");
        const otherArgs = additionalArgs.slice(1).filter(arg => arg !== "--dev");

        if (target.packageManager === "pnpm") {
          mainActionCommand = `pnpm add${isDev ? " -D" : ""} ${packageName}${otherArgs.length > 0 ? ` ${otherArgs.join(' ')}` : ''}`;
        } else if (target.packageManager === "yarn") {
          mainActionCommand = `yarn add${isDev ? " -D" : ""} ${packageName}${otherArgs.length > 0 ? ` ${otherArgs.join(' ')}` : ''}`;
        } else if (target.packageManager === "bun") {
          mainActionCommand = `bun add${isDev ? " -D" : ""} ${packageName}${otherArgs.length > 0 ? ` ${otherArgs.join(' ')}` : ''}`;
        } else {
          mainActionCommand = `npm install${isDev ? " --save-dev" : ""} ${packageName}${otherArgs.length > 0 ? ` ${otherArgs.join(' ')}` : ''}`;
        }
        commands.push(mainActionCommand);
        break;
      case "remove-package":
        // For remove-package, expect first arg to be package name
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for remove-package action");
        }

        const packageToRemove = additionalArgs[0];
        const removeOtherArgs = additionalArgs.slice(1);

        if (target.packageManager === "pnpm") {
          mainActionCommand = `pnpm remove ${packageToRemove}${removeOtherArgs.length > 0 ? ` ${removeOtherArgs.join(' ')}` : ''}`;
        } else if (target.packageManager === "yarn") {
          mainActionCommand = `yarn remove ${packageToRemove}${removeOtherArgs.length > 0 ? ` ${removeOtherArgs.join(' ')}` : ''}`;
        } else if (target.packageManager === "bun") {
          mainActionCommand = `bun remove ${packageToRemove}${removeOtherArgs.length > 0 ? ` ${removeOtherArgs.join(' ')}` : ''}`;
        } else {
          mainActionCommand = `npm uninstall ${packageToRemove}${removeOtherArgs.length > 0 ? ` ${removeOtherArgs.join(' ')}` : ''}`;
        }
        commands.push(mainActionCommand);
        break;
    }

    return commands;
  }
};
