#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { CLIAuth } from "../shared/cli-web-auth/index.js";
import { renderInstall, renderMCPStatus } from "./install.jsx";
import { supabase } from "../shared/supabase-client.js";
import { install, search } from "./agent.js";
import { detectRepo } from "../shared/install-agent/repository-detector.js";

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
          console.log(
            chalk.yellow("Warning: Not authenticated, using fallback API key")
          );
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
          console.log(
            chalk.yellow("Warning: Not authenticated, using fallback API key")
          );
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

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new MCPPackageCLI();
  cli.run();
}
