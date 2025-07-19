#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { cliAuth } from "../shared/cli-auth.js";

export class MCPPackageCLI {
  private program: Command;

  constructor() {
    // Load configuration from environment variables
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
      .description("Login to your account")
      .option("-e, --email <email>", "Email address")
      .option("-p, --password <password>", "Password")
      .action(async (options) => {
        await this.handleLogin(options);
      });

    this.program
      .command("signup")
      .description("Create a new account")
      .option("-e, --email <email>", "Email address")
      .option("-p, --password <password>", "Password")
      .action(async (options) => {
        await this.handleSignup(options);
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
      .option("-l, --language <language>", "Filter by language (for snippets)")
      .option("-n, --limit <number>", "Number of results to show", "10")
      .option(
        "--sort <sort>",
        "Sort by (relevance|popularity|date|name)",
        "relevance"
      )
      .action(async (query, options) => {});

    // Install command
    this.program
      .command("install")
      .alias("i")
      .description("Install a package or code snippet with AI guidance")
      .argument("[name]", "Package or snippet name to install")
      .action(async (name: string | undefined, options: any) => {});
  }

  private async handleLogin(options: {
    email?: string;
    password?: string;
  }): Promise<void> {
    try {
      let { email, password } = options;

      // If email or password not provided as options, prompt for them
      if (!email) {
        const readline = await import("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        email = await new Promise<string>((resolve) => {
          rl.question("Email: ", (answer) => {
            rl.close();
            resolve(answer);
          });
        });
      }

      if (!password) {
        const readline = await import("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        password = await new Promise<string>((resolve) => {
          rl.question("Password: ", (answer) => {
            rl.close();
            resolve(answer);
          });
        });
      }

      if (!email || !password) {
        console.error(chalk.red("Email and password are required"));
        process.exit(1);
      }

      console.log(chalk.blue("Logging in..."));
      const result = await cliAuth.login({ email, password });

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

  private async handleSignup(options: {
    email?: string;
    password?: string;
  }): Promise<void> {
    try {
      let { email, password } = options;

      // If email or password not provided as options, prompt for them
      if (!email) {
        const readline = await import("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        email = await new Promise<string>((resolve) => {
          rl.question("Email: ", (answer) => {
            rl.close();
            resolve(answer);
          });
        });
      }

      if (!password) {
        const readline = await import("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        password = await new Promise<string>((resolve) => {
          rl.question("Password: ", (answer) => {
            rl.close();
            resolve(answer);
          });
        });
      }

      if (!email || !password) {
        console.error(chalk.red("Email and password are required"));
        process.exit(1);
      }

      console.log(chalk.blue("Creating account..."));
      const result = await cliAuth.signup({ email, password });

      console.log(chalk.green("✓ Account created successfully!"));
      console.log(
        chalk.yellow(
          "Please check your email to confirm your account before logging in."
        )
      );
    } catch (error) {
      console.error(
        chalk.red("Signup failed:"),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  }

  private async handleLogout(): Promise<void> {
    try {
      console.log(chalk.blue("Logging out..."));
      await cliAuth.logout();
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
      const status = await cliAuth.getStatus();

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
      await cliAuth.initialize();

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
