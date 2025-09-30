import { promises as fs, Dirent } from "fs";
import * as path from "path";
import { Target, PackageDetector } from "../package.js";

async function detectRubyFramework(currentPath: string): Promise<string | undefined> {
  try {
    // Check for Rails
    const configPath = path.join(currentPath, 'config');
    try {
      await fs.access(configPath);
      const configEntries = await fs.readdir(configPath);
      if (configEntries.includes('application.rb')) return "rails";
    } catch {}
    
    // Check Gemfile for frameworks
    const gemfilePath = path.join(currentPath, 'Gemfile');
    const content = await fs.readFile(gemfilePath, 'utf-8');
    
    if (content.includes('rails')) return "rails";
    if (content.includes('sinatra')) return "sinatra";
    if (content.includes('grape')) return "grape";
    if (content.includes('roda')) return "roda";
    if (content.includes('hanami')) return "hanami";
  } catch {}
  
  return undefined;
}

async function extractProjectNameFromGemspec(currentPath: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(currentPath);
    const gemspecFile = entries.find(file => file.endsWith('.gemspec'));
    
    if (gemspecFile) {
      const gemspecPath = path.join(currentPath, gemspecFile);
      const content = await fs.readFile(gemspecPath, 'utf-8');
      const nameMatch = content.match(/spec\.name\s*=\s*['"]([^'"]+)['"]/);
      if (nameMatch) return nameMatch[1];
      
      // Fallback to filename without .gemspec
      return path.basename(gemspecFile, '.gemspec');
    }
  } catch {}
  
  return null;
}

function detectPackageManager(entries: Dirent[]): string {
  if (entries.some(e => e.name === 'Gemfile.lock')) return "bundler";
  return "gem";
}

export const rubyDetector: PackageDetector = {
  name: "Ruby",
  language: "ruby",
  configFiles: ["Gemfile", "*.gemspec"],
  
  async detect(currentPath: string, repoRoot: string, entries: Dirent[]): Promise<Target[]> {
    const gemfileEntry = entries.find(e => e.name === 'Gemfile' && e.isFile());
    const gemspecEntry = entries.find(e => e.name.endsWith('.gemspec') && e.isFile());
    
    if (!gemfileEntry && !gemspecEntry) return [];
    
    try {
      const relativePath = path.relative(repoRoot, currentPath);
      const normalizedPath = relativePath === "" ? "//" : `//${relativePath}`;
      
      let targetName = await extractProjectNameFromGemspec(currentPath);
      if (!targetName) {
        targetName = path.basename(currentPath);
      }
      
      return [{
        id: `${normalizedPath}:${targetName}`,
        name: targetName,
        path: normalizedPath,
        language: "ruby",
        packageManager: detectPackageManager(entries),
        framework: await detectRubyFramework(currentPath)
      }];
    } catch {
      return [];
    }
  },

  async generateCommands(target: Target, actionType: "build" | "dev" | "check" | "lint" | "test" | "add-package" | "remove-package", workingDir: string, additionalArgs: string[] = []): Promise<string[]> {
    const commands: string[] = [];

    switch (actionType) {
      case "build":
        commands.push("bundle install");
        break;
      case "dev":
        if (target.framework === "rails") {
          commands.push("bundle exec rails server");
        } else {
          commands.push("ruby app.rb");
        }
        break;
      case "check":
        commands.push("bundle exec rubocop");
        break;
      case "lint":
        commands.push("bundle exec rubocop");
        break;
      case "test":
        if (target.framework === "rails") {
          commands.push("bundle exec rails test");
        } else {
          commands.push("bundle exec rspec");
        }
        break;
      case "add-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for add-package action");
        }

        const packageName = additionalArgs[0];
        const otherArgs = additionalArgs.slice(1).filter(arg => arg !== "--dev");

        let command = `bundle add ${packageName}`;
        if (otherArgs.length > 0) command += ` ${otherArgs.join(" ")}`;
        commands.push(command);
        break;
      case "remove-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for remove-package action");
        }

        const removePackageName = additionalArgs[0];
        const removeOtherArgs = additionalArgs.slice(1);

        let removeCommand = `bundle remove ${removePackageName}`;
        if (removeOtherArgs.length > 0) removeCommand += ` ${removeOtherArgs.join(" ")}`;
        commands.push(removeCommand);
        break;
    }

    return commands;
  }
};