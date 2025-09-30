import { promises as fs, Dirent } from "fs";
import * as path from "path";
import { Target, PackageDetector } from "../package.js";

interface ComposerJson {
  name?: string;
  require?: Record<string, string>;
  "require-dev"?: Record<string, string>;
}

async function detectPhpFramework(currentPath: string): Promise<string | undefined> {
  try {
    const composerPath = path.join(currentPath, 'composer.json');
    const content = await fs.readFile(composerPath, 'utf-8');
    const composer: ComposerJson = JSON.parse(content);
    
    const allDeps = { ...composer.require, ...composer["require-dev"] };
    
    if (allDeps['laravel/framework']) return "laravel";
    if (allDeps['symfony/framework-bundle']) return "symfony";
    if (allDeps['cakephp/cakephp']) return "cakephp";
    if (allDeps['codeigniter4/framework']) return "codeigniter";
    if (allDeps['zendframework/zendframework'] || allDeps['laminas/laminas-mvc']) return "laminas";
    if (allDeps['yiisoft/yii2']) return "yii2";
    if (allDeps['phalcon/cphalcon']) return "phalcon";
    if (allDeps['slim/slim']) return "slim";
    
    // Check for WordPress (might not be in composer.json)
    const wpConfigPath = path.join(currentPath, 'wp-config.php');
    try {
      await fs.access(wpConfigPath);
      return "wordpress";
    } catch {}
    
  } catch {}
  
  return undefined;
}

async function extractProjectNameFromComposer(currentPath: string): Promise<string> {
  try {
    const composerPath = path.join(currentPath, 'composer.json');
    const content = await fs.readFile(composerPath, 'utf-8');
    const composer: ComposerJson = JSON.parse(content);
    
    if (composer.name) {
      // Extract project name from composer name (e.g., "vendor/project" -> "project")
      return composer.name.split('/').pop() || composer.name;
    }
  } catch {}
  
  return path.basename(currentPath);
}

function detectPackageManager(entries: Dirent[]): string {
  if (entries.some(e => e.name === 'composer.lock')) return "composer";
  return "composer"; // PHP primarily uses composer
}

export const phpDetector: PackageDetector = {
  name: "PHP",
  language: "php",
  configFiles: ["composer.json", "wp-config.php"],
  
  async detect(currentPath: string, repoRoot: string, entries: Dirent[]): Promise<Target[]> {
    const composerEntry = entries.find(e => e.name === 'composer.json' && e.isFile());
    const wpConfigEntry = entries.find(e => e.name === 'wp-config.php' && e.isFile());
    
    if (!composerEntry && !wpConfigEntry) return [];
    
    try {
      const relativePath = path.relative(repoRoot, currentPath);
      const normalizedPath = relativePath === "" ? "//" : `//${relativePath}`;
      
      let targetName: string;
      if (composerEntry) {
        targetName = await extractProjectNameFromComposer(currentPath);
      } else {
        // WordPress without composer
        targetName = path.basename(currentPath);
      }
      
      return [{
        id: `${normalizedPath}:${targetName}`,
        name: targetName,
        path: normalizedPath,
        language: "php",
        packageManager: detectPackageManager(entries),
        framework: await detectPhpFramework(currentPath)
      }];
    } catch {
      return [];
    }
  },

  async generateCommands(target: Target, actionType: "build" | "dev" | "check" | "lint" | "test" | "add-package" | "remove-package", workingDir: string, additionalArgs: string[] = []): Promise<string[]> {
    const commands: string[] = [];

    switch (actionType) {
      case "build":
        commands.push("composer install");
        break;
      case "dev":
        if (target.framework === "laravel") {
          commands.push("php artisan serve");
        } else if (target.framework === "symfony") {
          commands.push("symfony server:start");
        } else {
          commands.push("php -S localhost:8000");
        }
        break;
      case "check":
        commands.push("./vendor/bin/phpstan analyse");
        commands.push("./vendor/bin/phpcs");
        break;
      case "lint":
        commands.push("./vendor/bin/phpstan analyse");
        commands.push("./vendor/bin/phpcs");
        break;
      case "test":
        commands.push("./vendor/bin/phpunit");
        break;
      case "add-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for add-package action");
        }

        const packageName = additionalArgs[0];
        const isDevDependency = additionalArgs.includes("--dev");
        const otherArgs = additionalArgs.slice(1).filter(arg => arg !== "--dev");

        let command = `composer require ${packageName}`;
        if (isDevDependency) command += " --dev";
        if (otherArgs.length > 0) command += ` ${otherArgs.join(" ")}`;
        commands.push(command);
        break;
      case "remove-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for remove-package action");
        }

        const removePackageName = additionalArgs[0];
        const removeOtherArgs = additionalArgs.slice(1);

        let removeCommand = `composer remove ${removePackageName}`;
        if (removeOtherArgs.length > 0) removeCommand += ` ${removeOtherArgs.join(" ")}`;
        commands.push(removeCommand);
        break;
    }

    return commands;
  }
};