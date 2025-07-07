# MCP Package Manager

An intelligent TypeScript-based package and code snippet management system that consists of an MCP (Model Context Protocol) server and a CLI tool for smart package installation with AI guidance.

## Features

### 🔍 **Smart Search**
- Search across packages and code snippets
- Category-based filtering (utility, framework, library, etc.)
- Language-specific search for code snippets
- Popularity-based ranking
- Fuzzy search with intelligent scoring

### 🤖 **AI-Powered Installation**
- Automatic project context detection
- Package manager detection (npm, yarn, pnpm, bun)
- Framework-specific setup instructions
- Smart dependency management
- AI-guided configuration

### 📦 **Package & Snippet Management**
- Local registry with persistent storage
- Pre-populated with popular packages
- Custom code snippet library
- Metadata tracking and analytics
- Versioning support

### 🖥️ **Multiple Interfaces**
- **MCP Server**: Integration with MCP-compatible applications
- **CLI Tool**: Command-line interface with interactive mode
- **DOS Wizard**: Retro installation wizard with blue-to-black gradient
- **Interactive Mode**: Menu-driven package management

### 🎮 **DOS-Style Setup Wizard**
- **Retro Interface**: Classic Windows 95/98 setup wizard aesthetic
- **Blue-to-Black Gradient**: Authentic early Windows installation experience
- **Box Drawing Characters**: DOS-style borders and progress bars
- **ASCII Art**: Figlet-generated titles with gradient effects
- **Step-by-Step Installation**: Guided wizard with progress tracking
- **AI Analysis Screen**: Animated project context detection
- **Classic Dialog Boxes**: Windows-style confirmation and error dialogs

## Installation

### Prerequisites
- Node.js 18.0.0 or higher
- npm, yarn, pnpm, or bun

### Install Dependencies
```bash
npm install
```

### Build the Project
```bash
npm run build
```

### Install CLI Globally (Optional)
```bash
npm install -g .
```

## Usage

### CLI Tool

#### Search for packages and snippets
```bash
# Basic search
mcp-pkg search "express"

# Filter by category
mcp-pkg search "react" --category framework

# Filter by language for snippets
mcp-pkg search "debounce" --language typescript

# Limit results
mcp-pkg search "utility" --limit 5
```

#### Install packages or snippets
```bash
# Install a package
mcp-pkg install express

# Install with DOS-style wizard
mcp-pkg install express --wizard

# Install with specific version
mcp-pkg install react --version 18.2.0

# Install as dev dependency
mcp-pkg install typescript --dev

# Install globally
mcp-pkg install @angular/cli --global

# Install to custom path
mcp-pkg install lodash --path ./src/utils
```

#### DOS-Style Installation Wizard
```bash
# Start the retro DOS wizard interface
mcp-pkg wizard

# Use wizard for specific package installation
mcp-pkg install express --wizard
```

**DOS Wizard Features:**
- Blue-to-black gradient background (just like Windows 95 setup!)
- ASCII art title with gradient effects
- Step-by-step installation progress with retro progress bars
- AI project analysis with animated thinking indicator
- Classic Windows-style dialog boxes
- Package selection with A-Z keyboard navigation
- Completion screen with installation summary

#### Get package information
```bash
# Get package details
mcp-pkg info express

# Get snippet details
mcp-pkg info useLocalStorage --type snippet
```

#### List available items
```bash
# List all packages and snippets
mcp-pkg list

# List only packages
mcp-pkg list --type package

# List by category
mcp-pkg list --category utility
```

#### Interactive mode
```bash
mcp-pkg interactive
```

#### Add new packages or snippets
```bash
# Add a package
mcp-pkg add --type package

# Add a code snippet
mcp-pkg add --type snippet
```

#### View registry statistics
```bash
mcp-pkg stats
```

### MCP Server

#### Start the MCP server
```bash
npm run start:server
```

#### Available MCP Tools
- `search_packages`: Search for packages and code snippets
- `install_package`: Install packages or apply code snippets with AI guidance
- `get_package_info`: Get detailed information about specific items
- `get_registry_stats`: Get statistics about the registry

### Development

#### Run in development mode
```bash
npm run dev
```

#### Run tests
```bash
npm test

# Watch mode
npm run test:watch
```

#### Lint code
```bash
npm run lint
```

## Project Structure

```
mcp-package-manager/
├── src/
│   ├── cli/                    # CLI tool implementation
│   │   ├── index.ts           # Main CLI interface
│   │   └── dos-ui.ts          # DOS-style wizard interface
│   ├── mcp-server/             # MCP server implementation
│   │   ├── server.ts           # Main MCP server
│   │   ├── ai-installation-service.ts
│   │   └── index.ts            # Server entry point
│   ├── registry/               # Registry system
│   │   └── registry.ts
│   └── shared/                 # Shared types and utilities
│       └── types.ts
├── tests/                      # Unit tests
│   ├── registry.test.ts
│   └── ai-installation-service.test.ts
├── architecture/               # Documentation
│   ├── README.md
│   └── technical-specification.md
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## DOS Wizard Interface

The DOS-style installation wizard provides a nostalgic experience reminiscent of early Windows setup programs:

### Visual Features
- **Blue-to-Black Gradient Background**: Authentic Windows 95/98 installation aesthetic
- **Box-Drawing Characters**: Uses Unicode characters for borders (╔═╗║╚═╝)
- **ASCII Art Titles**: Generated with Figlet and colored with gradients
- **Progress Bars**: Retro-style progress indicators with filled/empty blocks
- **Dialog Boxes**: Classic Windows-style message boxes and confirmation dialogs

### Wizard Screens

#### 1. Welcome Screen
```
    ███╗   ███╗ ██████╗██████╗     ██████╗ ██╗  ██╗ ██████╗ 
    ████╗ ████║██╔════╝██╔══██╗    ██╔══██╗██║ ██╔╝██╔════╝ 
    ██╔████╔██║██║     ██████╔╝    ██████╔╝█████╔╝ ██║  ███╗
    ██║╚██╔╝██║██║     ██╔═══╝     ██╔═══╝ ██╔═██╗ ██║   ██║
    ██║ ╚═╝ ██║╚██████╗██║         ██║     ██║  ██╗╚██████╔╝
    ╚═╝     ╚═╝ ╚═════╝╚═╝         ╚═╝     ╚═╝  ╚═╝ ╚═════╝ 

    Welcome to MCP Package Manager Setup
    
    ╔════════════════════════════════════════════════╗
    ║ Features:                                      ║
    ║ • Smart package search and installation       ║
    ║ • AI-guided project context detection         ║  
    ║ • Personal code snippet registry              ║
    ║ • Support for npm, yarn, pnpm, bun           ║
    ╚════════════════════════════════════════════════╝
```

#### 2. Package Selection
```
    ╔═══════════════════════════════════════════════╗
    ║                 Select Package                ║
    ╠═══════════════════════════════════════════════╣
    ║                                               ║
    ║   A. Express - Web framework                  ║
    ║   B. React - UI library                       ║
    ║   C. Lodash - Utility library                 ║
    ║   D. Axios - HTTP client                      ║
    ║                                               ║
    ╚═══════════════════════════════════════════════╝
```

#### 3. AI Analysis Screen
```
    ╔══════════════════════════════════════════════╗
    ║               AI Analysis                    ║
    ╠══════════════════════════════════════════════╣
    ║ Project Type: web                            ║
    ║ Framework:    react                          ║
    ║ Language:     typescript                     ║  
    ║ Pkg Manager:  npm                            ║
    ╚══════════════════════════════════════════════╝
    
    ⠋ AI analyzing...
```

#### 4. Installation Progress
```
    ╔════════════════════════════════════════════════╗
    ║            Installation Progress               ║
    ╠════════════════════════════════════════════════╣
    ║                                                ║
    ║ Installing package: express                    ║
    ║                                                ║
    ║ Status: Configuring package...                ║
    ║                                                ║
    ║  ╔══════════════════════════════════════════╗  ║
    ║  ║ ████████████████████████░░░░░░░░░░░░░░░░ ║ 75%║
    ║  ╚══════════════════════════════════════════╝  ║
    ╚════════════════════════════════════════════════╝
```

### Usage Examples

#### Start DOS Wizard
```bash
# Full wizard experience
mcp-pkg wizard

# Quick installation with wizard
mcp-pkg install react --wizard
```

#### Interactive Mode with Wizard Option
```bash
$ mcp-pkg interactive
🚀 MCP Package Manager - Interactive Mode

? What would you like to do?
❯ 🔍 Search packages and snippets
  📦 Install package/snippet
  ℹ️  Get info about item
  📋 List all items
  ➕ Add new item
  📊 Show statistics
  🎮 DOS Wizard Mode
  🚪 Exit
```

## Configuration

### Environment Variables
- `MCP_PKG_DATA_PATH`: Custom path for registry data (default: `./registry-data`)
- `MCP_PKG_AI_PROVIDER`: AI provider (`openai`, `anthropic`, `local`)
- `MCP_PKG_AI_API_KEY`: API key for AI provider
- `MCP_PKG_DEBUG`: Enable debug logging
- `MCP_PKG_CONFIG_PATH`: Custom configuration file path

### Registry Configuration
The registry stores packages and snippets locally with metadata including:
- Access counts and patterns
- Popularity scores
- Verification status
- Search indexing

## Examples

### DOS Wizard Installation Flow
```bash
# Start the retro installation experience
$ mcp-pkg wizard

# 1. Welcome screen with ASCII art title
# 2. Main menu with A-G options
# 3. Package selection (A-D for popular packages)
# 4. AI project analysis with spinner animation
# 5. Step-by-step installation progress
# 6. Completion screen with results
```

### Search Examples
```bash
# Find React components
mcp-pkg search "react component" --language typescript

# Find utility functions
mcp-pkg search "utility" --category function

# Find Express middleware
mcp-pkg search "middleware" --category framework
```

### Installation Examples
```bash
# Install Express with AI setup guidance
mcp-pkg install express

# Install with retro DOS wizard
mcp-pkg install express --wizard

# Install a React hook snippet
mcp-pkg install useLocalStorage

# Install with custom AI instructions
mcp-pkg install webpack --ai-instructions "Configure for TypeScript project"
```

## API Documentation

### MCP Server Tools

#### search_packages
```typescript
{
  query: string;
  options?: {
    category?: string;
    language?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'popularity' | 'date' | 'name';
    includePackages?: boolean;
    includeSnippets?: boolean;
  };
}
```

#### install_package
```typescript
{
  packageName: string;
  options?: {
    version?: string;
    dev?: boolean;
    global?: boolean;
    force?: boolean;
    skipDependencies?: boolean;
    customInstallPath?: string;
    aiInstructions?: string;
  };
}
```

## AI Features

### Project Context Detection
The AI service automatically detects:
- **Project Type**: web, node, mobile, desktop, library, CLI
- **Framework**: React, Vue, Angular, Express, Next.js, etc.
- **Package Manager**: npm, yarn, pnpm, bun
- **Language**: JavaScript, TypeScript

### Installation Guidance
AI provides intelligent installation instructions based on:
- Project context and dependencies
- Framework-specific requirements
- Best practices and conventions
- Common configuration patterns

### Supported Packages
Pre-configured AI instructions for popular packages:
- **Express**: Server setup, middleware configuration
- **React**: Component structure, TypeScript types
- **Lodash**: Tree-shaking, ES modules optimization
- And many more...

## Testing

The project includes comprehensive unit tests for complex components:

### Registry Tests
- Initialization and data loading
- Package and snippet management
- Search functionality with scoring
- Statistics and analytics
- Error handling

### AI Installation Service Tests
- Project context detection
- Installation strategies
- Command execution
- File system operations
- Error recovery

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test registry.test.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests for new features
- Update documentation for API changes
- Use semantic commit messages

## Architecture

For detailed architecture information, see:
- [Architecture Overview](./architecture/README.md)
- [Technical Specification](./architecture/technical-specification.md)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: Check the [architecture](./architecture/) folder
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions

## Roadmap

### Planned Features
- [ ] Remote registry support
- [ ] Package dependency graphs
- [ ] Installation analytics
- [ ] Advanced AI model integration
- [ ] Multi-language support
- [ ] Plugin architecture
- [ ] Web interface
- [ ] Package vulnerability scanning
- [ ] Enhanced DOS wizard with more retro animations
- [ ] Sound effects for the retro experience
- [ ] Custom themes for the wizard interface

### Performance Improvements
- [ ] Database backend for large registries
- [ ] Distributed search infrastructure
- [ ] Caching layers
- [ ] API rate limiting

## Changelog

### v1.0.0
- Initial release
- MCP server implementation
- CLI tool with interactive mode
- AI-powered installation service
- Local registry system
- Comprehensive test suite
- **NEW**: DOS-style installation wizard with blue-to-black gradient
- **NEW**: Retro progress bars and ASCII art titles
- **NEW**: Classic Windows-style dialog boxes
