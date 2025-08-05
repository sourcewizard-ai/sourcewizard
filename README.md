# SourceWizard

[![Website](https://img.shields.io/badge/Website-sourcewizard.ai-blue)](https://sourcewizard.ai)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@sourcewizard/sourcewizard)](https://www.npmjs.com/package/@sourcewizard/sourcewizard)

AI-powered setup wizard for dev tools and libraries with MCP (Model Context Protocol) integration.

## Demo

[![asciicast](https://asciinema.org/a/PxMHEwWtK6oUbvHYjjyVymfvr.svg)](https://asciinema.org/a/PxMHEwWtK6oUbvHYjjyVymfvr)

## Overview

SourceWizard is an intelligent assistant that helps developers quickly find, install, and configure packages and development tools. It combines AI-powered search capabilities with automated installation and setup processes.

## Features

- **MCP Integration**: Adds up-to-date documentation to your prompts and automatically detects missing libraries or tools. No hallucinated or deprecated API calls.
- **AI-Powered Package Search**: Find packages and code snippets using natural language queries
- **Agentic AI Installer**: LLM that follows custom setup prompts for multiple packages with intelligent configuration
- **Beautiful Terminal UI**: Clean, progress-tracking interface that shows installation status in real-time
- **Multi-Platform Support**: Works across different package managers and project types

## Installation

```bash
npm install -g @sourcewizard/sourcewizard
```

## Usage

### CLI Commands

```bash
# Search for packages
sourcewizard search "react testing library"

# Install a package with AI guidance
sourcewizard install <package-name>

# Start mcp
sourcewizard mcp

# Check status of MCP installation
sourcewizard status
```

### MCP Integration

SourceWizard can be used as an MCP server with Claude Code or other MCP clients:

```bash
# Start MCP server
npm run mcp
```

Available MCP tools:
- `search_packages`: Search for packages and code snippets using AI-powered analysis
- `install_package`: Install and configure packages with AI guidance

**Important**: Always call `search_packages` first to clarify the exact package name before using `install_package`.

#### MCP Configuration

Add this to your MCP settings file (e.g., `~/.config/claude-code/mcp_settings.json`):

```json
{
  "mcpServers": {
    "sourcewizard": {
      "command": "npx",
      "args": ["sourcewizard", "mcp"],
      "env": {
        "SOURCEWIZARD_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Get your API key at [sourcewizard.ai/dashboard](https://sourcewizard.ai/dashboard).

## Environment Variables

- `SOURCEWIZARD_API_KEY`: Required for AI-powered features. [Get your API key here](https://sourcewizard.ai/dashboard)
- `SOURCEWIZARD_SERVER_URL`: Custom server URL (defaults to `http://localhost:3000` in development, `https://sourcewizard.ai` in production)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Run MCP server in development
npm run mcp
```

#### Local Development MCP Configuration

For development, add this to your MCP settings file to use the local version:

```json
{
  "mcpServers": {
    "sourcewizard-dev": {
      "command": "npx",
      "args": ["tsx", "path/to/sourcewizard/src/mcp/server.ts"],
      "env": {
        "SOURCEWIZARD_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Replace `path/to/sourcewizard` with the actual path to your sourcewizard directory.

### Adding a New Package

Packages are located in the `registry/` directory. To add a new package:

1. Copy an existing package directory and update the fields
2. Edit the package configuration in `pkg.config.ts`
3. Create installation instructions in `INSTALL.md`
4. Generate the package config JSON:

```bash
npx @typeconf/typeconf build registry
```

## Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Run CLI in development mode
- `npm run mcp` - Start MCP server
- `npm test` - Run test suite
- `npm run import-registry` - Import registry configurations

## Contributing

Contributions are welcome! Please feel free to:

- Submit bug reports and feature requests via [GitHub Issues](https://github.com/sourcewizard-ai/sourcewizard/issues)
- Contribute new package configurations to the registry
- Improve documentation and examples
- Submit pull requests for bug fixes and improvements

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.

## Links

- [Website](https://sourcewizard.ai)
- [GitHub Repository](https://github.com/sourcewizard-ai/sourcewizard)
- [Issues](https://github.com/sourcewizard-ai/sourcewizard/issues)
- [npm Package](https://www.npmjs.com/package/@sourcewizard/sourcewizard)
