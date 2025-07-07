#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { Registry } from '../registry/registry.js';
import { AIInstallationService } from '../mcp-server/ai-installation-service.js';
import { 
  SearchOptions, 
  InstallationOptions, 
  Package, 
  CodeSnippet,
  PackageCategory,
  CodeCategory 
} from '../shared/types.js';
import { promises as fs } from 'fs';
import path from 'path';

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
      .name('mcp-pkg')
      .description('MCP Package Manager - Intelligent package and code snippet management')
      .version('1.0.0');

    // Search command
    this.program
      .command('search')
      .alias('s')
      .description('Search for packages and code snippets')
      .argument('<query>', 'Search query')
      .option('-c, --category <category>', 'Filter by category')
      .option('-l, --language <language>', 'Filter by language (for snippets)')
      .option('-n, --limit <number>', 'Number of results to show', '10')
      .option('--packages-only', 'Show only packages')
      .option('--snippets-only', 'Show only code snippets')
      .option('--sort <sort>', 'Sort by (relevance|popularity|date|name)', 'relevance')
      .action(async (query, options) => {
        await this.handleSearch(query, options);
      });

    // Install command
    this.program
      .command('install')
      .alias('i')
      .description('Install a package or code snippet')
      .argument('<name>', 'Package or snippet name')
      .option('-v, --version <version>', 'Specific version to install')
      .option('-D, --dev', 'Install as development dependency')
      .option('-g, --global', 'Install globally')
      .option('-f, --force', 'Force installation')
      .option('--path <path>', 'Custom installation path')
      .option('--ai-instructions <instructions>', 'Additional AI instructions')
      .action(async (name, options) => {
        await this.handleInstall(name, options);
      });

    // Info command
    this.program
      .command('info')
      .description('Get detailed information about a package or snippet')
      .argument('<name>', 'Package or snippet name')
      .option('-t, --type <type>', 'Type (package|snippet)', 'package')
      .action(async (name, options) => {
        await this.handleInfo(name, options);
      });

    // List command
    this.program
      .command('list')
      .alias('ls')
      .description('List available packages and snippets')
      .option('-t, --type <type>', 'Type to list (package|snippet|all)', 'all')
      .option('-c, --category <category>', 'Filter by category')
      .action(async (options) => {
        await this.handleList(options);
      });

    // Stats command
    this.program
      .command('stats')
      .description('Show registry statistics')
      .action(async () => {
        await this.handleStats();
      });

    // Add command
    this.program
      .command('add')
      .description('Add a new package or snippet to the registry')
      .option('-t, --type <type>', 'Type (package|snippet)', 'package')
      .action(async (options) => {
        await this.handleAdd(options);
      });

    // Interactive mode
    this.program
      .command('interactive')
      .alias('ui')
      .description('Start interactive mode')
      .action(async () => {
        await this.handleInteractive();
      });
  }

  private async handleSearch(query: string, options: any): Promise<void> {
    const spinner = ora('Searching...').start();
    
    try {
      await this.registry.initialize();
      
      const searchOptions: SearchOptions = {
        query,
        category: options.category,
        language: options.language,
        limit: parseInt(options.limit),
        sortBy: options.sort,
        includePackages: !options.snippetsOnly,
        includeSnippets: !options.packagesOnly
      };

      const results = await this.registry.search(searchOptions);
      spinner.stop();

      if (results.total === 0) {
        console.log(chalk.yellow(`No results found for "${query}"`));
        return;
      }

      console.log(chalk.green(`Found ${results.total} result(s) for "${query}" (${results.executionTime}ms)`));
      console.log();

      if (results.packages.length > 0) {
        console.log(chalk.cyan.bold('📦 Packages:'));
        results.packages.forEach(pkg => {
          this.displayPackage(pkg);
        });
        console.log();
      }

      if (results.snippets.length > 0) {
        console.log(chalk.cyan.bold('🔧 Code Snippets:'));
        results.snippets.forEach(snippet => {
          this.displaySnippet(snippet);
        });
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Search failed:'), error instanceof Error ? error.message : String(error));
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
        aiInstructions: options.aiInstructions
      };

      const result = await this.installService.installPackage(installOptions);
      spinner.stop();

      if (result.success) {
        console.log(chalk.green('✅ Installation successful!'));
        console.log(chalk.white(result.message));
        
        if (result.installedPackages && result.installedPackages.length > 0) {
          console.log(chalk.cyan('📦 Installed packages:'), result.installedPackages.join(', '));
        }
        
        if (result.createdFiles && result.createdFiles.length > 0) {
          console.log(chalk.cyan('📄 Created files:'), result.createdFiles.join(', '));
        }
        
        if (result.warnings && result.warnings.length > 0) {
          console.log(chalk.yellow('⚠️  Warnings:'));
          result.warnings.forEach(warning => console.log(chalk.yellow(`  - ${warning}`)));
        }
      } else {
        console.log(chalk.red('❌ Installation failed!'));
        console.log(chalk.white(result.message));
        
        if (result.errors && result.errors.length > 0) {
          console.log(chalk.red('Errors:'));
          result.errors.forEach(error => console.log(chalk.red(`  - ${error}`)));
        }
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Installation failed:'), error instanceof Error ? error.message : String(error));
    }
  }

  private async handleInfo(name: string, options: any): Promise<void> {
    const spinner = ora(`Getting info for ${name}...`).start();
    
    try {
      await this.registry.initialize();
      
      let item: Package | CodeSnippet | null = null;
      
      if (options.type === 'package') {
        item = await this.registry.getPackage(name);
      } else if (options.type === 'snippet') {
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

      if ('version' in item) {
        this.displayPackageDetailed(item);
      } else {
        this.displaySnippetDetailed(item);
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Info retrieval failed:'), error instanceof Error ? error.message : String(error));
    }
  }

  private async handleList(options: any): Promise<void> {
    const spinner = ora('Loading registry...').start();
    
    try {
      await this.registry.initialize();
      
      const packages = await this.registry.getAllPackages();
      const snippets = await this.registry.getAllSnippets();
      
      spinner.stop();

      if (options.type === 'all' || options.type === 'package') {
        console.log(chalk.cyan.bold('📦 Available Packages:'));
        packages
          .filter(pkg => !options.category || pkg.category === options.category)
          .forEach(pkg => this.displayPackage(pkg));
        console.log();
      }

      if (options.type === 'all' || options.type === 'snippet') {
        console.log(chalk.cyan.bold('🔧 Available Snippets:'));
        snippets
          .filter(snippet => !options.category || snippet.category === options.category)
          .forEach(snippet => this.displaySnippet(snippet));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('List failed:'), error instanceof Error ? error.message : String(error));
    }
  }

  private async handleStats(): Promise<void> {
    const spinner = ora('Calculating statistics...').start();
    
    try {
      await this.registry.initialize();
      const stats = await this.registry.getStats();
      spinner.stop();

      console.log(chalk.cyan.bold('📊 Registry Statistics:'));
      console.log(chalk.white(`Total entries: ${stats.totalEntries}`));
      console.log(chalk.white(`Packages: ${stats.totalPackages}`));
      console.log(chalk.white(`Code snippets: ${stats.totalSnippets}`));
      console.log();
      
      console.log(chalk.cyan.bold('📊 Categories:'));
      Object.entries(stats.categories).forEach(([category, count]) => {
        console.log(chalk.white(`  ${category}: ${count}`));
      });
      
      if (Object.keys(stats.languages).length > 0) {
        console.log();
        console.log(chalk.cyan.bold('💻 Languages:'));
        Object.entries(stats.languages).forEach(([language, count]) => {
          console.log(chalk.white(`  ${language}: ${count}`));
        });
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Stats retrieval failed:'), error instanceof Error ? error.message : String(error));
    }
  }

  private async handleAdd(options: any): Promise<void> {
    try {
      await this.registry.initialize();
      
      if (options.type === 'package') {
        await this.addPackageInteractive();
      } else if (options.type === 'snippet') {
        await this.addSnippetInteractive();
      } else {
        const { type } = await inquirer.prompt([
          {
            type: 'list',
            name: 'type',
            message: 'What would you like to add?',
            choices: [
              { name: '📦 Package', value: 'package' },
              { name: '🔧 Code Snippet', value: 'snippet' }
            ]
          }
        ]);
        
        if (type === 'package') {
          await this.addPackageInteractive();
        } else {
          await this.addSnippetInteractive();
        }
      }
    } catch (error) {
      console.error(chalk.red('Add failed:'), error instanceof Error ? error.message : String(error));
    }
  }

  private async addPackageInteractive(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Package name:',
        validate: (input: string) => input.trim() !== '' || 'Package name is required'
      },
      {
        type: 'input',
        name: 'version',
        message: 'Version:',
        default: '1.0.0'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        validate: (input: string) => input.trim() !== '' || 'Description is required'
      },
      {
        type: 'input',
        name: 'keywords',
        message: 'Keywords (comma-separated):',
        filter: (input: string) => input.split(',').map(k => k.trim()).filter(k => k)
      },
      {
        type: 'list',
        name: 'category',
        message: 'Category:',
        choices: Object.values(PackageCategory)
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author:'
      },
      {
        type: 'input',
        name: 'license',
        message: 'License:',
        default: 'MIT'
      }
    ]);

    const pkg: Package = {
      name: answers.name,
      version: answers.version,
      description: answers.description,
      keywords: answers.keywords,
      category: answers.category,
      author: answers.author,
      license: answers.license
    };

    const spinner = ora('Adding package...').start();
    
    try {
      await this.registry.addPackage(pkg);
      spinner.stop();
      console.log(chalk.green(`✅ Package "${pkg.name}" added successfully!`));
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Failed to add package:'), error instanceof Error ? error.message : String(error));
    }
  }

  private async addSnippetInteractive(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Snippet name:',
        validate: (input: string) => input.trim() !== '' || 'Snippet name is required'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        validate: (input: string) => input.trim() !== '' || 'Description is required'
      },
      {
        type: 'input',
        name: 'language',
        message: 'Programming language:',
        validate: (input: string) => input.trim() !== '' || 'Language is required'
      },
      {
        type: 'editor',
        name: 'code',
        message: 'Code (this will open your default editor):',
        validate: (input: string) => input.trim() !== '' || 'Code is required'
      },
      {
        type: 'input',
        name: 'keywords',
        message: 'Keywords (comma-separated):',
        filter: (input: string) => input.split(',').map(k => k.trim()).filter(k => k)
      },
      {
        type: 'list',
        name: 'category',
        message: 'Category:',
        choices: Object.values(CodeCategory)
      },
      {
        type: 'input',
        name: 'framework',
        message: 'Framework (optional):'
      },
      {
        type: 'input',
        name: 'usageExample',
        message: 'Usage example (optional):'
      }
    ]);

    const snippet: CodeSnippet = {
      id: answers.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: answers.name,
      description: answers.description,
      code: answers.code,
      language: answers.language,
      keywords: answers.keywords,
      category: answers.category,
      framework: answers.framework || undefined,
      usageExample: answers.usageExample || undefined,
      dependencies: []
    };

    const spinner = ora('Adding snippet...').start();
    
    try {
      await this.registry.addSnippet(snippet);
      spinner.stop();
      console.log(chalk.green(`✅ Snippet "${snippet.name}" added successfully!`));
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Failed to add snippet:'), error instanceof Error ? error.message : String(error));
    }
  }

  private async handleInteractive(): Promise<void> {
    console.log(chalk.cyan.bold('🚀 MCP Package Manager - Interactive Mode'));
    console.log();

    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🔍 Search packages and snippets', value: 'search' },
            { name: '📦 Install package/snippet', value: 'install' },
            { name: 'ℹ️  Get info about item', value: 'info' },
            { name: '📋 List all items', value: 'list' },
            { name: '➕ Add new item', value: 'add' },
            { name: '📊 Show statistics', value: 'stats' },
            { name: '🚪 Exit', value: 'exit' }
          ]
        }
      ]);

      if (action === 'exit') {
        console.log(chalk.cyan('Goodbye! 👋'));
        break;
      }

      try {
        switch (action) {
          case 'search':
            await this.interactiveSearch();
            break;
          case 'install':
            await this.interactiveInstall();
            break;
          case 'info':
            await this.interactiveInfo();
            break;
          case 'list':
            await this.handleList({ type: 'all' });
            break;
          case 'add':
            await this.handleAdd({});
            break;
          case 'stats':
            await this.handleStats();
            break;
        }
      } catch (error) {
        console.error(chalk.red('Action failed:'), error instanceof Error ? error.message : String(error));
      }

      console.log();
    }
  }

  private async interactiveSearch(): Promise<void> {
    const { query } = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'Search query:',
        validate: (input: string) => input.trim() !== '' || 'Search query is required'
      }
    ]);

    await this.handleSearch(query, {});
  }

  private async interactiveInstall(): Promise<void> {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Package or snippet name:',
        validate: (input: string) => input.trim() !== '' || 'Name is required'
      }
    ]);

    await this.handleInstall(name, {});
  }

  private async interactiveInfo(): Promise<void> {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Package or snippet name:',
        validate: (input: string) => input.trim() !== '' || 'Name is required'
      }
    ]);

    await this.handleInfo(name, { type: 'package' });
  }

  private displayPackage(pkg: Package): void {
    console.log(chalk.white.bold(`  ${pkg.name}`) + chalk.gray(` v${pkg.version}`));
    console.log(chalk.gray(`    ${pkg.description}`));
    console.log(chalk.blue(`    Keywords: ${pkg.keywords.join(', ')}`));
    console.log(chalk.green(`    Category: ${pkg.category}`));
    if (pkg.author) {
      console.log(chalk.yellow(`    Author: ${pkg.author}`));
    }
    console.log();
  }

  private displaySnippet(snippet: CodeSnippet): void {
    console.log(chalk.white.bold(`  ${snippet.name}`) + chalk.gray(` (${snippet.language})`));
    console.log(chalk.gray(`    ${snippet.description}`));
    console.log(chalk.blue(`    Keywords: ${snippet.keywords.join(', ')}`));
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
    console.log(chalk.white(`Keywords: ${pkg.keywords.join(', ')}`));
    
    if (pkg.author) console.log(chalk.white(`Author: ${pkg.author}`));
    if (pkg.license) console.log(chalk.white(`License: ${pkg.license}`));
    if (pkg.repository) console.log(chalk.white(`Repository: ${pkg.repository}`));
    if (pkg.homepage) console.log(chalk.white(`Homepage: ${pkg.homepage}`));
    if (pkg.size) console.log(chalk.white(`Size: ${pkg.size}`));
    if (pkg.popularity) console.log(chalk.white(`Popularity: ${pkg.popularity}/100`));
    if (pkg.lastUpdated) console.log(chalk.white(`Last Updated: ${pkg.lastUpdated.toDateString()}`));
  }

  private displaySnippetDetailed(snippet: CodeSnippet): void {
    console.log(chalk.cyan.bold(`🔧 ${snippet.name}`));
    console.log(chalk.white(`Language: ${snippet.language}`));
    console.log(chalk.white(`Description: ${snippet.description}`));
    console.log(chalk.white(`Category: ${snippet.category}`));
    console.log(chalk.white(`Keywords: ${snippet.keywords.join(', ')}`));
    
    if (snippet.framework) console.log(chalk.white(`Framework: ${snippet.framework}`));
    if (snippet.author) console.log(chalk.white(`Author: ${snippet.author}`));
    if (snippet.dependencies) console.log(chalk.white(`Dependencies: ${snippet.dependencies.join(', ')}`));
    
    console.log();
    console.log(chalk.gray('Code:'));
    console.log(chalk.white(snippet.code));
    
    if (snippet.usageExample) {
      console.log();
      console.log(chalk.gray('Usage Example:'));
      console.log(chalk.white(snippet.usageExample));
    }
  }

  async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error(chalk.red('CLI Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new MCPPackageCLI();
  cli.run();
}