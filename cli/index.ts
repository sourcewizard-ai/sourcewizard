#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { CLIAuth } from "../lib/cli-web-auth/index.js";
import { renderInstall, renderMCPStatus } from "./install";
import { supabase } from "../lib/supabase-client.js";
import { install, search } from "./agent.js";
import { detectRepo, executeRepositoryCommand, ExecuteCommandOptions } from "../install-agent/repository-detector.js";
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
      .option("--url <url>", "Custom login page URL")
      .action(async (options) => {
        await this.handleLogin(options);
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
          // Authentication failed - will check for API key below
        }

        // Check if we have either JWT or API key
        const hasApiKey = !!process.env.SOURCEWIZARD_API_KEY;

        if (!jwt && !hasApiKey) {
          console.log(chalk.red("❌ Authentication required"));
          console.log(chalk.yellow("You need to either:"));
          console.log(chalk.gray("  1. Login with: ") + chalk.white("sourcewizard login"));
          console.log(chalk.gray("  2. Set SOURCEWIZARD_API_KEY environment variable"));
          console.log("");
          console.log(chalk.gray("Get your API key at: https://sourcewizard.ai/dashboard"));
          process.exit(1);
        }

        if (!jwt && hasApiKey) {
          console.log(chalk.yellow("Using API key authentication"));
        }

        search(query, path || process.cwd(), jwt);
      });

    this.program
      .command("repo")
      .description("Analyze a repository")
      .argument("[path]", "Path to the repository")
      .action(async (path: string | undefined, options: any) => {
        //renderInstall(name);
        const repo = await detectRepo(path || process.cwd());
        console.log(JSON.stringify(repo, null, 2));
      });

    // Install command
    this.program
      .command("install")
      .alias("i")
      .description("Install a package or code snippet with AI guidance")
      .argument("[name]", "Package or snippet name to install")
      .action(async (name: string | undefined, options: any) => {
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
          // Authentication failed - will check for API key below
        }

        // Check if we have either JWT or API key
        const hasApiKey = !!process.env.SOURCEWIZARD_API_KEY;

        if (!jwt && !hasApiKey) {
          console.log(chalk.red("❌ Authentication required"));
          console.log(chalk.yellow("You need to either:"));
          console.log(chalk.gray("  1. Login with: ") + chalk.white("sourcewizard login"));
          console.log(chalk.gray("  2. Set SOURCEWIZARD_API_KEY environment variable"));
          console.log("");
          console.log(chalk.gray("Get your API key at: https://sourcewizard.ai/dashboard"));
          process.exit(1);
        }

        if (!jwt && hasApiKey) {
          console.log(chalk.yellow("Using API key authentication"));
        }

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

    // Build command
    this.program
      .command("build")
      .description("Build the project using repository detection")
      .argument("[target]", "Target to build (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommand("build", target, options.path);
      });

    // Dev command  
    this.program
      .command("dev")
      .description("Start development server using repository detection")
      .argument("[target]", "Target to run in dev mode (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommand("dev", target, options.path);
      });

    // Check command
    this.program
      .command("check")
      .description("Run type/lint checks using repository detection")
      .argument("[target]", "Target to check (defaults to root target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommand("check", target, options.path);
      });

    // Test command
    this.program
      .command("test")
      .description("Run tests using repository detection")
      .argument("[target]", "Target to test (defaults to current directory target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommand("test", target, options.path);
      });

    // Run command - alias to dev
    this.program
      .command("run")
      .alias("r")
      .description("Run any package.json script for the target (alias for dev)")
      .argument("[target]", "Target to run (defaults to current directory target)")
      .option("--path <path>", "Path to the repository (defaults to git root)")
      .action(async (target, options) => {
        await this.handleRepositoryCommand("dev", target, options.path);
      });
  }

  private async handleLogin(options: { url?: string }): Promise<void> {
    try {
      const result = await this.cliAuth.login({
        loginPageUrl: options.url,
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

  private async handleRepositoryCommand(
    actionType: "build" | "dev" | "check" | "test", 
    targetArg: string | undefined,
    repoPath: string | undefined
  ): Promise<void> {
    try {
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
        // Authentication failed - will check for API key below
      }

      // Check if we have either JWT or API key
      const hasApiKey = !!process.env.SOURCEWIZARD_API_KEY;

      if (!jwt && !hasApiKey) {
        console.log(chalk.red("❌ Authentication required"));
        console.log(chalk.yellow("You need to either:"));
        console.log(chalk.gray("  1. Login with: ") + chalk.white("sourcewizard login"));
        console.log(chalk.gray("  2. Set SOURCEWIZARD_API_KEY environment variable"));
        console.log("");
        console.log(chalk.gray("Get your API key at: https://sourcewizard.ai/dashboard"));
        process.exit(1);
      }

      if (!jwt && hasApiKey) {
        console.log(chalk.yellow("Using API key authentication"));
      }

      const workingDir = repoPath ? path.resolve(repoPath) : this.findGitRepoRoot(process.cwd());
      
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
        }
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


  async run(): Promise<void> {
    try {
      // Initialize authentication on startup
      await this.cliAuth.initialize();

      await this.program.parseAsync(process.argv);
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
