# Planner CLI

A standalone CLI tool for generating integration plans for software projects using Claude Agent SDK.

## Overview

This CLI runs inside a git repository and uses Claude's Agent SDK to:

1. **Analyze the codebase** - Explores project structure, dependencies, and patterns
2. **Ask clarifying questions** - Gathers requirements about the integration
3. **Generate three integration plans** - Provides Easy, Medium, and Hard difficulty options

## Usage

The CLI is designed to run in sandboxed environments (like Vercel Sandbox) where it can safely analyze codebases.

```bash
planner-cli '{"integration": "Stripe", "apiKey": "sk-...", "jsonSchema": {...}, ...}'
```

### Parameters

The CLI expects a JSON string with the following parameters:

- `integration` (required): The name of the integration (e.g., "Stripe", "Supabase")
- `apiKey` (required): Anthropic API key for Claude
- `jsonSchema` (required): JSON Schema defining the expected output structure
- `projectContext` (optional): Pre-analyzed project context
- `clarifications` (optional): User answers to clarifying questions
- `conversationHistory` (optional): Previous conversation messages for continuation
- `cwd` (optional): Working directory (defaults to current directory)

### Output

The CLI outputs JSON lines to stdout:

```json
{"type":"assistant","message":{...}}
{"type":"tool_use","message":{...}}
{"type":"result","structured_output":{...}}
```

## Development

### Build

```bash
pnpm build
```

### Type Check

```bash
pnpm run dev  # Watch mode
```

## Architecture

- **src/index.ts** - Main CLI entry point
- Runs in sandbox environments with Claude Agent SDK
- Outputs structured JSON for easy parsing by parent processes
- Uses Claude's tool use capabilities (Read, Write, Glob, Grep) for codebase analysis

## Integration

This CLI is compiled and injected into sandbox environments by the parent planner application. The compilation is handled by `compile-sandbox-runner.ts` using esbuild.
