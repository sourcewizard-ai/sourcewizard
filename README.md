# SourceWizard

A terminal-based package manager with AI-powered guidance, featuring two different UI implementations.

## Features

- 🎨 **Two UI Options**: Choose between DOS-style raw terminal UI or modern React-based Ink UI
- 🔍 **Smart Package Search**: AI-powered package discovery and recommendations
- 🤖 **AI Context Detection**: Automatically detects project type and suggests optimal packages
- 📦 **Multi-Package Manager Support**: Works with npm, yarn, pnpm, and bun
- 🎯 **Code Snippet Registry**: Personal code snippet management
- 📊 **Usage Analytics**: Track installation patterns and statistics

## UI Implementations

### 1. DOS-Style UI (`src/cli/dos-ui.ts`)

- Raw terminal escape sequences for full control
- Fullscreen gradient backgrounds
- Custom ASCII art and box drawing
- Manual keyboard input handling
- Lightweight with minimal dependencies

### 2. Ink UI (`src/cli/ink-ui.tsx`)

- React-based declarative components
- Built-in responsive layouts
- Component composition
- Hooks for state management
- Rich ecosystem of ink components

## Installation

```bash
# Install dependencies
npm install

# Install for development
npm install --save-dev
```

## Usage

### Running the DOS-Style UI

```bash
npm run dos-ui
```

### Running the Ink UI

```bash
# Original ink UI (may have compatibility issues)
npm run ink-ui

# Simplified ink UI (stable, working version)
npm run ink-ui-simple
```

### Development

```bash
npm run dev
```

## Dependencies

### Core Dependencies

- `chalk` - Terminal colors
- `figlet` - ASCII art text
- `gradient-string` - Text gradients
- `boxen` - Terminal boxes

### Ink-Specific Dependencies

- `react` (v17.x) - React library (compatible version)
- `ink` (v3.x) - React for CLI (stable version)
- `ink-gradient` - Gradient text for ink
- `ink-big-text` - Large text component
- `ink-spinner` - Loading spinners
- Compatible versions avoid the yoga-wasm-web top-level await issue

## Key Differences

| Feature              | DOS-Style UI        | Ink UI                |
| -------------------- | ------------------- | --------------------- |
| **Architecture**     | Imperative          | Declarative           |
| **State Management** | Manual              | React hooks           |
| **Styling**          | Escape sequences    | Component props       |
| **Responsiveness**   | Manual calculations | Built-in              |
| **Components**       | Custom functions    | React components      |
| **Keyboard Input**   | Raw mode handling   | `useInput` hook       |
| **Testing**          | Complex             | React Testing Library |
| **Maintenance**      | Higher complexity   | More structured       |

## Screen Flow

Both implementations feature the same screen flow:

1. **Welcome Screen** - ASCII art title and introduction
2. **Main Menu** - Navigation with arrow keys
3. **Package Selection** - Choose from available packages
4. **AI Analysis** - Context detection and recommendations
5. **Installation Progress** - Real-time progress updates
6. **Completion Screen** - Success/failure with details
7. **Error Handling** - User-friendly error messages
8. **Search Results** - Package discovery interface

## Development

### Project Structure

```
src/
├── cli/
│   ├── dos-ui.ts           # Original DOS-style implementation
│   ├── ink-ui.tsx          # Full Ink-based implementation
│   ├── ink-ui-simple.tsx   # Simplified Ink UI (stable version)
│   ├── ink-demo.ts         # Demo script for full Ink UI
│   └── ink-demo-simple.ts  # Demo script for simplified Ink UI
├── types/                  # TypeScript type definitions
└── utils/                  # Shared utilities
```

### TypeScript Configuration

The project uses TypeScript with JSX support enabled for the Ink components:

```json
{
  "compilerOptions": {
    "jsx": "react",
    "target": "ES2020",
    "module": "commonjs"
  }
}
```

### Version Compatibility

The ink implementation uses:

- **React 17.x** - For broader compatibility
- **ink 3.x** - Stable version without yoga-wasm-web issues
- **CommonJS modules** - For consistent Node.js support

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.
