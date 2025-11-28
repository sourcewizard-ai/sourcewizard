import { promises as fs, Dirent } from "fs";
import * as path from "path";
import { Target, PackageDetector } from "../package.js";

async function detectGoFramework(currentPath: string): Promise<string | undefined> {
  try {
    const goModPath = path.join(currentPath, 'go.mod');
    const content = await fs.readFile(goModPath, 'utf-8');
    
    if (content.includes('github.com/gin-gonic/gin')) return "gin";
    if (content.includes('github.com/gorilla/mux')) return "gorilla";
    if (content.includes('github.com/labstack/echo')) return "echo";
    if (content.includes('github.com/gofiber/fiber')) return "fiber";
    if (content.includes('github.com/beego/beego')) return "beego";
  } catch {}
  
  return undefined;
}

export const goDetector: PackageDetector = {
  name: "Go",
  language: "go",
  configFiles: ["go.mod"],
  
  async detect(currentPath: string, repoRoot: string, entries: Dirent[]): Promise<Target[]> {
    const goModEntry = entries.find(e => e.name === 'go.mod' && e.isFile());
    if (!goModEntry) return [];
    
    try {
      const goModPath = path.join(currentPath, 'go.mod');
      const content = await fs.readFile(goModPath, 'utf-8');
      const moduleMatch = content.match(/module\s+([^\s\n]+)/);
      const moduleName = moduleMatch ? moduleMatch[1] : '';
      const targetName = moduleName ? path.basename(moduleName) : path.basename(currentPath);
      
      const relativePath = path.relative(repoRoot, currentPath);
      const normalizedPath = relativePath === "" ? "//" : `//${relativePath}`;
      
      return [{
        id: `${normalizedPath}:${targetName}`,
        name: targetName,
        path: normalizedPath,
        language: "go",
        packageManager: "go",
        framework: await detectGoFramework(currentPath)
      }];
    } catch {
      return [];
    }
  },

  async generateCommands(target: Target, actionType: "build" | "dev" | "check" | "lint" | "test" | "add-package" | "remove-package", workingDir: string, additionalArgs: string[] = []): Promise<string[]> {
    const commands: string[] = [];

    switch (actionType) {
      case "build":
        commands.push("go build");
        break;
      case "dev":
        commands.push("go run .");
        break;
      case "check":
        commands.push("go fmt");
        commands.push("go vet");
        break;
      case "lint":
        commands.push("go fmt");
        commands.push("go vet");
        break;
      case "test":
        commands.push("go test");
        break;
      case "add-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for add-package action");
        }

        const packageName = additionalArgs[0];
        const otherArgs = additionalArgs.slice(1).filter(arg => arg !== "--dev");

        let command = `go get ${packageName}`;
        if (otherArgs.length > 0) command += ` ${otherArgs.join(" ")}`;
        commands.push(command);
        break;
      case "remove-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for remove-package action");
        }

        throw new Error("Manual removal required for Go packages - edit go.mod file and run 'go mod tidy'");
    }

    return commands;
  }
};