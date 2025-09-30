#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { CLIAuth } from "../lib/cli-web-auth/index.js";
import { renderInstall, renderMCPStatus } from "./install";
import { supabase } from "../lib/supabase-client.js";
import { install, search } from "./agent.js";
import { detectRepo, executeRepositoryCommand, executeAddCommand, ExecuteCommandOptions, ExecuteAddCommandOptions } from "../install-agent/repository-detector.js";
import { executeRepositoryCommandV2, analyzeRepositoryV2, ActionType } from "../install-agent/repodetect/index.js";
import path from "path";
import fs from "fs";

export class MCPPackageCLI {
  private program: Command;
  private cliAuth: CLIAuth;

  constructor() {
    // Load configuration from environment variables
    this.cliAuth = new CLIAuth(supabase.auth, "sourcewizard");
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name("sourcewizard")
      .description(
        "SourceWizard - Intelligent package and code snippet management"
      )
      .version("1.0.0");

    // Authentication commands
    this.program
      .command("login")
      .description("Login to your account using web browser")
      .action(async () => {
        await this.handleLogin();
      });

    this.program
      .command("logout")
      .description("Logout from your account")
      .action(async () => {
        await this.handleLogout();
      });

    this.program
      .command("whoami")
      .description("Show current user information")
      .action(async () => {
        await this.handleWhoami();
      });

    // Search command
    this.program
      .command("search")
      .alias("s")
      .description("Search for packages and code snippets")
      .argument("<query>", "Search query")
      .argument("[path]", "Path to the repository")
      .option("-l, --language <language>", "Filter by language (for snippets)")
      .option("-n, --limit <number>", "Number of results to show", "10")
      .option(
        "--sort <sort>",
        "Sort by (relevance|popularity|date|name)",
        "relevance"
      )
      .action(async (query, path, options) => {
        const jwt = await this.ensureAuthenticated();
        search(query, path || process.cwd(), jwt);
      });


    // Install command
    this.program
      .command("install")
      .alias("i")
      .description("Install a package or code snippet with AI guidance")
      .argument("[name]", "Package or snippet name to install")
      .action(async (name: string | undefined, options: any) => {
        const jwt = await this.ensureAuthenticated();
        renderInstall(name, jwt);
        // install(name, process.cwd());
      });

    // Status command - watch MCP installation progress
    this.program
      .command("status")
      .alias("st")
      .description("Watch installation progress from MCP server")
      .action(async () => {
        renderMCPStatus("", undefined); // No package name needed, just watch status
      });

    // MCP command
    this.program
      .command("mcp")
      .description("Start SourceWizard as an MCP server")
      .action(async () => {
        // Import and start the MCP server
        const { main } = await import("../mcp/server.js");
        await main();
      });

    // Main commands (v2 moved to first level)
    this.program
      .command("build")
      .description("Build the project using repository detection")
      .argument("[target]", "Target to build (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommandV2("build", target, options.path);
      });

    // Dev command
    this.program
      .command("dev")
      .description("Start development server using repository detection")
      .argument("[target]", "Target to run in dev mode (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .allowUnknownOption()
      .action(async (target, options, command) => {
        // Extract additional arguments after -- from raw args
        const rawArgs = command.args || [];
        const dashDashIndex = process.argv.indexOf('--');
        const additionalArgs = dashDashIndex !== -1 ? process.argv.slice(dashDashIndex + 1) : [];

        await this.handleRepositoryCommandV2("dev", target, options.path, additionalArgs);
      });

    // Check command
    this.program
      .command("check")
      .description("Run type/lint checks using repository detection")
      .argument("[target]", "Target to check (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommandV2("check", target, options.path);
      });

    // Lint command
    this.program
      .command("lint")
      .description("Run linting using repository detection")
      .argument("[target]", "Target to lint (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .allowUnknownOption()
      .action(async (target, options, command) => {
        // Extract additional arguments after -- from raw args
        const rawArgs = command.args || [];
        const dashDashIndex = process.argv.indexOf('--');
        const additionalArgs = dashDashIndex !== -1 ? process.argv.slice(dashDashIndex + 1) : [];

        await this.handleRepositoryCommandV2("lint", target, options.path, additionalArgs);
      });

    // Typecheck command - alias to check
    this.program
      .command("typecheck")
      .alias("tc")
      .description("Run type checking using repository detection (alias for check)")
      .argument("[target]", "Target to typecheck (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommandV2("check", target, options.path);
      });

    // Test command
    this.program
      .command("test")
      .description("Run tests using repository detection")
      .argument("[target]", "Target to test (defaults to current directory target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommandV2("test", target, options.path);
      });

    // Run command - alias to dev
    this.program
      .command("run")
      .alias("r")
      .description("Run any package.json script for the target (alias for dev)")
      .argument("[target]", "Target to run (defaults to current directory target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .allowUnknownOption()
      .action(async (target, options, command) => {
        // Extract additional arguments after -- from raw args
        const rawArgs = command.args || [];
        const dashDashIndex = process.argv.indexOf('--');
        const additionalArgs = dashDashIndex !== -1 ? process.argv.slice(dashDashIndex + 1) : [];

        await this.handleRepositoryCommandV2("dev", target, options.path, additionalArgs);
      });

    // Add command
    this.program
      .command("add")
      .alias("a")
      .description("Add a package to the project using repository detection")
      .argument("<package>", "Package name to add")
      .argument("[target]", "Target to add package to (defaults to current directory target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .option("--dev", "Add as development dependency")
      .allowUnknownOption()
      .action(async (packageName, target, options, command) => {
        // Extract additional arguments after -- from raw args
        const rawArgs = command.args || [];
        const dashDashIndex = process.argv.indexOf('--');
        const additionalArgs = dashDashIndex !== -1 ? process.argv.slice(dashDashIndex + 1) : [];

        // Pass package name and dev flag in additional args
        const actionArgs = [packageName];
        if (options.dev) actionArgs.push("--dev");
        actionArgs.push(...additionalArgs);

        await this.handleRepositoryCommandV2("add-package", target, options.path, actionArgs);
      });

    // Remove command
    this.program
      .command("remove")
      .alias("rm")
      .description("Remove a package from the project using repository detection")
      .argument("<package>", "Package name to remove")
      .argument("[target]", "Target to remove package from (defaults to current directory target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .allowUnknownOption()
      .action(async (packageName, target, options, command) => {
        // Extract additional arguments after -- from raw args
        const rawArgs = command.args || [];
        const dashDashIndex = process.argv.indexOf('--');
        const additionalArgs = dashDashIndex !== -1 ? process.argv.slice(dashDashIndex + 1) : [];

        // Pass package name in additional args
        const actionArgs = [packageName];
        actionArgs.push(...additionalArgs);

        await this.handleRepositoryCommandV2("remove-package", target, options.path, actionArgs);
      });

    // Old commands (legacy v1 system)
    const oldCommand = this.program
      .command("old")
      .description("Legacy v1 commands using old repository detection");

    oldCommand
      .command("build")
      .description("Build the project using legacy repository detection")
      .argument("[target]", "Target to build (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommand("build", target, options.path);
      });

    oldCommand
      .command("dev")
      .description("Start development server using legacy repository detection")
      .argument("[target]", "Target to run in dev mode (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .allowUnknownOption()
      .action(async (target, options, command) => {
        // Extract additional arguments after -- from raw args
        const rawArgs = command.args || [];
        const dashDashIndex = process.argv.indexOf('--');
        const additionalArgs = dashDashIndex !== -1 ? process.argv.slice(dashDashIndex + 1) : [];

        await this.handleRepositoryCommand("dev", target, options.path, additionalArgs);
      });

    oldCommand
      .command("check")
      .description("Run type/lint checks using legacy repository detection")
      .argument("[target]", "Target to check (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommand("check", target, options.path);
      });

    oldCommand
      .command("test")
      .description("Run tests using legacy repository detection")
      .argument("[target]", "Target to test (defaults to current directory target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommand("test", target, options.path);
      });

    oldCommand
      .command("add")
      .alias("a")
      .description("Add a package to the project using legacy repository detection")
      .argument("<package>", "Package name to add")
      .argument("[target]", "Target to add package to (defaults to current directory target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .option("--dev", "Add as development dependency")
      .action(async (packageName, target, options) => {
        await this.handleAddCommand(packageName, target, options.path, options.dev);
      });

    // Repo analysis command
    this.program
      .command("repo")
      .description("Analyze repository and output JSON with all targets and info")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (options) => {
        await this.handleRepoAnalysisV2(options.path);
      });
  }

  private async handleLogin(): Promise<void> {
    try {
      const loginPageUrl = process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "https://sourcewizard.ai";

      const result = await this.cliAuth.login({
        loginPageUrl,
      });

      if (result.isAuthenticated) {
        console.log(chalk.green("✓ Successfully logged in!"));
        console.log(chalk.gray(`Welcome back, ${result.user?.email}`));
      } else {
        console.log(
          chalk.yellow(
            "Login successful, but please check your email to confirm your account."
          )
        );
      }
    } catch (error) {
      console.error(
        chalk.red("Login failed:"),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  private async handleLogout(): Promise<void> {
    try {
      await this.cliAuth.logout();
      console.log(chalk.green("✓ Successfully logged out!"));
    } catch (error) {
      console.error(
        chalk.red("Logout failed:"),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  private async handleWhoami(): Promise<void> {
    try {
      const status = await this.cliAuth.getStatus();

      if (status.isAuthenticated && status.user) {
        console.log(chalk.green("✓ You are logged in"));
        console.log(chalk.gray(`Email: ${status.user.email}`));
        console.log(chalk.gray(`User ID: ${status.user.id}`));
      } else {
        console.log(chalk.yellow("You are not logged in"));
        console.log(chalk.gray('Use "sourcewizard login" to authenticate'));
      }
    } catch (error) {
      console.error(
        chalk.red("Failed to get user status:"),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  private async ensureAuthenticated(): Promise<string | undefined> {
    // Check if we have API key first
    const hasApiKey = !!process.env.SOURCEWIZARD_API_KEY;

    if (hasApiKey) {
      console.log(chalk.yellow("Using API key authentication"));
      return undefined;
    }

    // Get JWT token from current session
    let jwt: string | undefined;
    try {
      const tokens = await this.cliAuth.getStatus();
      if (tokens.isAuthenticated) {
        // Get the actual JWT token from token storage
        const tokenStorage = (this.cliAuth as any).tokenStorage;
        const storedTokens = await tokenStorage.getTokens();
        jwt = storedTokens?.accessToken;
      }
    } catch (error) {
      // Authentication failed - will try to get from token storage directly
    }

    // If no JWT from status, try getting directly from token storage
    if (!jwt) {
      try {
        const tokenStorage = (this.cliAuth as any).tokenStorage;
        const storedTokens = await tokenStorage.getTokens();
        jwt = storedTokens?.accessToken;
      } catch (error) {
        // Token storage failed
      }
    }

    if (!jwt) {
      console.log(chalk.yellow("Authentication required. Starting login..."));
      await this.handleLogin();

      // After login, get JWT directly from token storage since login was successful
      try {
        const tokenStorage = (this.cliAuth as any).tokenStorage;
        const storedTokens = await tokenStorage.getTokens();
        jwt = storedTokens?.accessToken;
      } catch (error) {
        console.log(chalk.red("❌ Failed to retrieve tokens after login"));
        process.exit(1);
      }

      if (!jwt) {
        console.log(chalk.red("❌ No access token found after login"));
        process.exit(1);
      }
    }

    return jwt;
  }

  private findGitRepoRoot(startPath: string): string {
    let currentPath = path.resolve(startPath);
    const root = path.parse(currentPath).root;

    while (currentPath !== root) {
      const gitPath = path.join(currentPath, '.git');
      if (fs.existsSync(gitPath)) {
        return currentPath;
      }
      currentPath = path.dirname(currentPath);
    }

    // If no .git found, return the starting path
    return path.resolve(startPath);
  }

  private normalizeTargetPath(target: string | undefined, workingDir: string): string | undefined {
    if (!target) return undefined;

    // If target starts with //, it's already a repository-root-relative path
    if (target.startsWith("//")) {
      // Remove trailing slashes for consistency
      return target.replace(/\/+$/, "");
    }

    // If target contains a colon, it might be a target key - don't modify
    if (target.includes(":")) {
      return target;
    }

    // If target is an absolute path, don't modify
    if (path.isAbsolute(target)) {
      return target;
    }

    // Handle relative paths
    let cleanTarget = target;

    // Strip leading ./ if present
    if (cleanTarget.startsWith("./")) {
      cleanTarget = cleanTarget.substring(2);
    }

    // Get current directory relative to repo root
    const currentRelative = path.relative(workingDir, process.cwd());

    let resolvedPath: string;
    if (currentRelative === "") {
      // We're at repo root
      if (cleanTarget === "" || cleanTarget === ".") {
        // Target is current directory (repo root)
        return "//";
      }
      // Resolve relative path from repo root
      resolvedPath = path.normalize(cleanTarget);
    } else {
      // We're in a subdirectory
      if (cleanTarget === "" || cleanTarget === ".") {
        // Target is current directory
        resolvedPath = currentRelative;
      } else {
        // Resolve relative path from current directory
        resolvedPath = path.normalize(path.join(currentRelative, cleanTarget));
      }
    }

    // Handle cases where path goes above repo root
    if (resolvedPath.startsWith("..")) {
      throw new Error(`Target path "${target}" resolves outside of repository root`);
    }

    // Convert to repository-root-relative format
    const normalized = resolvedPath === "." ? "//" : `//${resolvedPath}`;
    return normalized.replace(/\/+$/, ""); // Remove trailing slashes
  }

  private async handleRepositoryCommand(
    actionType: "build" | "dev" | "check" | "test",
    targetArg: string | undefined,
    repoPath: string | undefined,
    additionalArgs: string[] = []
  ): Promise<void> {
    try {
      const jwt = await this.ensureAuthenticated();

      const workingDir = repoPath ? path.resolve(repoPath) : this.findGitRepoRoot(process.cwd());
      const normalizedTarget = this.normalizeTargetPath(targetArg, workingDir);

      const options: ExecuteCommandOptions = {
        onOutput: (message: string, type: 'info' | 'error' | 'success') => {
          switch (type) {
            case 'info':
              console.log(chalk.blue(message));
              break;
            case 'success':
              console.log(chalk.green(message));
              break;
            case 'error':
              console.log(chalk.red(message));
              break;
          }
        },
        additionalArgs
      };

      await executeRepositoryCommand(actionType, targetArg, workingDir, options);

    } catch (error) {
      console.error(
        chalk.red(`❌ ${actionType} failed:`),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  private async handleRepositoryCommandV2(
    actionType: ActionType,
    targetArg: string | undefined,
    repoPath: string | undefined,
    additionalArgs: string[] = []
  ): Promise<void> {
    try {
      const jwt = await this.ensureAuthenticated();

      const workingDir = repoPath ? path.resolve(repoPath) : this.findGitRepoRoot(process.cwd());
      const currentDir = process.cwd()

      await executeRepositoryCommandV2(workingDir, currentDir, actionType, targetArg, additionalArgs);

    } catch (error) {
      console.error(
        chalk.red(`❌${actionType} v2 failed:`),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  private async handleRepoAnalysisV2(
    repoPath: string | undefined
  ): Promise<void> {
    try {
      const jwt = await this.ensureAuthenticated();

      const workingDir = repoPath ? path.resolve(repoPath) : this.findGitRepoRoot(process.cwd());

      const repoAnalysis = await analyzeRepositoryV2(workingDir);

      console.log(JSON.stringify(repoAnalysis, null, 2));

    } catch (error) {
      console.error(
        chalk.red("❌ Repository analysis failed:"),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  private async handleAddCommand(
    packageName: string,
    targetArg: string | undefined,
    repoPath: string | undefined,
    isDev: boolean = false
  ): Promise<void> {
    try {
      const jwt = await this.ensureAuthenticated();

      const workingDir = repoPath ? path.resolve(repoPath) : this.findGitRepoRoot(process.cwd());
      const normalizedTarget = this.normalizeTargetPath(targetArg, workingDir);

      const options: ExecuteAddCommandOptions = {
        packageName,
        isDev,
        onOutput: (message: string, type: 'info' | 'error' | 'success') => {
          switch (type) {
            case 'info':
              console.log(chalk.blue(message));
              break;
            case 'success':
              console.log(chalk.green(message));
              break;
            case 'error':
              console.log(chalk.red(message));
              break;
          }
        }
      };

      await executeAddCommand(targetArg, workingDir, options);

    } catch (error) {
      console.error(
        chalk.red(`❌ Failed to add package ${packageName}:`),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }


  async run(): Promise<void> {
    try {
      // Initialize authentication on startup
      await this.cliAuth.initialize();

      // Handle -- argument separation for dev command
      let argsToProcess = process.argv;
      const dashDashIndex = process.argv.indexOf('--');

      if (dashDashIndex !== -1 && process.argv.includes('dev')) {
        // Remove -- and everything after it from commander parsing
        argsToProcess = process.argv.slice(0, dashDashIndex);
      }

      await this.program.parseAsync(argsToProcess);
    } catch (error) {
      console.error(
        chalk.red("CLI Error:"),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }
}

// Run CLI - this file is always the entry point when used as a binary
const cli = new MCPPackageCLI();
cli.run();
