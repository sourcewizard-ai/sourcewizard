import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import gradient from 'gradient-string';
import cliProgress from 'cli-progress';
import { createInterface } from 'readline';

export class DOSSetupWizard {
  private width: number;
  private height: number;
  private progressBar: cliProgress.SingleBar | null = null;

  constructor() {
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 25;
  }

  // Create blue to black gradient background
  private createGradientBackground(): string {
    const lines: string[] = [];
    const totalLines = this.height;
    
    for (let i = 0; i < totalLines; i++) {
      const ratio = i / (totalLines - 1);
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

  // Clear screen and set up gradient background
  private setupScreen(): void {
    // Clear screen and hide cursor
    process.stdout.write('\x1b[2J\x1b[?25l');
    process.stdout.write('\x1b[H'); // Move to top-left
    
    // Draw gradient background
    console.log(this.createGradientBackground());
    
    // Move cursor to top for content overlay
    process.stdout.write('\x1b[H');
  }

  // Create DOS-style title bar
  private createTitleBar(title: string): string {
    const titleBar = '═'.repeat(this.width);
    const centeredTitle = title.padStart((this.width + title.length) / 2).padEnd(this.width);
    
    return chalk.white.bold.bgBlue(
      titleBar + '\n' +
      centeredTitle + '\n' +
      titleBar
    );
  }

  // Create classic Windows-style dialog box
  private createDialogBox(
    title: string, 
    content: string, 
    width: number = 60, 
    height: number = 10
  ): string {
    const innerContent = content
      .split('\n')
      .map(line => line.padEnd(width - 4))
      .slice(0, height - 4)
      .join('\n');

    return boxen(innerContent, {
      title: title,
      titleAlignment: 'center',
      width: width,
      height: height,
      padding: 1,
      margin: 1,
      borderStyle: {
        topLeft: '╔',
        topRight: '╗',
        bottomLeft: '╚',
        bottomRight: '╝',
        horizontal: '═',
        vertical: '║'
      },
      borderColor: 'white',
      backgroundColor: '#000080' // Dark blue background
    });
  }

  // Create retro progress bar
  private createProgressBar(current: number, total: number): string {
    const barWidth = 40;
    const filled = Math.floor((current / total) * barWidth);
    const empty = barWidth - filled;
    
    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);
    const percentage = Math.floor((current / total) * 100);
    
    return chalk.white.bgBlue(
      `\n  ╔${'═'.repeat(barWidth + 2)}╗\n` +
      `  ║ ${filledBar}${emptyBar} ║ ${percentage}%\n` +
      `  ╚${'═'.repeat(barWidth + 2)}╝`
    );
  }

  // Position cursor at specific location
  private moveCursor(x: number, y: number): void {
    process.stdout.write(`\x1b[${y};${x}H`);
  }

  // Show welcome screen
  async showWelcomeScreen(): Promise<void> {
    this.setupScreen();
    
    // ASCII art title
    const asciiTitle = figlet.textSync('MCP PKG', {
      font: 'ANSI Shadow',
      horizontalLayout: 'fitted',
      width: this.width - 10
    });
    
    const gradientTitle = gradient.cristal(asciiTitle);
    
    // Center the title
    this.moveCursor(1, 3);
    console.log(gradientTitle);
    
    // Welcome message dialog
    const welcomeMsg = `Welcome to MCP Package Manager Setup
    
This program will install packages and code snippets
with AI-powered guidance on your system.

╔════════════════════════════════════════════════╗
║ Features:                                      ║
║ • Smart package search and installation       ║
║ • AI-guided project context detection         ║  
║ • Personal code snippet registry              ║
║ • Support for npm, yarn, pnpm, bun           ║
╚════════════════════════════════════════════════╝

Press any key to continue...`;

    this.moveCursor(10, 12);
    console.log(chalk.white.bgBlue(welcomeMsg));
    
    await this.waitForKey();
  }

  // Show package selection screen
  async showPackageSelection(packages: string[]): Promise<string> {
    this.setupScreen();
    this.moveCursor(1, 1);
    console.log(this.createTitleBar('MCP Package Manager - Package Selection'));
    
    const packageList = packages.map((pkg, i) => 
      `  ${String.fromCharCode(65 + i)}. ${pkg}`
    ).join('\n');
    
    const selectionDialog = this.createDialogBox(
      'Select Package to Install',
      `Choose from the following packages:\n\n${packageList}\n\n\nEnter letter (A-${String.fromCharCode(65 + packages.length - 1)}):`,
      70,
      15
    );
    
    this.moveCursor(5, 6);
    console.log(selectionDialog);
    
    return await this.getKeyInput();
  }

  // Show installation progress
  async showInstallationProgress(packageName: string): Promise<void> {
    this.setupScreen();
    this.moveCursor(1, 1);
    console.log(this.createTitleBar('MCP Package Manager - Installing'));
    
    const installDialog = this.createDialogBox(
      'Installation in Progress',
      `Installing package: ${packageName}\n\nPlease wait while the package is being installed\nand configured for your project...`,
      60,
      10
    );
    
    this.moveCursor(10, 6);
    console.log(installDialog);
    
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
      this.moveCursor(15, 18);
      console.log(chalk.white.bgBlue(`Status: ${steps[i]!.padEnd(30)}`));
      
      this.moveCursor(15, 20);
      console.log(this.createProgressBar(i + 1, steps.length));
      
      // Simulate work
      await this.sleep(1000 + Math.random() * 1000);
    }
  }

  // Show completion screen
  async showCompletionScreen(
    packageName: string, 
    success: boolean, 
    details: {
      installedPackages?: string[];
      createdFiles?: string[];
      warnings?: string[];
    }
  ): Promise<void> {
    this.setupScreen();
    this.moveCursor(1, 1);
    
    const titleColor = success ? chalk.green : chalk.red;
    const status = success ? 'Installation Complete' : 'Installation Failed';
    
    console.log(titleColor.bold.bgBlue(this.createTitleBar(`MCP Package Manager - ${status}`)));
    
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
    
    const resultDialog = this.createDialogBox(
      status,
      content,
      70,
      16
    );
    
    this.moveCursor(5, 5);
    console.log(resultDialog);
    
    await this.waitForKey();
  }

  // Show error dialog
  async showErrorDialog(title: string, message: string): Promise<void> {
    const errorDialog = boxen(message, {
      title: `⚠ ${title}`,
      titleAlignment: 'center',
      width: 60,
      padding: 2,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'red',
      backgroundColor: '#800000' // Dark red background
    });
    
    this.moveCursor(10, 10);
    console.log(errorDialog);
    
    this.moveCursor(10, 20);
    console.log(chalk.white.bgRed(' Press any key to continue... '));
    
    await this.waitForKey();
  }

  // Show AI context detection screen
  async showAIAnalysis(context: any): Promise<void> {
    this.setupScreen();
    this.moveCursor(1, 1);
    console.log(this.createTitleBar('MCP Package Manager - AI Analysis'));
    
    const contextInfo = `AI Project Analysis Results:

╔════════════════════════════════════════════╗
║ Project Type: ${context.projectType?.padEnd(25)} ║
║ Framework:    ${(context.framework || 'None')?.padEnd(25)} ║
║ Language:     ${context.language?.padEnd(25)} ║  
║ Pkg Manager:  ${context.packageManager?.padEnd(25)} ║
╚════════════════════════════════════════════╝

The AI has analyzed your project and will provide
optimized installation instructions.`;

    const analysisDialog = this.createDialogBox(
      'AI Context Detection',
      contextInfo,
      65,
      12
    );
    
    this.moveCursor(8, 6);
    console.log(analysisDialog);
    
    // Show thinking animation
    this.moveCursor(25, 19);
    const thinkingFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    for (let i = 0; i < 20; i++) {
      process.stdout.write(`\r${chalk.cyan.bold(thinkingFrames[i % thinkingFrames.length]!)} AI analyzing...`);
      await this.sleep(100);
    }
    
    process.stdout.write('\r✓ Analysis complete!    \n');
    await this.sleep(1000);
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

  private async getKeyInput(): Promise<string> {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.toUpperCase());
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Clean up and restore terminal
  cleanup(): void {
    // Clear screen, show cursor, reset colors
    process.stdout.write('\x1b[2J\x1b[H\x1b[?25h\x1b[0m');
  }

  // Show main menu
  async showMainMenu(): Promise<string> {
    this.setupScreen();
    this.moveCursor(1, 1);
    console.log(this.createTitleBar('MCP Package Manager - Main Menu'));
    
    const menuContent = `Select an action:

╔═══════════════════════════════════════════════╗
║                                               ║
║   A. Search Packages                          ║
║   B. Install Package/Snippet                  ║
║   C. View Package Information                 ║
║   D. List All Items                           ║
║   E. Add New Package/Snippet                  ║
║   F. Registry Statistics                      ║
║   G. Exit                                     ║
║                                               ║
╚═══════════════════════════════════════════════╝

Enter your choice (A-G):`;

    const menuDialog = this.createDialogBox(
      'Main Menu',
      menuContent,
      65,
      16
    );
    
    this.moveCursor(8, 4);
    console.log(menuDialog);
    
    return await this.getKeyInput();
  }

  // Show search results in retro style
  async showSearchResults(results: any[], query: string): Promise<void> {
    this.setupScreen();
    this.moveCursor(1, 1);
    console.log(this.createTitleBar(`Search Results for: ${query}`));
    
    const resultsList = results.slice(0, 8).map((item, i) => {
      const name = item.name || item.id || 'Unknown';
      const type = item.version ? 'PKG' : 'SNP';
      const desc = (item.description || '').substring(0, 35);
      return `${String.fromCharCode(65 + i)}. [${type}] ${name.padEnd(15)} ${desc}`;
    }).join('\n');
    
    const searchDialog = this.createDialogBox(
      `Found ${results.length} Results`,
      `${resultsList}\n\n\nPress any key to continue...`,
      75,
      15
    );
    
    this.moveCursor(3, 5);
    console.log(searchDialog);
    
    await this.waitForKey();
  }
}