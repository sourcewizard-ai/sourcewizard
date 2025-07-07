import chalk from "chalk";
import boxen from "boxen";
import figlet from "figlet";
import gradient from "gradient-string";
import { createInterface } from "readline";

interface MenuOption {
  key: string;
  label: string;
  description: string;
  action: string;
}

export class DOSSetupWizard {
  private width: number;
  private height: number;
  private selectedIndex: number = 0;
  private currentMenu: MenuOption[] = [];

  constructor() {
    // Ensure we have valid terminal dimensions
    const stdoutCols = process.stdout.columns;
    const stdoutRows = process.stdout.rows;

    this.width = stdoutCols && stdoutCols > 0 ? stdoutCols : 80;
    this.height = stdoutRows && stdoutRows > 0 ? stdoutRows : 25;

    // Additional safety check for minimum dimensions
    this.width = Math.max(this.width, 40);
    this.height = Math.max(this.height, 10);
  }

  // Get responsive dialog width based on terminal size
  private getResponsiveWidth(maxWidth: number = 80): number {
    return Math.min(this.width - 8, maxWidth); // Leave 4 chars margin on each side
  }

  // Get responsive dialog height based on terminal size
  private getResponsiveHeight(maxHeight: number = 20): number {
    return Math.min(this.height - 6, maxHeight); // Leave 3 lines margin top/bottom
  }

  // Calculate centered position for dialogs
  private getCenteredPosition(
    width: number,
    height: number
  ): { x: number; y: number } {
    return {
      x: Math.floor((this.width - width) / 2),
      y: Math.floor((this.height - height) / 2),
    };
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
      const line = bgColor + " ".repeat(Math.max(0, this.width)) + "\x1b[0m";
      lines.push(line);
    }

    return lines.join("\n");
  }

  // Clear screen and set up fullscreen gradient background
  private setupFullScreen(): void {
    // Clear screen, hide cursor, and disable line wrap
    process.stdout.write("\x1b[2J\x1b[?25l\x1b[?7l");
    process.stdout.write("\x1b[H"); // Move to top-left

    // Draw fullscreen gradient background
    console.log(this.createFullScreenGradient());

    // Move cursor to top for content overlay
    process.stdout.write("\x1b[H");
  }

  // Create centered fullscreen title bar
  private createFullScreenTitleBar(title: string): void {
    const titleBar = "═".repeat(Math.max(0, this.width));
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
    return (
      " ".repeat(Math.max(0, padding)) +
      text +
      " ".repeat(Math.max(0, width - textLength - padding))
    );
  }

  // Create interactive fullscreen menu
  private createInteractiveMenu(
    title: string,
    options: MenuOption[],
    selectedIndex: number = 0
  ): void {
    // Use responsive sizing
    const menuWidth = this.getResponsiveWidth(Math.max(60, this.width * 0.6));
    const menuHeight = Math.min(options.length * 2 + 8, this.height - 8); // Dynamic height with max limit

    // Calculate center position
    const position = this.getCenteredPosition(menuWidth, menuHeight);

    // Draw menu background with border
    this.drawMenuBox(position.x, position.y, menuWidth, menuHeight, title);

    // Draw menu options
    options.forEach((option, index) => {
      const isSelected = index === selectedIndex;
      const y = position.y + 4 + index * 2; // Spacing between options

      this.drawMenuOption(option, position.x + 2, y, menuWidth - 4, isSelected);
    });

    // Draw navigation instructions
    const instructionY = position.y + menuHeight - 3;
    this.moveCursor(position.x + 2, instructionY);
    console.log(
      chalk.white.bgBlue(
        this.centerText(
          "Use ↑↓ arrows to navigate, ENTER to select, ESC to exit",
          menuWidth - 4
        )
      )
    );
  }

  // Draw a menu box with borders
  private drawMenuBox(
    x: number,
    y: number,
    width: number,
    height: number,
    title: string
  ): void {
    // Top border with title
    this.moveCursor(x, y);
    console.log(
      chalk.white.bgBlue("╔" + "═".repeat(Math.max(0, width - 2)) + "╗")
    );

    this.moveCursor(x, y + 1);
    console.log(
      chalk.white.bgBlue(
        "║" + this.centerText(title, Math.max(0, width - 2)) + "║"
      )
    );

    this.moveCursor(x, y + 2);
    console.log(
      chalk.white.bgBlue("╠" + "═".repeat(Math.max(0, width - 2)) + "╣")
    );

    // Side borders
    for (let i = 3; i < height - 1; i++) {
      this.moveCursor(x, y + i);
      console.log(
        chalk.white.bgBlue("║") +
          " ".repeat(Math.max(0, width - 2)) +
          chalk.white.bgBlue("║")
      );
    }

    // Bottom border
    this.moveCursor(x, y + height - 1);
    console.log(
      chalk.white.bgBlue("╚" + "═".repeat(Math.max(0, width - 2)) + "╝")
    );
  }

  // Draw individual menu option
  private drawMenuOption(
    option: MenuOption,
    x: number,
    y: number,
    width: number,
    isSelected: boolean
  ): void {
    const prefix = isSelected ? "►" : " ";
    const bgColor = isSelected ? chalk.black.bgCyan : chalk.white.bgBlue;
    const textColor = isSelected ? chalk.white.bold : chalk.white;

    // Option line
    this.moveCursor(x, y);
    const optionText = `${prefix} ${option.label}`;
    const paddedText = optionText.padEnd(Math.max(0, width));
    console.log(bgColor(textColor(paddedText)));

    // Description line (show for selected item or if space allows)
    if (option.description && (isSelected || this.height > 20)) {
      this.moveCursor(x + 2, y + 1);
      const descText = isSelected
        ? `► ${option.description}`
        : `  ${option.description}`;
      const maxDescWidth = Math.max(0, width - 2);
      const truncatedDesc =
        descText.length > maxDescWidth
          ? descText.substring(0, maxDescWidth - 3) + "..."
          : descText;
      const paddedDesc = truncatedDesc.padEnd(maxDescWidth);
      console.log(chalk.white.bgBlue(chalk.gray(paddedDesc)));
    }
  }

  // Handle arrow key navigation
  private async handleArrowKeyInput(options: MenuOption[]): Promise<number> {
    return new Promise((resolve) => {
      process.stdin.setRawMode(true);
      process.stdin.resume();

      const onKeyPress = (chunk: Buffer) => {
        const key = chunk.toString("hex");

        switch (key) {
          case "1b5b41": // Up arrow
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateMenuSelection(options);
            break;

          case "1b5b42": // Down arrow
            this.selectedIndex = Math.min(
              options.length - 1,
              this.selectedIndex + 1
            );
            this.updateMenuSelection(options);
            break;

          case "0d": // Enter
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener("data", onKeyPress);
            resolve(this.selectedIndex);
            break;

          case "1b": // Escape
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener("data", onKeyPress);
            resolve(-1); // Exit code
            break;
        }
      };

      process.stdin.on("data", onKeyPress);
    });
  }

  // Update menu selection display
  private updateMenuSelection(options: MenuOption[]): void {
    // Use responsive sizing (same as createInteractiveMenu)
    const menuWidth = this.getResponsiveWidth(Math.max(60, this.width * 0.6));
    const menuHeight = Math.min(options.length * 2 + 8, this.height - 8);
    const position = this.getCenteredPosition(menuWidth, menuHeight);

    // Only redraw the specific menu option areas without clearing entire lines
    for (let i = 0; i < options.length; i++) {
      const y = position.y + 4 + i * 2;

      // Redraw the option directly without clearing - this preserves background
      this.drawMenuOption(
        options[i]!,
        position.x + 2,
        y,
        menuWidth - 4,
        i === this.selectedIndex
      );
    }
  }

  // Position cursor at specific location
  private moveCursor(x: number, y: number): void {
    process.stdout.write(`\x1b[${y};${x}H`);
  }

  // Show fullscreen welcome screen
  async showWelcomeScreen(): Promise<void> {
    this.setupFullScreen();

    // Create centered ASCII art title with responsive sizing
    const maxAsciiWidth = Math.min(this.width - 10, 70);
    const asciiTitle = figlet.textSync("MCP PKG", {
      font: "ANSI Shadow",
      horizontalLayout: "fitted",
      width: maxAsciiWidth,
    });

    const gradientTitle = gradient.cristal(asciiTitle);
    const titleLines = gradientTitle.split("\n");

    // Position ASCII title proportionally
    const titleStartY = Math.max(2, Math.floor(this.height / 5));
    titleLines.forEach((line: string, index: number) => {
      this.moveCursor(1, titleStartY + index);
      // Use background to preserve gradient feel
      console.log(chalk.bgBlack(this.centerText(line, this.width)));
    });

    // Responsive welcome message box
    const welcomeWidth = this.getResponsiveWidth(70);
    const welcomeHeight = this.getResponsiveHeight(14);
    const welcomeY = titleStartY + titleLines.length + 2;
    const position = this.getCenteredPosition(welcomeWidth, welcomeHeight);

    const welcomeMsg = `Welcome to MCP Package Manager Setup

This program will install packages and code snippets
with AI-powered guidance on your system.

Features:
• Smart package search and installation
• AI-guided project context detection  
• Personal code snippet registry
• Support for npm, yarn, pnpm, bun

Press any key to continue...`;

    this.drawCenteredDialog(
      "Welcome",
      welcomeMsg,
      welcomeWidth,
      welcomeHeight,
      position.x,
      Math.max(welcomeY, position.y)
    );

    await this.waitForKey();
  }

  // Draw centered dialog box
  private drawCenteredDialog(
    title: string,
    content: string,
    width: number,
    height: number,
    x: number,
    y: number
  ): void {
    // Draw dialog box
    this.moveCursor(x, y);
    console.log(
      chalk.white.bgBlue("╔" + "═".repeat(Math.max(0, width - 2)) + "╗")
    );

    this.moveCursor(x, y + 1);
    console.log(
      chalk.white.bgBlue(
        "║" + this.centerText(title, Math.max(0, width - 2)) + "║"
      )
    );

    this.moveCursor(x, y + 2);
    console.log(
      chalk.white.bgBlue("╠" + "═".repeat(Math.max(0, width - 2)) + "╣")
    );

    // Content lines
    const contentLines = content.split("\n");
    for (let i = 0; i < height - 4; i++) {
      this.moveCursor(x, y + 3 + i);
      const line = contentLines[i] || "";
      const paddedLine = "║ " + line.padEnd(Math.max(0, width - 4)) + " ║";
      console.log(chalk.white.bgBlue(paddedLine));
    }

    // Bottom border
    this.moveCursor(x, y + height - 1);
    console.log(
      chalk.white.bgBlue("╚" + "═".repeat(Math.max(0, width - 2)) + "╝")
    );
  }

  // Show fullscreen main menu with arrow navigation
  async showMainMenu(): Promise<string> {
    this.setupFullScreen();
    this.createFullScreenTitleBar("MCP Package Manager - Main Menu");

    const mainMenuOptions: MenuOption[] = [
      {
        key: "A",
        label: "Search Packages",
        description: "Search for packages and code snippets in the registry",
        action: "search",
      },
      {
        key: "B",
        label: "Install Package/Snippet",
        description: "Install packages or code snippets with AI guidance",
        action: "install",
      },
      {
        key: "C",
        label: "View Package Information",
        description: "Get detailed information about a specific package",
        action: "info",
      },
      {
        key: "D",
        label: "List All Items",
        description: "Browse all available packages and snippets",
        action: "list",
      },
      {
        key: "E",
        label: "Add New Package/Snippet",
        description: "Add new packages or snippets to the registry",
        action: "add",
      },
      {
        key: "F",
        label: "Registry Statistics",
        description: "View usage statistics and analytics",
        action: "stats",
      },
      {
        key: "G",
        label: "Exit",
        description: "Exit the MCP Package Manager",
        action: "exit",
      },
    ];

    this.currentMenu = mainMenuOptions;
    this.selectedIndex = 0;

    this.createInteractiveMenu(
      "Main Menu",
      mainMenuOptions,
      this.selectedIndex
    );

    const selection = await this.handleArrowKeyInput(mainMenuOptions);

    if (selection === -1) {
      return "exit";
    }

    return mainMenuOptions[selection]!.action;
  }

  // Show fullscreen package selection with arrow navigation
  async showPackageSelection(packages: string[]): Promise<string> {
    this.setupFullScreen();
    this.createFullScreenTitleBar("MCP Package Manager - Package Selection");

    const packageOptions: MenuOption[] = packages.map((pkg, index) => ({
      key: String.fromCharCode(65 + index),
      label: pkg,
      description: this.getPackageDescription(pkg),
      action: pkg,
    }));

    this.currentMenu = packageOptions;
    this.selectedIndex = 0;

    this.createInteractiveMenu(
      "Select Package to Install",
      packageOptions,
      this.selectedIndex
    );

    const selection = await this.handleArrowKeyInput(packageOptions);

    if (selection === -1) {
      return "";
    }

    return packageOptions[selection]!.action;
  }

  // Get package description for display
  private getPackageDescription(packageName: string): string {
    const descriptions: Record<string, string> = {
      express: "Fast, unopinionated, minimalist web framework for Node.js",
      react: "A JavaScript library for building user interfaces",
      lodash:
        "A modern JavaScript utility library delivering modularity, performance & extras",
      axios: "Promise based HTTP client for the browser and node.js",
      typescript:
        "TypeScript is a superset of JavaScript that compiles to plain JavaScript",
      webpack: "A bundler for javascript and friends",
      eslint: "Find and fix problems in your JavaScript code",
    };

    return descriptions[packageName] || `Package: ${packageName}`;
  }

  // Show installation progress with fullscreen background
  async showInstallationProgress(packageName: string): Promise<void> {
    this.setupFullScreen();
    this.createFullScreenTitleBar("MCP Package Manager - Installing");

    const progressWidth = this.getResponsiveWidth(60);
    const progressHeight = this.getResponsiveHeight(12);
    const position = this.getCenteredPosition(progressWidth, progressHeight);

    // Simulate installation progress
    const steps = [
      "Analyzing project context...",
      "Detecting package manager...",
      "Downloading package...",
      "Installing dependencies...",
      "Configuring package...",
      "Applying AI setup...",
      "Installation complete!",
    ];

    for (let i = 0; i < steps.length; i++) {
      // Update progress display
      const content = `Installing package: ${packageName}

Please wait while the package is being installed
and configured for your project...

Current step: ${i + 1}/${steps.length}
${steps[i]}

${this.createTextProgressBar(i + 1, steps.length, 50)}`;

      this.drawCenteredDialog(
        "Installation in Progress",
        content,
        progressWidth,
        progressHeight,
        position.x,
        position.y
      );

      // Simulate work
      await this.sleep(800 + Math.random() * 800);
    }
  }

  // Create text-based progress bar
  private createTextProgressBar(
    current: number,
    total: number,
    width: number
  ): string {
    const filled = Math.floor((current / total) * width);
    const empty = Math.max(0, width - filled);
    const percentage = Math.floor((current / total) * 100);

    const filledBar = "█".repeat(Math.max(0, filled));
    const emptyBar = "░".repeat(Math.max(0, empty));

    return `╔${"═".repeat(Math.max(0, width + 2))}╗
║ ${filledBar}${emptyBar} ║ ${percentage}%
╚${"═".repeat(Math.max(0, width + 2))}╝`;
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

    const status = success ? "Installation Complete" : "Installation Failed";
    const titleColor = success ? "green" : "red";

    // Create colored title bar
    this.moveCursor(1, 1);
    const titleBar = "═".repeat(Math.max(0, this.width));
    const centeredTitle = this.centerText(
      `MCP Package Manager - ${status}`,
      this.width
    );

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
    let content = `Package: ${packageName}\nStatus: ${
      success ? "✓ SUCCESS" : "✗ FAILED"
    }\n\n`;

    if (success) {
      if (details.installedPackages?.length) {
        content += `Installed packages:\n${details.installedPackages
          .map((p) => `• ${p}`)
          .join("\n")}\n\n`;
      }

      if (details.createdFiles?.length) {
        content += `Created files:\n${details.createdFiles
          .map((f) => `• ${f}`)
          .join("\n")}\n\n`;
      }

      if (details.warnings?.length) {
        content += `Warnings:\n${details.warnings
          .map((w) => `⚠ ${w}`)
          .join("\n")}\n\n`;
      }
    }

    content += "\nPress any key to continue...";

    const resultWidth = this.getResponsiveWidth(70);
    const resultHeight = this.getResponsiveHeight(16);
    const position = this.getCenteredPosition(resultWidth, resultHeight);

    this.drawCenteredDialog(
      status,
      content,
      resultWidth,
      resultHeight,
      position.x,
      position.y
    );

    await this.waitForKey();
  }

  // Show error dialog with fullscreen background
  async showErrorDialog(title: string, message: string): Promise<void> {
    this.setupFullScreen();

    const errorWidth = this.getResponsiveWidth(60);
    const errorHeight = this.getResponsiveHeight(10);
    const position = this.getCenteredPosition(errorWidth, errorHeight);

    // Draw red error dialog
    this.moveCursor(position.x, position.y);
    console.log(
      chalk.white.bgRed("╔" + "═".repeat(Math.max(0, errorWidth - 2)) + "╗")
    );

    this.moveCursor(position.x, position.y + 1);
    console.log(
      chalk.white.bgRed(
        "║" + this.centerText(`⚠ ${title}`, Math.max(0, errorWidth - 2)) + "║"
      )
    );

    this.moveCursor(position.x, position.y + 2);
    console.log(
      chalk.white.bgRed("╠" + "═".repeat(Math.max(0, errorWidth - 2)) + "╣")
    );

    // Error message
    const messageLines = message.split("\n");
    for (let i = 0; i < errorHeight - 4; i++) {
      this.moveCursor(position.x, position.y + 3 + i);
      const line = messageLines[i] || "";
      const paddedLine = "║ " + line.padEnd(Math.max(0, errorWidth - 4)) + " ║";
      console.log(chalk.white.bgRed(paddedLine));
    }

    // Bottom border
    this.moveCursor(position.x, position.y + errorHeight - 1);
    console.log(
      chalk.white.bgRed("╚" + "═".repeat(Math.max(0, errorWidth - 2)) + "╝")
    );

    this.moveCursor(position.x, position.y + errorHeight + 1);
    console.log(
      chalk.white.bgRed(
        this.centerText("Press any key to continue...", errorWidth)
      )
    );

    await this.waitForKey();
  }

  // Show AI analysis with fullscreen background and animation
  async showAIAnalysis(context: any): Promise<void> {
    this.setupFullScreen();
    this.createFullScreenTitleBar("MCP Package Manager - AI Analysis");

    const analysisWidth = this.getResponsiveWidth(65);
    const analysisHeight = this.getResponsiveHeight(14);
    const position = this.getCenteredPosition(analysisWidth, analysisHeight);

    const contextInfo = `AI Project Analysis Results:

╔════════════════════════════════════════════╗
║ Project Type: ${context.projectType?.padEnd(25)} ║
║ Framework:    ${(context.framework || "None")?.padEnd(25)} ║
║ Language:     ${context.language?.padEnd(25)} ║  
║ Pkg Manager:  ${context.packageManager?.padEnd(25)} ║
╚════════════════════════════════════════════╝

The AI has analyzed your project and will provide
optimized installation instructions.`;

    this.drawCenteredDialog(
      "AI Context Detection",
      contextInfo,
      analysisWidth,
      analysisHeight,
      position.x,
      position.y
    );

    // Show thinking animation at bottom center
    const animY = position.y + analysisHeight + 2;
    const animX = Math.floor(this.width / 2) - 10;

    const thinkingFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    for (let i = 0; i < 30; i++) {
      this.moveCursor(animX, animY);
      console.log(
        chalk.cyan.bold(
          `${thinkingFrames[i % thinkingFrames.length]} AI analyzing...`.padEnd(
            20
          )
        )
      );
      await this.sleep(150);
    }

    this.moveCursor(animX, animY);
    console.log(chalk.green.bold("✓ Analysis complete!".padEnd(20)));
    await this.sleep(1000);
  }

  // Show search results with fullscreen background
  async showSearchResults(results: any[], query: string): Promise<void> {
    this.setupFullScreen();
    this.createFullScreenTitleBar(`Search Results for: ${query}`);

    const resultsList = results.slice(0, 8).map((item, i) => {
      const name = item.name || item.id || "Unknown";
      const type = item.version ? "PKG" : "SNP";
      const desc = (item.description || "").substring(0, 45);
      return `${i + 1}. [${type}] ${name.padEnd(20)} ${desc}`;
    });

    const resultsContent = `Found ${
      results.length
    } results:\n\n${resultsList.join("\n")}\n\nPress any key to continue...`;

    const resultsWidth = this.getResponsiveWidth(80);
    const resultsHeight = this.getResponsiveHeight(15);
    const position = this.getCenteredPosition(resultsWidth, resultsHeight);

    this.drawCenteredDialog(
      `Found ${results.length} Results`,
      resultsContent,
      resultsWidth,
      resultsHeight,
      position.x,
      position.y
    );

    await this.waitForKey();
  }

  // Utility methods
  private async waitForKey(): Promise<void> {
    return new Promise((resolve) => {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once("data", () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Clean up and restore terminal
  cleanup(): void {
    // Clear screen, show cursor, reset colors, enable line wrap
    process.stdout.write("\x1b[2J\x1b[H\x1b[?25h\x1b[?7h\x1b[0m");
  }
}
