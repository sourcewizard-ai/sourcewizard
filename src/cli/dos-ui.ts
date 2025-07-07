import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import gradient from 'gradient-string';
import cliProgress from 'cli-progress';
import { createInterface } from 'readline';

interface MenuOption {
  key: string;
  label: string;
  description: string;
  action: string;
}

export class DOSSetupWizard {
  private width: number;
  private height: number;
  private progressBar: cliProgress.SingleBar | null = null;
  private selectedIndex: number = 0;
  private currentMenu: MenuOption[] = [];

  constructor() {
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 25;
  }

  // Create blue to black gradient background covering full terminal
  private createFullScreenGradient(): string {
    const lines: string[] = [];
    
    for (let i = 0; i < this.height; i++) {
      const ratio = i / (this.height - 1);
      // Create gradient from bright blue at top to black at bottom
      const r = Math.floor(0 * ratio);
      const g = Math.floor(0 * ratio);
      const b = Math.floor(255 * (1 - ratio));
      
      const bgColor = `\x1b[48;2;${r};${g};${b}m`;
      const line = bgColor + ' '.repeat(this.width) + '\x1b[0m';
      lines.push(line);
    }
    
    return lines.join('\n');
  }

  // Clear screen and set up fullscreen gradient background
  private setupFullScreen(): void {
    // Clear screen, hide cursor, and disable line wrap
    process.stdout.write('\x1b[2J\x1b[?25l\x1b[?7l');
    process.stdout.write('\x1b[H'); // Move to top-left
    
    // Draw fullscreen gradient background
    console.log(this.createFullScreenGradient());
    
    // Move cursor to top for content overlay
    process.stdout.write('\x1b[H');
  }

  // Create centered fullscreen title bar
  private createFullScreenTitleBar(title: string): void {
    const titleBar = '═'.repeat(this.width);
    const centeredTitle = this.centerText(title, this.width);
    
    this.moveCursor(1, 1);
    console.log(chalk.white.bold.bgBlue(titleBar));
    this.moveCursor(1, 2);
    console.log(chalk.white.bold.bgBlue(centeredTitle));
    this.moveCursor(1, 3);
    console.log(chalk.white.bold.bgBlue(titleBar));
  }

  // Center text within given width
  private centerText(text: string, width: number): string {
    const textLength = text.length;
    const padding = Math.max(0, Math.floor((width - textLength) / 2));
    return ' '.repeat(padding) + text + ' '.repeat(width - textLength - padding);
  }

  // Create interactive fullscreen menu
  private createInteractiveMenu(
    title: string,
    options: MenuOption[],
    selectedIndex: number = 0
  ): void {
    const menuWidth = 60;
    const menuHeight = options.length + 8; // Extra space for title and borders
    
    // Calculate center position
    const startX = Math.floor((this.width - menuWidth) / 2);
    const startY = Math.floor((this.height - menuHeight) / 2);

    // Draw menu background with border
    this.drawMenuBox(startX, startY, menuWidth, menuHeight, title);

    // Draw menu options
    options.forEach((option, index) => {
      const isSelected = index === selectedIndex;
      const y = startY + 4 + index * 2; // Spacing between options
      
      this.drawMenuOption(option, startX + 2, y, menuWidth - 4, isSelected);
    });

    // Draw navigation instructions
    const instructionY = startY + menuHeight - 3;
    this.moveCursor(startX + 2, instructionY);
    console.log(chalk.white.bgBlue(this.centerText('Use ↑↓ arrows to navigate, ENTER to select, ESC to exit', menuWidth - 4)));
  }

  // Draw a menu box with borders
  private drawMenuBox(x: number, y: number, width: number, height: number, title: string): void {
    // Top border with title
    this.moveCursor(x, y);
    console.log(chalk.white.bgBlue(
      '╔' + '═'.repeat(width - 2) + '╗'
    ));
    
    this.moveCursor(x, y + 1);
    console.log(chalk.white.bgBlue(
      '║' + this.centerText(title, width - 2) + '║'
    ));
    
    this.moveCursor(x, y + 2);
    console.log(chalk.white.bgBlue(
      '╠' + '═'.repeat(width - 2) + '╣'
    ));

    // Side borders
    for (let i = 3; i < height - 1; i++) {
      this.moveCursor(x, y + i);
      console.log(chalk.white.bgBlue('║') + ' '.repeat(width - 2) + chalk.white.bgBlue('║'));
    }

    // Bottom border
    this.moveCursor(x, y + height - 1);
    console.log(chalk.white.bgBlue(
      '╚' + '═'.repeat(width - 2) + '╝'
    ));
  }

  // Draw individual menu option
  private drawMenuOption(option: MenuOption, x: number, y: number, width: number, isSelected: boolean): void {
    const prefix = isSelected ? '►' : ' ';
    const bgColor = isSelected ? chalk.white.bgCyan : chalk.white.bgBlue;
    const textColor = isSelected ? chalk.black.bold : chalk.white;
    
    // Option line
    this.moveCursor(x, y);
    const optionText = `${prefix} ${option.key}. ${option.label}`;
    const paddedText = optionText.padEnd(width);
    console.log(bgColor(textColor(paddedText)));
    
    // Description line (if selected)
    if (isSelected && option.description) {
      this.moveCursor(x + 2, y + 1);
      const descText = `   ${option.description}`;
      const paddedDesc = descText.padEnd(width - 2);
      console.log(chalk.white.bgBlue(chalk.gray(paddedDesc)));
    }
  }

  // Handle arrow key navigation
  private async handleArrowKeyInput(options: MenuOption[]): Promise<number> {
    return new Promise((resolve) => {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      
      const onKeyPress = (chunk: Buffer) => {
        const key = chunk.toString('hex');
        
        switch (key) {
          case '1b5b41': // Up arrow
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateMenuSelection(options);
            break;
            
          case '1b5b42': // Down arrow
            this.selectedIndex = Math.min(options.length - 1, this.selectedIndex + 1);
            this.updateMenuSelection(options);
            break;
            
          case '0d': // Enter
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onKeyPress);
            resolve(this.selectedIndex);
            break;
            
          case '1b': // Escape
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onKeyPress);
            resolve(-1); // Exit code
            break;
        }
      };
      
      process.stdin.on('data', onKeyPress);
    });
  }

  // Update menu selection display
  private updateMenuSelection(options: MenuOption[]): void {
    const menuWidth = 60;
    const menuHeight = options.length + 8;
    const startX = Math.floor((this.width - menuWidth) / 2);
    const startY = Math.floor((this.height - menuHeight) / 2);

    // Redraw only the menu options area
    for (let i = 0; i < options.length; i++) {
      const y = startY + 4 + i * 2;
      
      // Clear the option lines
      this.moveCursor(startX + 1, y);
      console.log(' '.repeat(menuWidth - 2));
      this.moveCursor(startX + 1, y + 1);
      console.log(' '.repeat(menuWidth - 2));
      
      // Redraw the option
      this.drawMenuOption(options[i]!, startX + 2, y, menuWidth - 4, i === this.selectedIndex);
    }
  }

  // Position cursor at specific location
  private moveCursor(x: number, y: number): void {
    process.stdout.write(`\x1b[${y};${x}H`);
  }

  // Show fullscreen welcome screen
  async showWelcomeScreen(): Promise<void> {
    this.setupFullScreen();
    
    // Create centered ASCII art title
    const asciiTitle = figlet.textSync('MCP PKG', {
      font: 'ANSI Shadow',
      horizontalLayout: 'fitted',
      width: Math.min(this.width - 10, 70)
    });
    
    const gradientTitle = gradient.cristal(asciiTitle);
    const titleLines = gradientTitle.split('\n');
    
    // Center the ASCII title
    const titleStartY = Math.floor(this.height / 4);
    titleLines.forEach((line, index) => {
      const centeredLine = this.centerText(line, this.width);
      this.moveCursor(1, titleStartY + index);
      console.log(centeredLine);
    });
    
    // Welcome message box
    const welcomeY = titleStartY + titleLines.length + 3;
    const welcomeWidth = 70;
    const welcomeX = Math.floor((this.width - welcomeWidth) / 2);
    
    const welcomeMsg = `Welcome to MCP Package Manager Setup

This program will install packages and code snippets
with AI-powered guidance on your system.

Features:
• Smart package search and installation
• AI-guided project context detection  
• Personal code snippet registry
• Support for npm, yarn, pnpm, bun

Press any key to continue...`;

    this.drawCenteredDialog('Welcome', welcomeMsg, welcomeWidth, 12, welcomeX, welcomeY);
    
    await this.waitForKey();
  }

  // Draw centered dialog box
  private drawCenteredDialog(title: string, content: string, width: number, height: number, x: number, y: number): void {
    // Draw dialog box
    this.moveCursor(x, y);
    console.log(chalk.white.bgBlue('╔' + '═'.repeat(width - 2) + '╗'));
    
    this.moveCursor(x, y + 1);
    console.log(chalk.white.bgBlue('║' + this.centerText(title, width - 2) + '║'));
    
    this.moveCursor(x, y + 2);
    console.log(chalk.white.bgBlue('╠' + '═'.repeat(width - 2) + '╣'));

    // Content lines
    const contentLines = content.split('\n');
    for (let i = 0; i < height - 4; i++) {
      this.moveCursor(x, y + 3 + i);
      const line = contentLines[i] || '';
      const paddedLine = '║ ' + line.padEnd(width - 4) + ' ║';
      console.log(chalk.white.bgBlue(paddedLine));
    }

    // Bottom border
    this.moveCursor(x, y + height - 1);
    console.log(chalk.white.bgBlue('╚' + '═'.repeat(width - 2) + '╝'));
  }

  // Show fullscreen main menu with arrow navigation
  async showMainMenu(): Promise<string> {
    this.setupFullScreen();
    this.createFullScreenTitleBar('MCP Package Manager - Main Menu');
    
    const mainMenuOptions: MenuOption[] = [
      { key: 'A', label: 'Search Packages', description: 'Search for packages and code snippets in the registry', action: 'search' },
      { key: 'B', label: 'Install Package/Snippet', description: 'Install packages or code snippets with AI guidance', action: 'install' },
      { key: 'C', label: 'View Package Information', description: 'Get detailed information about a specific package', action: 'info' },
      { key: 'D', label: 'List All Items', description: 'Browse all available packages and snippets', action: 'list' },
      { key: 'E', label: 'Add New Package/Snippet', description: 'Add new packages or snippets to the registry', action: 'add' },
      { key: 'F', label: 'Registry Statistics', description: 'View usage statistics and analytics', action: 'stats' },
      { key: 'G', label: 'Exit', description: 'Exit the MCP Package Manager', action: 'exit' }
    ];

    this.currentMenu = mainMenuOptions;
    this.selectedIndex = 0;
    
    this.createInteractiveMenu('Main Menu', mainMenuOptions, this.selectedIndex);
    
    const selection = await this.handleArrowKeyInput(mainMenuOptions);
    
    if (selection === -1) {
      return 'exit';
    }
    
    return mainMenuOptions[selection]!.action;
  }

  // Show fullscreen package selection with arrow navigation
  async showPackageSelection(packages: string[]): Promise<string> {
    this.setupFullScreen();
    this.createFullScreenTitleBar('MCP Package Manager - Package Selection');
    
    const packageOptions: MenuOption[] = packages.map((pkg, index) => ({
      key: String.fromCharCode(65 + index),
      label: pkg,
      description: this.getPackageDescription(pkg),
      action: pkg
    }));

    this.currentMenu = packageOptions;
    this.selectedIndex = 0;
    
    this.createInteractiveMenu('Select Package to Install', packageOptions, this.selectedIndex);
    
    const selection = await this.handleArrowKeyInput(packageOptions);
    
    if (selection === -1) {
      return '';
    }
    
    return packageOptions[selection]!.action;
  }

  // Get package description for display
  private getPackageDescription(packageName: string): string {
    const descriptions: Record<string, string> = {
      'express': 'Fast, unopinionated, minimalist web framework for Node.js',
      'react': 'A JavaScript library for building user interfaces',
      'lodash': 'A modern JavaScript utility library delivering modularity, performance & extras',
      'axios': 'Promise based HTTP client for the browser and node.js',
      'typescript': 'TypeScript is a superset of JavaScript that compiles to plain JavaScript',
      'webpack': 'A bundler for javascript and friends',
      'eslint': 'Find and fix problems in your JavaScript code'
    };
    
    return descriptions[packageName] || `Package: ${packageName}`;
  }

  // Show installation progress with fullscreen background
  async showInstallationProgress(packageName: string): Promise<void> {
    this.setupFullScreen();
    this.createFullScreenTitleBar('MCP Package Manager - Installing');
    
    const progressWidth = 60;
    const progressHeight = 12;
    const progressX = Math.floor((this.width - progressWidth) / 2);
    const progressY = Math.floor((this.height - progressHeight) / 2);

    // Simulate installation progress
    const steps = [
      'Analyzing project context...',
      'Detecting package manager...',
      'Downloading package...',
      'Installing dependencies...',
      'Configuring package...',
      'Applying AI setup...',
      'Installation complete!'
    ];
    
    for (let i = 0; i < steps.length; i++) {
      // Update progress display
      const content = `Installing package: ${packageName}

Please wait while the package is being installed
and configured for your project...

Current step: ${i + 1}/${steps.length}
${steps[i]}

${this.createTextProgressBar(i + 1, steps.length, 50)}`;

      this.drawCenteredDialog('Installation in Progress', content, progressWidth, progressHeight, progressX, progressY);
      
      // Simulate work
      await this.sleep(800 + Math.random() * 800);
    }
  }

  // Create text-based progress bar
  private createTextProgressBar(current: number, total: number, width: number): string {
    const filled = Math.floor((current / total) * width);
    const empty = width - filled;
    const percentage = Math.floor((current / total) * 100);
    
    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);
    
    return `╔${'═'.repeat(width + 2)}╗
║ ${filledBar}${emptyBar} ║ ${percentage}%
╚${'═'.repeat(width + 2)}╝`;
  }

  // Show completion screen with fullscreen background
  async showCompletionScreen(
    packageName: string, 
    success: boolean, 
    details: {
      installedPackages?: string[];
      createdFiles?: string[];
      warnings?: string[];
    }
  ): Promise<void> {
    this.setupFullScreen();
    
    const status = success ? 'Installation Complete' : 'Installation Failed';
    const titleColor = success ? 'green' : 'red';
    
    // Create colored title bar
    this.moveCursor(1, 1);
    const titleBar = '═'.repeat(this.width);
    const centeredTitle = this.centerText(`MCP Package Manager - ${status}`, this.width);
    
    if (success) {
      console.log(chalk.green.bold.bgBlue(titleBar));
      this.moveCursor(1, 2);
      console.log(chalk.green.bold.bgBlue(centeredTitle));
      this.moveCursor(1, 3);
      console.log(chalk.green.bold.bgBlue(titleBar));
    } else {
      console.log(chalk.red.bold.bgBlue(titleBar));
      this.moveCursor(1, 2);
      console.log(chalk.red.bold.bgBlue(centeredTitle));
      this.moveCursor(1, 3);
      console.log(chalk.red.bold.bgBlue(titleBar));
    }

    // Build content
    let content = `Package: ${packageName}\nStatus: ${success ? '✓ SUCCESS' : '✗ FAILED'}\n\n`;
    
    if (success) {
      if (details.installedPackages?.length) {
        content += `Installed packages:\n${details.installedPackages.map(p => `• ${p}`).join('\n')}\n\n`;
      }
      
      if (details.createdFiles?.length) {
        content += `Created files:\n${details.createdFiles.map(f => `• ${f}`).join('\n')}\n\n`;
      }
      
      if (details.warnings?.length) {
        content += `Warnings:\n${details.warnings.map(w => `⚠ ${w}`).join('\n')}\n\n`;
      }
    }
    
    content += '\nPress any key to continue...';
    
    const resultWidth = 70;
    const resultHeight = 16;
    const resultX = Math.floor((this.width - resultWidth) / 2);
    const resultY = Math.floor((this.height - resultHeight) / 2);
    
    this.drawCenteredDialog(status, content, resultWidth, resultHeight, resultX, resultY);
    
    await this.waitForKey();
  }

  // Show error dialog with fullscreen background
  async showErrorDialog(title: string, message: string): Promise<void> {
    const errorWidth = 60;
    const errorHeight = 10;
    const errorX = Math.floor((this.width - errorWidth) / 2);
    const errorY = Math.floor((this.height - errorHeight) / 2);

    // Draw red error dialog
    this.moveCursor(errorX, errorY);
    console.log(chalk.white.bgRed('╔' + '═'.repeat(errorWidth - 2) + '╗'));
    
    this.moveCursor(errorX, errorY + 1);
    console.log(chalk.white.bgRed('║' + this.centerText(`⚠ ${title}`, errorWidth - 2) + '║'));
    
    this.moveCursor(errorX, errorY + 2);
    console.log(chalk.white.bgRed('╠' + '═'.repeat(errorWidth - 2) + '╣'));

    // Error message
    const messageLines = message.split('\n');
    for (let i = 0; i < errorHeight - 4; i++) {
      this.moveCursor(errorX, errorY + 3 + i);
      const line = messageLines[i] || '';
      const paddedLine = '║ ' + line.padEnd(errorWidth - 4) + ' ║';
      console.log(chalk.white.bgRed(paddedLine));
    }

    // Bottom border
    this.moveCursor(errorX, errorY + errorHeight - 1);
    console.log(chalk.white.bgRed('╚' + '═'.repeat(errorWidth - 2) + '╝'));
    
    this.moveCursor(errorX, errorY + errorHeight + 1);
    console.log(chalk.white.bgRed(this.centerText('Press any key to continue...', errorWidth)));
    
    await this.waitForKey();
  }

  // Show AI analysis with fullscreen background and animation
  async showAIAnalysis(context: any): Promise<void> {
    this.setupFullScreen();
    this.createFullScreenTitleBar('MCP Package Manager - AI Analysis');
    
    const analysisWidth = 65;
    const analysisHeight = 14;
    const analysisX = Math.floor((this.width - analysisWidth) / 2);
    const analysisY = Math.floor((this.height - analysisHeight) / 2);

    const contextInfo = `AI Project Analysis Results:

╔════════════════════════════════════════════╗
║ Project Type: ${context.projectType?.padEnd(25)} ║
║ Framework:    ${(context.framework || 'None')?.padEnd(25)} ║
║ Language:     ${context.language?.padEnd(25)} ║  
║ Pkg Manager:  ${context.packageManager?.padEnd(25)} ║
╚════════════════════════════════════════════╝

The AI has analyzed your project and will provide
optimized installation instructions.`;

    this.drawCenteredDialog('AI Context Detection', contextInfo, analysisWidth, analysisHeight, analysisX, analysisY);
    
    // Show thinking animation at bottom center
    const animY = analysisY + analysisHeight + 2;
    const animX = Math.floor(this.width / 2) - 10;
    
    const thinkingFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    for (let i = 0; i < 30; i++) {
      this.moveCursor(animX, animY);
      console.log(chalk.cyan.bold(`${thinkingFrames[i % thinkingFrames.length]} AI analyzing...`.padEnd(20)));
      await this.sleep(150);
    }
    
    this.moveCursor(animX, animY);
    console.log(chalk.green.bold('✓ Analysis complete!'.padEnd(20)));
    await this.sleep(1000);
  }

  // Show search results with fullscreen background
  async showSearchResults(results: any[], query: string): Promise<void> {
    this.setupFullScreen();
    this.createFullScreenTitleBar(`Search Results for: ${query}`);
    
    const resultsList = results.slice(0, 8).map((item, i) => {
      const name = item.name || item.id || 'Unknown';
      const type = item.version ? 'PKG' : 'SNP';
      const desc = (item.description || '').substring(0, 45);
      return `${i + 1}. [${type}] ${name.padEnd(20)} ${desc}`;
    });

    const resultsContent = `Found ${results.length} results:\n\n${resultsList.join('\n')}\n\nPress any key to continue...`;
    
    const resultsWidth = 80;
    const resultsHeight = 15;
    const resultsX = Math.floor((this.width - resultsWidth) / 2);
    const resultsY = Math.floor((this.height - resultsHeight) / 2);
    
    this.drawCenteredDialog(`Found ${results.length} Results`, resultsContent, resultsWidth, resultsHeight, resultsX, resultsY);
    
    await this.waitForKey();
  }

  // Utility methods
  private async waitForKey(): Promise<void> {
    return new Promise((resolve) => {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Clean up and restore terminal
  cleanup(): void {
    // Clear screen, show cursor, reset colors, enable line wrap
    process.stdout.write('\x1b[2J\x1b[H\x1b[?25h\x1b[?7h\x1b[0m');
  }
}