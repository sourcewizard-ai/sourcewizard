# SourceWizard

[Website](https://sourcewizard.ai)

A terminal-based setup wizard for devtools and MCP for searching package and enriching context with up to date documentation.

## Demo

[![asciicast](https://asciinema.org/a/PxMHEwWtK6oUbvHYjjyVymfvr.svg)](https://asciinema.org/a/PxMHEwWtK6oUbvHYjjyVymfvr)

## Features

- MCP context improvement: SourceWizard adds up to date documentation to your prompt and automatically detect if you are missing a library or tool. No hallucinated or deprecated API calls.
- Agentic AI installer: LLM that follows custom setup prompts provided for multple packages.
- CLI: nice looking terminal UI that shows you the progress of installation.

### Development

```bash
# Install dependencies
npm install

# Run the CLI
npm run dev -- install <package>
```

NOTE: We're using a custom version of [ink](https://github.com/vadimdemedes/ink) in the demo that supports background colors, so the TUI wouldn't look as good yet, until the support is merged into the main branch.

### Adding a new package

Packages are located at `registry/` directory. You can copy the existing one and update the fields.

When you're happy with the prompt, before pushing the commit please run this command to generate the package config JSON:

```
npx @typeconf/typeconf build registry
```
