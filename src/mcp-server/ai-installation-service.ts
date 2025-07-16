import { promises as fs } from "fs";
import { spawn } from "child_process";
import path from "path";
import type {
  InstallationOptions,
  InstallationResult,
  AIInstallationInstruction,
  ProjectContext,
  Package,
  CodeSnippet,
} from "../shared/types.js";
import { Registry } from "../registry/registry.js";

export class AIInstallationService {
  private registry: Registry;
  private instructions: Map<string, AIInstallationInstruction> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.registry = new Registry();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.registry.initialize();
    await this.loadAIInstructions();
    this.initialized = true;
  }

  private async loadAIInstructions(): Promise<void> {
    // Load predefined AI instructions for common packages
    const defaultInstructions: AIInstallationInstruction[] = [
      {
        id: "express-setup",
        packageName: "express",
        instructions: `
1. Install express: npm install express
2. Create basic server structure in app.js or server.js
3. Set up middleware for JSON parsing
4. Add basic route handlers
5. Configure port and error handling
6. Optional: Add TypeScript types with @types/express
        `,
        conditions: ["web", "api", "server"],
        priority: 10,
        lastUpdated: new Date(),
        success_rate: 95,
      },
      {
        id: "react-setup",
        packageName: "react",
        instructions: `
1. Install React: npm install react react-dom
2. Install TypeScript types: npm install --save-dev @types/react @types/react-dom
3. Set up basic component structure
4. Configure bundler (Vite, Webpack, etc.)
5. Create index.html with root div
6. Set up hot module replacement for development
        `,
        conditions: ["web", "ui", "frontend"],
        priority: 10,
        lastUpdated: new Date(),
        success_rate: 92,
      },
      {
        id: "lodash-setup",
        packageName: "lodash",
        instructions: `
1. Install lodash: npm install lodash
2. Install TypeScript types: npm install --save-dev @types/lodash
3. Import specific functions to reduce bundle size
4. Consider using lodash-es for ES modules
5. Use tree-shaking compatible imports
        `,
        conditions: ["utility", "performance"],
        priority: 8,
        lastUpdated: new Date(),
        success_rate: 98,
      },
    ];

    for (const instruction of defaultInstructions) {
      this.instructions.set(instruction.packageName, instruction);
    }
  }

  async installPackage(
    options: InstallationOptions
  ): Promise<InstallationResult> {
    try {
      const startTime = Date.now();

      // First, try to find the package in registry
      const pkg = await this.registry.getPackage(options.packageName);
      const snippet = await this.registry.getSnippet(options.packageName);

      if (!pkg && !snippet) {
        return {
          success: false,
          message: `Package or snippet "${options.packageName}" not found in registry`,
          errors: [
            `No package or snippet found with name: ${options.packageName}`,
          ],
        };
      }

      // Get project context to make intelligent decisions
      const projectContext = await this.getProjectContext();

      if (pkg) {
        return await this.installNpmPackage(pkg, options, projectContext);
      } else if (snippet) {
        return await this.installCodeSnippet(snippet, options, projectContext);
      }

      return {
        success: false,
        message: "Unknown installation type",
        errors: ["Could not determine installation type"],
      };
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  private async installNpmPackage(
    pkg: Package,
    options: InstallationOptions,
    projectContext: ProjectContext
  ): Promise<InstallationResult> {
    const result: InstallationResult = {
      success: false,
      message: "",
      installedPackages: [],
      createdFiles: [],
      errors: [],
      warnings: [],
    };

    try {
      // Get AI instructions for this package
      const aiInstructions = this.getAIInstructions(
        pkg,
        projectContext,
        options
      );

      // Determine package manager
      const packageManager = this.detectPackageManager(projectContext);

      // Build install command
      const installCmd = this.buildInstallCommand(
        pkg.name,
        packageManager,
        options
      );

      // Execute installation
      const installResult = await this.executeCommand(installCmd);

      if (!installResult.success) {
        result.errors = installResult.errors;
        result.message = `Failed to install ${pkg.name}: ${installResult.message}`;
        return result;
      }

      result.installedPackages = [pkg.name];
      result.message = `Successfully installed ${pkg.name}`;

      // Apply AI-guided setup if available
      if (aiInstructions) {
        const setupResult = await this.applyAISetup(
          pkg,
          aiInstructions,
          projectContext
        );
        result.createdFiles = setupResult.createdFiles;
        result.warnings = setupResult.warnings;
      }

      result.success = true;
      return result;
    } catch (error) {
      result.errors?.push(
        error instanceof Error ? error.message : String(error)
      );
      result.message = `Installation failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      return result;
    }
  }

  private async installCodeSnippet(
    snippet: CodeSnippet,
    options: InstallationOptions,
    projectContext: ProjectContext
  ): Promise<InstallationResult> {
    const result: InstallationResult = {
      success: false,
      message: "",
      installedPackages: [],
      createdFiles: [],
      errors: [],
      warnings: [],
    };

    try {
      // Install dependencies first if any
      if (snippet.dependencies && snippet.dependencies.length > 0) {
        for (const dep of snippet.dependencies) {
          const depResult = await this.installPackage({
            packageName: dep,
            dev: options.dev,
            global: options.global,
          });

          if (!depResult.success) {
            result.warnings?.push(`Failed to install dependency: ${dep}`);
          } else {
            result.installedPackages?.push(dep);
          }
        }
      }

      // Create file for the snippet
      const fileName = this.generateSnippetFileName(snippet, projectContext);
      const filePath = path.join(
        options.customInstallPath || this.getDefaultSnippetPath(projectContext),
        fileName
      );

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write the snippet to file
      await fs.writeFile(filePath, snippet.code, "utf-8");

      result.createdFiles = [filePath];
      result.message = `Successfully created ${fileName} with code snippet`;
      result.success = true;

      // Add usage instructions if available
      if (snippet.usageExample) {
        const usageFile = filePath.replace(
          path.extname(filePath),
          ".example" + path.extname(filePath)
        );
        await fs.writeFile(usageFile, snippet.usageExample, "utf-8");
        result.createdFiles.push(usageFile);
      }

      return result;
    } catch (error) {
      result.errors?.push(
        error instanceof Error ? error.message : String(error)
      );
      result.message = `Code snippet installation failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      return result;
    }
  }

  private async getProjectContext(): Promise<ProjectContext> {
    const defaultContext: ProjectContext = {
      name: "unknown",
      version: "1.0.0",
      packageManager: "npm",
      language: "javascript",
      dependencies: {},
      devDependencies: {},
      scripts: {},
      projectType: "node",
    };

    try {
      // Try to read package.json
      const packageJsonPath = path.join(process.cwd(), "package.json");
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf-8")
      );

      return {
        name: packageJson.name || "unknown",
        version: packageJson.version || "1.0.0",
        packageManager: this.detectPackageManager(defaultContext),
        language: packageJson.type === "module" ? "javascript" : "javascript",
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        scripts: packageJson.scripts || {},
        projectType: this.detectProjectType(packageJson),
        framework: this.detectFramework(packageJson),
      };
    } catch {
      return defaultContext;
    }
  }

  private detectPackageManager(
    context: ProjectContext
  ): "npm" | "yarn" | "pnpm" | "bun" {
    // Check for lock files
    const lockFiles = [
      { file: "yarn.lock", manager: "yarn" as const },
      { file: "pnpm-lock.yaml", manager: "pnpm" as const },
      { file: "bun.lockb", manager: "bun" as const },
      { file: "package-lock.json", manager: "npm" as const },
    ];

    for (const { file, manager } of lockFiles) {
      try {
        const filePath = path.join(process.cwd(), file);
        fs.access(filePath);
        return manager;
      } catch {
        continue;
      }
    }

    return "npm";
  }

  private detectProjectType(packageJson: any): ProjectContext["projectType"] {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (dependencies["react"] || dependencies["react-dom"]) return "web";
    if (dependencies["express"] || dependencies["fastify"]) return "web";
    if (dependencies["electron"]) return "desktop";
    if (dependencies["react-native"]) return "mobile";
    if (packageJson.bin) return "cli";
    if (packageJson.main && !packageJson.scripts?.start) return "library";

    return "node";
  }

  private detectFramework(packageJson: any): string | undefined {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (dependencies["react"]) return "react";
    if (dependencies["vue"]) return "vue";
    if (dependencies["angular"]) return "angular";
    if (dependencies["svelte"]) return "svelte";
    if (dependencies["express"]) return "express";
    if (dependencies["next"]) return "next";
    if (dependencies["nuxt"]) return "nuxt";

    return undefined;
  }

  private buildInstallCommand(
    packageName: string,
    packageManager: string,
    options: InstallationOptions
  ): string {
    let cmd = packageManager;

    if (packageManager === "npm") {
      cmd += " install";
    } else if (packageManager === "yarn") {
      cmd += " add";
    } else if (packageManager === "pnpm") {
      cmd += " add";
    } else if (packageManager === "bun") {
      cmd += " add";
    }

    if (options.global) {
      cmd += packageManager === "npm" ? " -g" : " --global";
    }

    if (options.dev) {
      cmd += packageManager === "npm" ? " --save-dev" : " --dev";
    }

    if (options.version) {
      cmd += ` ${packageName}@${options.version}`;
    } else {
      cmd += ` ${packageName}`;
    }

    return cmd;
  }

  private async executeCommand(command: string): Promise<{
    success: boolean;
    message: string;
    errors?: string[];
  }> {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(" ");
      const child = spawn(cmd, args, {
        stdio: "pipe",
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: stdout,
          });
        } else {
          resolve({
            success: false,
            message: stderr,
            errors: stderr.split("\n").filter((line) => line.trim()),
          });
        }
      });

      child.on("error", (error) => {
        resolve({
          success: false,
          message: error.message,
          errors: [error.message],
        });
      });
    });
  }

  private getAIInstructions(
    pkg: Package,
    context: ProjectContext,
    options: InstallationOptions
  ): AIInstallationInstruction | null {
    const instruction = this.instructions.get(pkg.name);

    if (!instruction) return null;

    // Check if conditions match
    const contextConditions = [
      context.projectType,
      context.framework,
      ...Object.keys(context.dependencies),
      ...pkg.keywords,
    ].filter(Boolean);

    const hasMatchingCondition = instruction.conditions?.some((condition) =>
      contextConditions.includes(condition)
    );

    return hasMatchingCondition ? instruction : instruction;
  }

  private async applyAISetup(
    pkg: Package,
    instructions: AIInstallationInstruction,
    context: ProjectContext
  ): Promise<{
    createdFiles: string[];
    warnings: string[];
  }> {
    const result = {
      createdFiles: [] as string[],
      warnings: [] as string[],
    };

    // For now, just log the AI instructions
    // In a real implementation, this would use an AI service to execute the instructions
    console.log(`AI Instructions for ${pkg.name}:`, instructions.instructions);

    result.warnings.push(
      `AI instructions available for ${pkg.name}. Check console for details.`
    );

    return result;
  }

  private generateSnippetFileName(
    snippet: CodeSnippet,
    context: ProjectContext
  ): string {
    const extension = this.getFileExtension(snippet.language);
    const name = snippet.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    return `${name}.${extension}`;
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      java: "java",
      c: "c",
      cpp: "cpp",
      csharp: "cs",
      go: "go",
      rust: "rs",
      php: "php",
      ruby: "rb",
      swift: "swift",
      kotlin: "kt",
      scala: "scala",
      html: "html",
      css: "css",
      scss: "scss",
      less: "less",
      json: "json",
      yaml: "yaml",
      xml: "xml",
      sql: "sql",
      shell: "sh",
      bash: "sh",
      powershell: "ps1",
    };

    return extensions[language.toLowerCase()] || "txt";
  }

  private getDefaultSnippetPath(context: ProjectContext): string {
    const paths: Record<string, string> = {
      web: "src/utils",
      node: "src/utils",
      cli: "src/utils",
      library: "src",
      mobile: "src/utils",
      desktop: "src/utils",
      other: "src/utils",
    };

    return paths[context.projectType] || "src/utils";
  }
}
