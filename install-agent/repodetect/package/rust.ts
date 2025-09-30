import { promises as fs, Dirent } from "fs";
import * as path from "path";
import { Target, PackageDetector } from "../package.js";

async function detectRustFramework(currentPath: string): Promise<string | undefined> {
  try {
    const cargoTomlPath = path.join(currentPath, 'Cargo.toml');
    const content = await fs.readFile(cargoTomlPath, 'utf-8');
    
    if (content.includes('actix-web')) return "actix-web";
    if (content.includes('warp')) return "warp";
    if (content.includes('rocket')) return "rocket";
    if (content.includes('axum')) return "axum";
    if (content.includes('tide')) return "tide";
    if (content.includes('tokio')) return "tokio";
    if (content.includes('serde')) return "serde";
  } catch {}
  
  return undefined;
}

export const rustDetector: PackageDetector = {
  name: "Rust",
  language: "rust",
  configFiles: ["Cargo.toml"],
  
  async detect(currentPath: string, repoRoot: string, entries: Dirent[]): Promise<Target[]> {
    const cargoTomlEntry = entries.find(e => e.name === 'Cargo.toml' && e.isFile());
    if (!cargoTomlEntry) return [];
    
    try {
      const cargoTomlPath = path.join(currentPath, 'Cargo.toml');
      const content = await fs.readFile(cargoTomlPath, 'utf-8');
      const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
      const targetName = nameMatch ? nameMatch[1] : path.basename(currentPath);
      
      const relativePath = path.relative(repoRoot, currentPath);
      const normalizedPath = relativePath === "" ? "//" : `//${relativePath}`;
      
      return [{
        id: `${normalizedPath}:${targetName}`,
        name: targetName,
        path: normalizedPath,
        language: "rust",
        packageManager: "cargo",
        framework: await detectRustFramework(currentPath)
      }];
    } catch {
      return [];
    }
  },

  async generateCommands(target: Target, actionType: "build" | "dev" | "check" | "lint" | "test" | "add-package" | "remove-package", workingDir: string, additionalArgs: string[] = []): Promise<string[]> {
    const commands: string[] = [];

    switch (actionType) {
      case "build":
        commands.push("cargo build");
        break;
      case "dev":
        commands.push("cargo run");
        break;
      case "check":
        commands.push("cargo check");
        commands.push("cargo clippy");
        break;
      case "lint":
        commands.push("cargo check");
        commands.push("cargo clippy");
        break;
      case "test":
        commands.push("cargo test");
        break;
      case "add-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for add-package action");
        }

        const packageName = additionalArgs[0];
        const isDevDependency = additionalArgs.includes("--dev");
        const otherArgs = additionalArgs.slice(1).filter(arg => arg !== "--dev");

        let command = `cargo add ${packageName}`;
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

        let removeCommand = `cargo remove ${removePackageName}`;
        if (removeOtherArgs.length > 0) removeCommand += ` ${removeOtherArgs.join(" ")}`;
        commands.push(removeCommand);
        break;
    }

    return commands;
  }
};