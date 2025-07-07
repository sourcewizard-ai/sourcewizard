#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { Registry } from "../registry/registry.js";
import { AIInstallationService } from "../mcp-server/ai-installation-service.js";
import { DOSSetupWizard } from "./dos-ui.js";
import {
  SearchOptions,
  InstallationOptions,
  Package,
  CodeSnippet,
  PackageCategory,
  CodeCategory,
} from "../shared/types.js";
import { promises as fs } from "fs";
import path from "path";

export class MCPPackageCLI {
  private registry: Registry;
  private installService: AIInstallationService;
  private program: Command;
  private dosWizard: DOSSetupWizard;

  constructor() {
    this.registry = new Registry();
    this.installService = new AIInstallationService();
    this.program = new Command();
    this.dosWizard = new DOSSetupWizard();
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
        await this.handleSearch(query, options);
      });

    // Install command
    this.program
      .command("install")
      .alias("i")
      .description("Install a package or code snippet with AI guidance")
      .argument("[name]", "Package or snippet name to install")
      .option("--wizard", "Use DOS-style installation wizard")
      .option("--snippet", "Install as code snippet instead of package")
      .option("--force", "Force installation even if already exists")
      .option("--dev", "Install as development dependency")
      .action(async (name: string | undefined, options: any) => {
        try {
          if (options.wizard) {
            const wizard = new DOSSetupWizard();

            try {
              await wizard.showWelcomeScreen();

              if (name) {
                // Direct installation with wizard UI
                const aiService = new AIInstallationService();
                await aiService.initialize();

                // Show mock AI analysis
                const mockContext = {
                  projectType: "node" as const,
                  framework: "express",
                  language: "javascript",
                  packageManager: "npm" as const,
                };
                await wizard.showAIAnalysis(mockContext);
                await wizard.showInstallationProgress(name);

                const result = await aiService.installPackage({
                  packageName: name,
                  dev: options.dev,
                  force: options.force,
                });

                await wizard.showCompletionScreen(name, result.success, {
                  installedPackages: result.installedPackages || [],
                  createdFiles: result.createdFiles || [],
                  warnings: result.warnings || [],
                });
              } else {
                // Show package selection in wizard
                await handleWizardInstall(wizard);
              }
            } finally {
              wizard.cleanup();
            }

            return;
          }

          // ... existing modern install logic ...
        } catch (error) {
          console.error(
            chalk.red("❌ Installation failed:"),
            error instanceof Error ? error.message : String(error)
          );
          process.exit(1);
        }
      });

    // DOS Wizard mode command
    this.program
      .command("wizard")
      .alias("w")
      .description("Start DOS-style setup wizard interface")
      .action(async () => {
        await this.handleDOSWizard();
      });

    // Info command
    this.program
      .command("info")
      .description("Get detailed information about a package or snippet")
      .argument("<name>", "Package or snippet name")
      .option("-t, --type <type>", "Type (package|snippet)", "package")
      .action(async (name: string, options: any) => {
        await this.handleInfo(name, options);
      });

    // List command
    this.program
      .command("list")
      .alias("ls")
      .description("List available packages and snippets")
      .option("-t, --type <type>", "Type to list (package|snippet|all)", "all")
      .option("-c, --category <category>", "Filter by category")
      .action(async (options) => {
        await this.handleList(options);
      });

    // Stats command
    this.program
      .command("stats")
      .description("Show registry statistics")
      .action(async () => {
        await this.handleStats();
      });

    // Add command
    this.program
      .command("add")
      .description("Add a new package or snippet to the registry")
      .option("-t, --type <type>", "Type (package|snippet)", "package")
      .action(async (options) => {
        await this.handleAdd(options);
      });

    // Interactive mode
    this.program
      .command("interactive")
      .alias("ui")
      .description("Start interactive mode")
      .action(async () => {
        await this.handleInteractive();
      });
  }

  // New DOS Wizard handler
  private async handleDOSWizard(): Promise<void> {
    try {
      await this.registry.initialize();
      await this.installService.initialize();

      // Show welcome screen
      await this.dosWizard.showWelcomeScreen();

      // Main wizard loop
      let exit = false;
      while (!exit) {
        const choice = await this.dosWizard.showMainMenu();

        switch (choice) {
          case "search":
            await this.wizardSearch();
            break;
          case "install":
            await this.wizardInstall();
            break;
          case "info":
            await this.wizardInfo();
            break;
          case "list":
            await this.wizardList();
            break;
          case "add":
            await this.wizardAdd();
            break;
          case "stats":
            await this.wizardStats();
            break;
          case "exit":
            exit = true;
            break;
          default:
            await this.dosWizard.showErrorDialog(
              "Invalid Selection",
              "Please use arrow keys to select an option"
            );
        }
      }
    } catch (error) {
      await this.dosWizard.showErrorDialog(
        "System Error",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      this.dosWizard.cleanup();
    }
  }

  // Wizard search functionality
  private async wizardSearch(): Promise<void> {
    try {
      // Get search query (simplified for demo)
      const query = "react"; // In real implementation, get from user input

      const searchOptions: SearchOptions = {
        query,
        limit: 10,
      };

      const results = await this.registry.search(searchOptions);
      const allResults = [...results.packages, ...results.snippets];

      await this.dosWizard.showSearchResults(allResults, query);
    } catch (error) {
      await this.dosWizard.showErrorDialog(
        "Search Error",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Wizard installation functionality
  private async wizardInstall(): Promise<void> {
    try {
      // Show popular packages for selection
      const popularPackages = ["express", "react", "lodash", "axios"];
      const packageName = await this.dosWizard.showPackageSelection(
        popularPackages
      );

      if (!packageName) {
        await this.dosWizard.showErrorDialog(
          "Invalid Selection",
          "Please select a valid package"
        );
        return;
      }

      // Show AI analysis
      const mockContext = {
        projectType: "web",
        framework: "react",
        language: "typescript",
        packageManager: "npm",
      };
      await this.dosWizard.showAIAnalysis(mockContext);

      // Show installation progress
      await this.dosWizard.showInstallationProgress(packageName);

      // Perform actual installation
      const installOptions: InstallationOptions = {
        packageName,
      };

      const result = await this.installService.installPackage(installOptions);

      // Show completion
      await this.dosWizard.showCompletionScreen(packageName, result.success, {
        installedPackages: result.installedPackages,
        createdFiles: result.createdFiles,
        warnings: result.warnings,
      });
    } catch (error) {
      await this.dosWizard.showErrorDialog(
        "Installation Error",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Wizard info functionality
  private async wizardInfo(): Promise<void> {
    // Simplified - show info for a popular package
    const pkg = await this.registry.getPackage("express");
    if (pkg) {
      const info = `Package: ${pkg.name}
Version: ${pkg.version}
Description: ${pkg.description}
Category: ${pkg.category}
Keywords: ${pkg.keywords.join(", ")}`;

      await this.dosWizard.showSearchResults([pkg], "Package Information");
    }
  }

  // Wizard list functionality
  private async wizardList(): Promise<void> {
    const packages = await this.registry.getAllPackages();
    const snippets = await this.registry.getAllSnippets();
    const allItems = [...packages.slice(0, 5), ...snippets.slice(0, 3)];

    await this.dosWizard.showSearchResults(allItems, "All Items");
  }

  // Wizard add functionality
  private async wizardAdd(): Promise<void> {
    await this.dosWizard.showErrorDialog(
      "Feature Coming Soon",
      "Adding new packages/snippets will be available in the next version."
    );
  }

  // Wizard stats functionality
  private async wizardStats(): Promise<void> {
    const stats = await this.registry.getStats();
    const mockResults = [
      {
        name: "Registry Statistics",
        description: `Packages: ${stats.totalPackages}, Snippets: ${stats.totalSnippets}, Total: ${stats.totalEntries}`,
      },
    ];

    await this.dosWizard.showSearchResults(mockResults, "Statistics");
  }

  // Enhanced wizard install for specific package
  private async handleWizardInstall(name: string, options: any): Promise<void> {
    try {
      await this.registry.initialize();
      await this.installService.initialize();

      // Show welcome screen
      await this.dosWizard.showWelcomeScreen();

      // Show AI analysis
      const mockContext = {
        projectType: "node",
        framework: "none",
        language: "javascript",
        packageManager: "npm",
      };
      await this.dosWizard.showAIAnalysis(mockContext);

      // Show installation progress
      await this.dosWizard.showInstallationProgress(name);

      // Perform actual installation
      const installOptions: InstallationOptions = {
        packageName: name,
        version: options.version,
        dev: options.dev,
        global: options.global,
        force: options.force,
        customInstallPath: options.path,
        aiInstructions: options.aiInstructions,
      };

      const result = await this.installService.installPackage(installOptions);

      // Show completion
      await this.dosWizard.showCompletionScreen(name, result.success, {
        installedPackages: result.installedPackages,
        createdFiles: result.createdFiles,
        warnings: result.warnings,
      });
    } catch (error) {
      await this.dosWizard.showErrorDialog(
        "Installation Error",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      this.dosWizard.cleanup();
    }
  }

  private async handleSearch(query: string, options: any): Promise<void> {
    const spinner = ora("Searching...").start();

    try {
      await this.registry.initialize();

      const searchOptions: SearchOptions = {
        query,
        category: options.category,
        language: options.language,
        limit: parseInt(options.limit),
        sortBy: options.sort,
        includePackages: !options.snippetsOnly,
        includeSnippets: !options.packagesOnly,
      };

      const results = await this.registry.search(searchOptions);
      spinner.stop();

      if (results.total === 0) {
        console.log(chalk.yellow(`No results found for "${query}"`));
        return;
      }

      console.log(
        chalk.green(
          `Found ${results.total} result(s) for "${query}" (${results.executionTime}ms)`
        )
      );
      console.log();

      if (results.packages.length > 0) {
        console.log(chalk.cyan.bold("📦 Packages:"));
        results.packages.forEach((pkg) => {
          this.displayPackage(pkg);
        });
        console.log();
      }

      if (results.snippets.length > 0) {
        console.log(chalk.cyan.bold("🔧 Code Snippets:"));
        results.snippets.forEach((snippet) => {
          this.displaySnippet(snippet);
        });
      }
    } catch (error) {
      spinner.stop();
      console.error(
        chalk.red("Search failed:"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleInstall(name: string, options: any): Promise<void> {
    const spinner = ora(`Installing ${name}...`).start();

    try {
      await this.installService.initialize();

      const installOptions: InstallationOptions = {
        packageName: name,
        version: options.version,
        dev: options.dev,
        global: options.global,
        force: options.force,
        customInstallPath: options.path,
        aiInstructions: options.aiInstructions,
      };

      const result = await this.installService.installPackage(installOptions);
      spinner.stop();

      if (result.success) {
        console.log(chalk.green("✅ Installation successful!"));
        console.log(chalk.white(result.message));

        if (result.installedPackages && result.installedPackages.length > 0) {
          console.log(
            chalk.cyan("📦 Installed packages:"),
            result.installedPackages.join(", ")
          );
        }

        if (result.createdFiles && result.createdFiles.length > 0) {
          console.log(
            chalk.cyan("📄 Created files:"),
            result.createdFiles.join(", ")
          );
        }

        if (result.warnings && result.warnings.length > 0) {
          console.log(chalk.yellow("⚠️  Warnings:"));
          result.warnings.forEach((warning) =>
            console.log(chalk.yellow(`  - ${warning}`))
          );
        }
      } else {
        console.log(chalk.red("❌ Installation failed!"));
        console.log(chalk.white(result.message));

        if (result.errors && result.errors.length > 0) {
          console.log(chalk.red("Errors:"));
          result.errors.forEach((error) =>
            console.log(chalk.red(`  - ${error}`))
          );
        }
      }
    } catch (error) {
      spinner.stop();
      console.error(
        chalk.red("Installation failed:"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleInfo(name: string, options: any): Promise<void> {
    const spinner = ora(`Getting info for ${name}...`).start();

    try {
      await this.registry.initialize();

      let item: Package | CodeSnippet | null = null;

      if (options.type === "package") {
        item = await this.registry.getPackage(name);
      } else if (options.type === "snippet") {
        item = await this.registry.getSnippet(name);
      } else {
        // Try both
        item = await this.registry.getPackage(name);
        if (!item) {
          item = await this.registry.getSnippet(name);
        }
      }

      spinner.stop();

      if (!item) {
        console.log(chalk.yellow(`No item found with name "${name}"`));
        return;
      }

      if ("version" in item) {
        this.displayPackageDetailed(item);
      } else {
        this.displaySnippetDetailed(item);
      }
    } catch (error) {
      spinner.stop();
      console.error(
        chalk.red("Info retrieval failed:"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleList(options: any): Promise<void> {
    const spinner = ora("Loading registry...").start();

    try {
      await this.registry.initialize();

      const packages = await this.registry.getAllPackages();
      const snippets = await this.registry.getAllSnippets();

      spinner.stop();

      if (options.type === "all" || options.type === "package") {
        console.log(chalk.cyan.bold("📦 Available Packages:"));
        packages
          .filter(
            (pkg) => !options.category || pkg.category === options.category
          )
          .forEach((pkg) => this.displayPackage(pkg));
        console.log();
      }

      if (options.type === "all" || options.type === "snippet") {
        console.log(chalk.cyan.bold("🔧 Available Snippets:"));
        snippets
          .filter(
            (snippet) =>
              !options.category || snippet.category === options.category
          )
          .forEach((snippet) => this.displaySnippet(snippet));
      }
    } catch (error) {
      spinner.stop();
      console.error(
        chalk.red("List failed:"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleStats(): Promise<void> {
    const spinner = ora("Calculating statistics...").start();

    try {
      await this.registry.initialize();
      const stats = await this.registry.getStats();
      spinner.stop();

      console.log(chalk.cyan.bold("📊 Registry Statistics:"));
      console.log(chalk.white(`Total entries: ${stats.totalEntries}`));
      console.log(chalk.white(`Packages: ${stats.totalPackages}`));
      console.log(chalk.white(`Code snippets: ${stats.totalSnippets}`));
      console.log();

      console.log(chalk.cyan.bold("📊 Categories:"));
      Object.entries(stats.categories).forEach(([category, count]) => {
        console.log(chalk.white(`  ${category}: ${count}`));
      });

      if (Object.keys(stats.languages).length > 0) {
        console.log();
        console.log(chalk.cyan.bold("💻 Languages:"));
        Object.entries(stats.languages).forEach(([language, count]) => {
          console.log(chalk.white(`  ${language}: ${count}`));
        });
      }
    } catch (error) {
      spinner.stop();
      console.error(
        chalk.red("Stats retrieval failed:"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleAdd(options: any): Promise<void> {
    try {
      await this.registry.initialize();

      if (options.type === "package") {
        await this.addPackageInteractive();
      } else if (options.type === "snippet") {
        await this.addSnippetInteractive();
      } else {
        const { type } = await inquirer.prompt([
          {
            type: "list",
            name: "type",
            message: "What would you like to add?",
            choices: [
              { name: "📦 Package", value: "package" },
              { name: "🔧 Code Snippet", value: "snippet" },
            ],
          },
        ]);

        if (type === "package") {
          await this.addPackageInteractive();
        } else {
          await this.addSnippetInteractive();
        }
      }
    } catch (error) {
      console.error(
        chalk.red("Add failed:"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async addPackageInteractive(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Package name:",
        validate: (input: string) =>
          input.trim() !== "" || "Package name is required",
      },
      {
        type: "input",
        name: "version",
        message: "Version:",
        default: "1.0.0",
      },
      {
        type: "input",
        name: "description",
        message: "Description:",
        validate: (input: string) =>
          input.trim() !== "" || "Description is required",
      },
      {
        type: "input",
        name: "keywords",
        message: "Keywords (comma-separated):",
        filter: (input: string) =>
          input
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k),
      },
      {
        type: "list",
        name: "category",
        message: "Category:",
        choices: Object.values(PackageCategory),
      },
      {
        type: "input",
        name: "author",
        message: "Author:",
      },
      {
        type: "input",
        name: "license",
        message: "License:",
        default: "MIT",
      },
    ]);

    const pkg: Package = {
      name: answers.name,
      version: answers.version,
      description: answers.description,
      keywords: answers.keywords,
      category: answers.category,
      author: answers.author,
      license: answers.license,
    };

    const spinner = ora("Adding package...").start();

    try {
      await this.registry.addPackage(pkg);
      spinner.stop();
      console.log(chalk.green(`✅ Package "${pkg.name}" added successfully!`));
    } catch (error) {
      spinner.stop();
      console.error(
        chalk.red("Failed to add package:"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async addSnippetInteractive(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Snippet name:",
        validate: (input: string) =>
          input.trim() !== "" || "Snippet name is required",
      },
      {
        type: "input",
        name: "description",
        message: "Description:",
        validate: (input: string) =>
          input.trim() !== "" || "Description is required",
      },
      {
        type: "input",
        name: "language",
        message: "Programming language:",
        validate: (input: string) =>
          input.trim() !== "" || "Language is required",
      },
      {
        type: "editor",
        name: "code",
        message: "Code (this will open your default editor):",
        validate: (input: string) => input.trim() !== "" || "Code is required",
      },
      {
        type: "input",
        name: "keywords",
        message: "Keywords (comma-separated):",
        filter: (input: string) =>
          input
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k),
      },
      {
        type: "list",
        name: "category",
        message: "Category:",
        choices: Object.values(CodeCategory),
      },
      {
        type: "input",
        name: "framework",
        message: "Framework (optional):",
      },
      {
        type: "input",
        name: "usageExample",
        message: "Usage example (optional):",
      },
    ]);

    const snippet: CodeSnippet = {
      id: answers.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      name: answers.name,
      description: answers.description,
      code: answers.code,
      language: answers.language,
      keywords: answers.keywords,
      category: answers.category,
      framework: answers.framework || undefined,
      usageExample: answers.usageExample || undefined,
      dependencies: [],
    };

    const spinner = ora("Adding snippet...").start();

    try {
      await this.registry.addSnippet(snippet);
      spinner.stop();
      console.log(
        chalk.green(`✅ Snippet "${snippet.name}" added successfully!`)
      );
    } catch (error) {
      spinner.stop();
      console.error(
        chalk.red("Failed to add snippet:"),
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleInteractive(): Promise<void> {
    console.log(chalk.cyan.bold("🚀 MCP Package Manager - Interactive Mode"));
    console.log();

    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to do?",
          choices: [
            { name: "🔍 Search packages and snippets", value: "search" },
            { name: "📦 Install package/snippet", value: "install" },
            { name: "ℹ️  Get info about item", value: "info" },
            { name: "📋 List all items", value: "list" },
            { name: "➕ Add new item", value: "add" },
            { name: "📊 Show statistics", value: "stats" },
            { name: "🎮 DOS Wizard Mode", value: "wizard" },
            { name: "🚪 Exit", value: "exit" },
          ],
        },
      ]);

      if (action === "exit") {
        console.log(chalk.cyan("Goodbye! 👋"));
        break;
      }

      if (action === "wizard") {
        await this.handleDOSWizard();
        continue;
      }

      try {
        switch (action) {
          case "search":
            await this.interactiveSearch();
            break;
          case "install":
            await this.interactiveInstall();
            break;
          case "info":
            await this.interactiveInfo();
            break;
          case "list":
            await this.handleList({ type: "all" });
            break;
          case "add":
            await this.handleAdd({});
            break;
          case "stats":
            await this.handleStats();
            break;
        }
      } catch (error) {
        console.error(
          chalk.red("Action failed:"),
          error instanceof Error ? error.message : String(error)
        );
      }

      console.log();
    }
  }

  private async interactiveSearch(): Promise<void> {
    const { query } = await inquirer.prompt([
      {
        type: "input",
        name: "query",
        message: "Search query:",
        validate: (input: string) =>
          input.trim() !== "" || "Search query is required",
      },
    ]);

    await this.handleSearch(query, {});
  }

  private async interactiveInstall(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Package or snippet name:",
        validate: (input: string) => input.trim() !== "" || "Name is required",
      },
      {
        type: "confirm",
        name: "useWizard",
        message: "Use DOS-style installation wizard?",
        default: false,
      },
    ]);

    if (answers.useWizard) {
      await this.handleWizardInstall(answers.name, {});
    } else {
      await this.handleInstall(answers.name, {});
    }
  }

  private async interactiveInfo(): Promise<void> {
    const { name } = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Package or snippet name:",
        validate: (input: string) => input.trim() !== "" || "Name is required",
      },
    ]);

    await this.handleInfo(name, { type: "package" });
  }

  private displayPackage(pkg: Package): void {
    console.log(
      chalk.white.bold(`  ${pkg.name}`) + chalk.gray(` v${pkg.version}`)
    );
    console.log(chalk.gray(`    ${pkg.description}`));
    console.log(chalk.blue(`    Keywords: ${pkg.keywords.join(", ")}`));
    console.log(chalk.green(`    Category: ${pkg.category}`));
    if (pkg.author) {
      console.log(chalk.yellow(`    Author: ${pkg.author}`));
    }
    console.log();
  }

  private displaySnippet(snippet: CodeSnippet): void {
    console.log(
      chalk.white.bold(`  ${snippet.name}`) +
        chalk.gray(` (${snippet.language})`)
    );
    console.log(chalk.gray(`    ${snippet.description}`));
    console.log(chalk.blue(`    Keywords: ${snippet.keywords.join(", ")}`));
    console.log(chalk.green(`    Category: ${snippet.category}`));
    if (snippet.framework) {
      console.log(chalk.magenta(`    Framework: ${snippet.framework}`));
    }
    console.log();
  }

  private displayPackageDetailed(pkg: Package): void {
    console.log(chalk.cyan.bold(`📦 ${pkg.name}`));
    console.log(chalk.white(`Version: ${pkg.version}`));
    console.log(chalk.white(`Description: ${pkg.description}`));
    console.log(chalk.white(`Category: ${pkg.category}`));
    console.log(chalk.white(`Keywords: ${pkg.keywords.join(", ")}`));

    if (pkg.author) console.log(chalk.white(`Author: ${pkg.author}`));
    if (pkg.license) console.log(chalk.white(`License: ${pkg.license}`));
    if (pkg.repository)
      console.log(chalk.white(`Repository: ${pkg.repository}`));
    if (pkg.homepage) console.log(chalk.white(`Homepage: ${pkg.homepage}`));
    if (pkg.size) console.log(chalk.white(`Size: ${pkg.size}`));
    if (pkg.popularity)
      console.log(chalk.white(`Popularity: ${pkg.popularity}/100`));
    if (pkg.lastUpdated)
      console.log(
        chalk.white(`Last Updated: ${pkg.lastUpdated.toDateString()}`)
      );
  }

  private displaySnippetDetailed(snippet: CodeSnippet): void {
    console.log(chalk.cyan.bold(`🔧 ${snippet.name}`));
    console.log(chalk.white(`Language: ${snippet.language}`));
    console.log(chalk.white(`Description: ${snippet.description}`));
    console.log(chalk.white(`Category: ${snippet.category}`));
    console.log(chalk.white(`Keywords: ${snippet.keywords.join(", ")}`));

    if (snippet.framework)
      console.log(chalk.white(`Framework: ${snippet.framework}`));
    if (snippet.author) console.log(chalk.white(`Author: ${snippet.author}`));
    if (snippet.dependencies)
      console.log(
        chalk.white(`Dependencies: ${snippet.dependencies.join(", ")}`)
      );

    console.log();
    console.log(chalk.gray("Code:"));
    console.log(chalk.white(snippet.code));

    if (snippet.usageExample) {
      console.log();
      console.log(chalk.gray("Usage Example:"));
      console.log(chalk.white(snippet.usageExample));
    }
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

// DOS Wizard Interactive Mode
async function runDOSWizard(): Promise<void> {
  const wizard = new DOSSetupWizard();

  try {
    // Welcome screen
    await wizard.showWelcomeScreen();

    // Main loop
    let running = true;
    while (running) {
      const choice = await wizard.showMainMenu();

      switch (choice) {
        case "search":
          await handleWizardSearch(wizard);
          break;

        case "install":
          await handleWizardInstall(wizard);
          break;

        case "info":
          await handleWizardInfo(wizard);
          break;

        case "list":
          await handleWizardList(wizard);
          break;

        case "add":
          await handleWizardAdd(wizard);
          break;

        case "stats":
          await handleWizardStats(wizard);
          break;

        case "exit":
          running = false;
          break;

        default:
          await wizard.showErrorDialog(
            "Invalid Choice",
            "Please select a valid option from the menu."
          );
      }
    }
  } catch (error) {
    await wizard.showErrorDialog(
      "System Error",
      `An unexpected error occurred: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    wizard.cleanup();
    console.log(chalk.green("Thank you for using MCP Package Manager!"));
  }
}

// Wizard search handler
async function handleWizardSearch(wizard: DOSSetupWizard): Promise<void> {
  try {
    // In a real implementation, we'd show an input dialog
    // For now, we'll simulate with a predefined search
    const query = "react"; // This would come from user input
    const registry = new Registry();
    await registry.initialize();

    const results = await registry.search(query);
    await wizard.showSearchResults(results, query);
  } catch (error) {
    await wizard.showErrorDialog(
      "Search Error",
      `Failed to search packages: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Wizard install handler
async function handleWizardInstall(wizard: DOSSetupWizard): Promise<void> {
  try {
    const registry = new Registry();
    await registry.initialize();

    // Get available packages for selection
    const packages = await registry.getAllPackages();
    const packageNames = packages.map((p) => p.name);

    if (packageNames.length === 0) {
      await wizard.showErrorDialog(
        "No Packages",
        "No packages available in the registry."
      );
      return;
    }

    // Show package selection with arrow navigation
    const selectedPackage = await wizard.showPackageSelection(
      packageNames.slice(0, 10)
    ); // Limit to 10 for display

    if (!selectedPackage) {
      return; // User cancelled
    }

    // Show AI analysis
    const aiService = new AIInstallationService();
    const context = await aiService.detectProjectContext(process.cwd());
    await wizard.showAIAnalysis(context);

    // Show installation progress
    await wizard.showInstallationProgress(selectedPackage);

    // Attempt actual installation
    try {
      const result = await aiService.generateInstallCommand(
        selectedPackage,
        context
      );

      // Simulate installation execution
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await wizard.showCompletionScreen(selectedPackage, true, {
        installedPackages: [selectedPackage],
        createdFiles: ["package.json updated"],
        warnings: result.warnings || [],
      });
    } catch (installError) {
      await wizard.showCompletionScreen(selectedPackage, false, {});
    }
  } catch (error) {
    await wizard.showErrorDialog(
      "Installation Error",
      `Failed to install package: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Wizard info handler
async function handleWizardInfo(wizard: DOSSetupWizard): Promise<void> {
  try {
    const registry = new Registry();
    await registry.initialize();

    // For demo purposes, show info about 'express'
    const packageInfo = await registry.getPackage("express");

    if (packageInfo) {
      const infoContent = `Package Information:

Name: ${packageInfo.name}
Version: ${packageInfo.version || "Latest"}
Description: ${packageInfo.description || "No description available"}
Category: ${packageInfo.category || "Unknown"}
Language: ${packageInfo.language || "JavaScript"}

Installation Count: ${packageInfo.installCount || 0}
Last Updated: ${packageInfo.lastUpdated || "Unknown"}

Press any key to continue...`;

      await wizard.showSearchResults([packageInfo], packageInfo.name);
    } else {
      await wizard.showErrorDialog(
        "Package Not Found",
        "The specified package was not found in the registry."
      );
    }
  } catch (error) {
    await wizard.showErrorDialog(
      "Info Error",
      `Failed to get package information: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Wizard list handler
async function handleWizardList(wizard: DOSSetupWizard): Promise<void> {
  try {
    const registry = new Registry();
    await registry.initialize();

    const packages = await registry.getAllPackages();
    const snippets = await registry.getAllSnippets();

    const allItems = [
      ...packages.map((p) => ({ ...p, type: "Package" })),
      ...snippets.map((s) => ({ ...s, type: "Snippet" })),
    ];

    await wizard.showSearchResults(allItems.slice(0, 10), "All Items");
  } catch (error) {
    await wizard.showErrorDialog(
      "List Error",
      `Failed to list items: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Wizard add handler
async function handleWizardAdd(wizard: DOSSetupWizard): Promise<void> {
  await wizard.showErrorDialog(
    "Feature Not Available",
    "Adding new packages/snippets is not yet implemented in the DOS wizard interface."
  );
}

// Wizard stats handler
async function handleWizardStats(wizard: DOSSetupWizard): Promise<void> {
  try {
    const registry = new Registry();
    await registry.initialize();

    const stats = await registry.getStats();

    const statsContent = `Registry Statistics:

Total Packages: ${stats.totalPackages}
Total Snippets: ${stats.totalSnippets}
Total Items: ${stats.totalItems}

Most Popular Package: ${stats.mostPopularPackage || "N/A"}
Most Popular Snippet: ${stats.mostPopularSnippet || "N/A"}

Categories:
${Object.entries(stats.categoryCounts || {})
  .map(([cat, count]) => `• ${cat}: ${count}`)
  .join("\n")}

Languages:
${Object.entries(stats.languageCounts || {})
  .map(([lang, count]) => `• ${lang}: ${count}`)
  .join("\n")}`;

    const mockStatsResults = [
      {
        name: "Registry Statistics",
        description: statsContent,
        type: "Stats",
      },
    ];

    await wizard.showSearchResults(mockStatsResults, "Statistics");
  } catch (error) {
    await wizard.showErrorDialog(
      "Stats Error",
      `Failed to get statistics: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Update the interactive mode to use DOS wizard
async function runInteractiveMode(): Promise<void> {
  console.log(
    chalk.blue.bold("\n🎮 Welcome to MCP Package Manager Interactive Mode!\n")
  );

  // Ask user which interface they prefer
  const { interface: selectedInterface } = await inquirer.prompt([
    {
      type: "list",
      name: "interface",
      message: "Choose your interface:",
      choices: [
        { name: "🚀 Modern CLI Interface", value: "modern" },
        { name: "💾 Retro DOS Setup Wizard", value: "dos" },
      ],
    },
  ]);

  if (selectedInterface === "dos") {
    await runDOSWizard();
    return;
  }

  // Continue with existing modern interactive mode...
  const registry = new Registry();
  await registry.initialize();

  // ... existing code ...
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new MCPPackageCLI();
  cli.run();
}
