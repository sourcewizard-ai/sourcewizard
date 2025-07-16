#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { Registry } from "../registry/registry.js";
import { AIInstallationService } from "../mcp-server/ai-installation-service.js";
import { renderInstall } from "./install.js";
import { install } from "./agent.js";

export class MCPPackageCLI {
  private registry: Registry;
  private installService: AIInstallationService;
  private program: Command;

  constructor() {
    this.registry = new Registry();
    this.installService = new AIInstallationService();
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name("mcp-pkg")
      .description(
        "MCP Package Manager - Intelligent package and code snippet management"
      )
      .version("1.0.0");

    // Search command
    this.program
      .command("search")
      .alias("s")
      .description("Search for packages and code snippets")
      .argument("<query>", "Search query")
      .option("-c, --category <category>", "Filter by category")
      .option("-l, --language <language>", "Filter by language (for snippets)")
      .option("-n, --limit <number>", "Number of results to show", "10")
      .option("--packages-only", "Show only packages")
      .option("--snippets-only", "Show only code snippets")
      .option(
        "--sort <sort>",
        "Sort by (relevance|popularity|date|name)",
        "relevance"
      )
      .action(async (query, options) => {
        console.log(query, options);
      });

    // Install command
    this.program
      .command("install")
      .alias("i")
      .description("Install a package or code snippet with AI guidance")
      .argument("[name]", "Package or snippet name to install")
      .action(async (name: string | undefined, options: any) => {
        console.log(name, options);
        if (!name) {
          return;
        }
        await install(name);
        //renderInstall(name);
      });

    // DOS Wizard mode command
    this.program
      .command("wizard")
      .alias("w")
      .description("Start DOS-style setup wizard interface")
      .action(async () => {
        console.log("wizard");
      });

    // Info command
    this.program
      .command("info")
      .description("Get detailed information about a package or snippet")
      .argument("<name>", "Package or snippet name")
      .option("-t, --type <type>", "Type (package|snippet)", "package")
      .action(async (name: string, options: any) => {
        console.log(name, options);
      });

    // List command
    this.program
      .command("list")
      .alias("ls")
      .description("List available packages and snippets")
      .option("-t, --type <type>", "Type to list (package|snippet|all)", "all")
      .option("-c, --category <category>", "Filter by category")
      .action(async (options) => {
        console.log(options);
      });

    // Stats command
    this.program
      .command("stats")
      .description("Show registry statistics")
      .action(async () => {
        console.log("stats");
      });

    // Add command
    this.program
      .command("add")
      .description("Add a new package or snippet to the registry")
      .option("-t, --type <type>", "Type (package|snippet)", "package")
      .action(async (options) => {
        console.log(options);
      });

    // Interactive mode
    this.program
      .command("interactive")
      .alias("ui")
      .description("Start interactive mode")
      .action(async () => {
        console.log("interactive");
      });
  }

  async run(): Promise<void> {
    try {
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
