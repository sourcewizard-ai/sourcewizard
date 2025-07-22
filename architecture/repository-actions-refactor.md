# Repository Actions Refactoring with Recursive Scanning

## Overview

The repository detector has been completely refactored to replace the simple `scripts` field with a sophisticated `RepositoryActions` structure that can intelligently detect and categorize build, test, deploy, and other actions. The system now features **recursive repository scanning** that respects gitignore patterns and discovers all packages and subpackages throughout the repository structure.

## Key New Features

### 🔍 **Recursive Repository Scanning**

- **Comprehensive Discovery**: Recursively scans the entire repository to find all packages and subpackages at any depth
- **Gitignore Compliance**: Automatically parses `.gitignore` files and respects ignore patterns
- **Smart Filtering**: Built-in ignore patterns for common directories (`node_modules`, `build`, `.git`, etc.)
- **Multi-Language Support**: Detects packages across different programming languages simultaneously

### 🎯 **Enhanced Action System**

- **Simplified Scope**: Merged `scope` and `workingDirectory` fields - the `scope` now serves both purposes
- **Targets Not Apps**: Renamed "apps" to "targets" for better terminology and clarity
- **Dependency Detection**: Automatically parses and extracts dependencies for each detected package
- **File Detection**: Detects `.env`, `.env.local` and dependency files for each target
- **On-Demand Reading**: Separate functions to read env names and dependencies when needed
- **Clean Root Context**: Removed all package-specific fields from root context

### 📦 **Intelligent Package Detection**

The system now detects packages by looking for specific configuration files:

- **Node.js**: `package.json`
- **Python**: `requirements.txt`, `setup.py`, `pyproject.toml`, `Pipfile`
- **Go**: `go.mod`
- **Rust**: `Cargo.toml`
- **Java**: `pom.xml`, `build.gradle`, `build.gradle.kts`
- **PHP**: `composer.json`
- **Ruby**: `Gemfile`

### 📂 **Advanced Monorepo Support**

- **Automatic Detection**: Finds packages in any directory structure
- **Flexible Patterns**: Works with any monorepo layout (not limited to `packages/` or `apps/`)
- **Deep Nesting**: Supports packages nested at any depth (e.g., `projects/team-a/microservice/`)
- **Mixed Languages**: Handles repositories with multiple programming languages

## Enhanced Architecture

### New Types and Interfaces

```typescript
interface PackageInfo {
  path: string;
  relativePath: string;
  type:
    | "node"
    | "python"
    | "go"
    | "rust"
    | "java-maven"
    | "java-gradle"
    | "php"
    | "ruby";
  configFile: string;
  name?: string;
  language: string;
  framework?: string;
  packageManager?: string;
}

interface GitignorePattern {
  pattern: string;
  isNegated: boolean;
  isDirectory: boolean;
}

interface RepositoryAction {
  command: string;
  scope: "root" | string; // 'root' for repository-wide, or relative path for package-specific
}

interface TargetInfo {
  name: string;
  path: string;
  language: string;
  version?: string;
  framework?: string;
  packageManager?: string;
  dependencyFiles: string[]; // Full paths relative to repo root (e.g., "./package.json", "./frontend/package.json")
  envFiles: string[]; // Full paths relative to repo root for package's own env files
}

interface ProjectContext {
  name: string; // Repository directory name
  actions: RepositoryActions; // Available actions for all targets
  targets?: Record<string, TargetInfo>; // Map of "path:name" (or ":name" for root) -> target info
}
```

### Gitignore Pattern Support

The system implements comprehensive gitignore pattern matching:

- **Wildcard Support**: Handles `*` patterns
- **Directory Patterns**: Recognizes directory-specific patterns
- **Negation Patterns**: Supports `!` negation
- **Comment Filtering**: Ignores comment lines starting with `#`

## Scanning Algorithm

### 1. **Gitignore Pattern Parsing**

```typescript
// Parses .gitignore and .git/info/exclude files
const patterns = await parseGitignorePatterns(repoPath);
```

### 2. **Recursive Directory Traversal**

```typescript
// Recursively scans directories while respecting ignore patterns
await scanDirectory(currentPath, repoPath, packages, patterns);
```

### 3. **Package File Detection**

```typescript
// Detects package files in each directory
const packageFiles = [
  { file: "package.json", type: "node", language: "javascript" },
  { file: "Cargo.toml", type: "rust", language: "rust" },
  // ... more package types
];
```

### 4. **Primary Package Determination**

```typescript
// Determines the primary package (usually root, or most common type)
const primaryPackage = await determinePrimaryPackage(repoPath, packages);
```

## Built-in Ignore Patterns

The system includes sensible defaults that are ignored even if not in `.gitignore`:

```typescript
const DEFAULT_IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  ".svn",
  "target",
  "build",
  "dist",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  ".cache",
  "__pycache__",
  ".venv",
  "Pods",
  "DerivedData",
  "vendor",
];
```

## Example Repository Structures

### Complex Monorepo Example

```
my-company/
├── .gitignore
├── package.json                 # Root workspace
├── frontend/
│   ├── web-app/
│   │   └── package.json         # React app
│   └── mobile-app/
│       └── package.json         # React Native app
├── backend/
│   ├── api-gateway/
│   │   └── go.mod              # Go service
│   ├── user-service/
│   │   └── Cargo.toml          # Rust service
│   └── notification-service/
│       └── requirements.txt     # Python service
├── libs/
│   ├── shared-ui/
│   │   └── package.json         # Shared React components
│   └── utils/
│       └── setup.py            # Python utilities
└── tools/
    └── build-scripts/
        └── go.mod              # Build automation tools
```

**Detection Result:**

- **Primary Package**: Root workspace (package.json)
- **Detected Apps**: 8 packages across 4 languages
- **Generated Actions**: Build, test, install, lint for each package with appropriate scopes

### Deep Nesting Example

```
enterprise/
├── divisions/
│   ├── finance/
│   │   └── reporting/
│   │       └── quarterly/
│   │           └── package.json    # Deep nested app
│   └── hr/
│       └── payroll/
│           └── calculator/
│               └── go.mod          # Go microservice
└── infrastructure/
    └── monitoring/
        └── alerts/
            └── Cargo.toml          # Rust monitoring tool
```

**Detection Result:**

- **Found Packages**: 3 packages at various depths
- **Relative Paths**:
  - `divisions/finance/reporting/quarterly`
  - `divisions/hr/payroll/calculator`
  - `infrastructure/monitoring/alerts`

## Performance Optimizations

### 1. **Early Directory Filtering**

- Checks ignore patterns before entering directories
- Skips entire subtrees when directories are ignored

### 2. **Efficient File Scanning**

- Only reads package files that are detected
- Skips non-package files during traversal

### 3. **Smart Package Type Detection**

- Stops scanning after finding one package type per directory (except Python)
- Uses file existence checks before attempting to read files

### 4. **Debug Logging**

- Uses `console.debug` for non-critical errors
- Gracefully handles permission errors and missing files

## Dependency and Environment File Detection

### File-Based Approach with Full Paths

Each target now includes full paths relative to repository root for dependency and environment files:

```typescript
// Root target with full paths
{
  dependencyFiles: ["./package.json"],
  envFiles: ["./env", "./env.local"]
}

// Nested Python target
{
  dependencyFiles: ["./api/requirements.txt", "./api/setup.py"],
  envFiles: ["./api/.env"]  // Only package's own env files
}

// Go target
{
  dependencyFiles: ["./services/auth/go.mod"],
  envFiles: ["./services/auth/.env.local"]  // Only package's own env files
}
```

### Targets as Map Structure

Targets are now organized as a map with "path:name" keys (":name" for root packages) for efficient access:

```typescript
{
  targets: {
    ":my-app": { name: "my-app", path: ".", ... },           // Root package (no path prefix)
    "frontend:web-app": { name: "web-app", path: "frontend", ... },
    "api:backend": { name: "backend", path: "api", ... }
  }
}
```

### On-Demand Parsing Functions

Use separate functions to read dependency and environment data when needed:

```typescript
// Access targets by key
const frontendTarget = result.targets!["frontend:web-app"];
const rootTarget = result.targets![":my-app"];

// Or iterate over all targets
for (const [key, target] of Object.entries(result.targets!)) {
  console.log(`Target ${key}: ${target.language}`);
}

// Get environment variable names only
const envNames = await getTargetEnvNames(targetInfo, repoPath);
// Returns: ["NODE_ENV", "API_URL", "DB_HOST", "PORT"]

// Get dependencies for a target
const deps = await getTargetDependencies(targetInfo, repoPath);
// Returns: { dependencies: {...}, devDependencies: {...} }
```

**Benefits:**

- **Lazy Loading**: Only parse files when actually needed
- **Performance**: Faster initial repository scanning
- **Flexibility**: Can re-read files as they change
- **Separation**: Clean separation between file detection and content parsing
- **Full Path Clarity**: Unambiguous file references relative to repository root
- **Clear Env Separation**: Each package manages only its own environment files
- **Efficient Access**: Map structure allows O(1) target lookup by "path:name" key (":name" for root packages)

## Package Manager Detection Fix

### Monorepo Support

Fixed package manager detection for monorepos where lock files are typically at the repository root:

```typescript
// Before: Only checked package directory
await detectPackageManager("/monorepo/packages/frontend"); // ❌ Can't find pnpm-lock.yaml

// After: Checks repository root first, then package directory
await detectPackageManager("/monorepo/packages/frontend", "/monorepo"); // ✅ Finds pnpm-lock.yaml at root
```

**Detection Order:**

1. **Repository Root**: Check for lock files at monorepo root (most common)
2. **Package Directory**: Check the specific package directory
3. **Parent Directories**: Traverse up to repository root to find lock files

**Benefits:**

- **Accurate Detection**: All packages in a pnpm monorepo correctly detect "pnpm"
- **No False Positives**: Prevents detecting multiple package managers
- **Backward Compatible**: Still works for individual packages with their own lock files

## Root Context Cleanup

### Clean Repository Root

The root context now maintains clean separation from package-specific information:

```typescript
// Before: Root polluted with package data
{
  name: "frontend-app",           // ❌ From package.json
  version: "1.2.3",             // ❌ From package.json
  language: "typescript",       // ❌ Inherited from packages
  packageManager: "npm",        // ❌ Inherited detection
  dependencies: {...},          // ❌ From package.json
}

// After: Minimal root context
{
  name: "my-repository",        // ✅ From directory name only
  actions: {...},              // ✅ Available actions
  targets: [...],              // ✅ All packages as targets
}
```

**Key Changes:**

- **Root name**: Always uses directory name, never package name
- **No package fields**: Removed version, language, packageManager, dependencies
- **All packages as targets**: Even root packages are included in targets array
- **Target-specific data**: Language, version, dependencies are in individual targets

## Action Generation Improvements

### Language-Specific Actions

Each detected package gets appropriate actions based on its type:

```typescript
// Node.js packages
actions.install.push({
  command: getInstallCommand(packageManager),
  scope: packageInfo.relativePath,
});

// Python packages
if (hasRequirements) {
  actions.install.push({
    command: "pip install -r requirements.txt",
    scope: packageInfo.relativePath,
  });
}

// Go packages
actions.build.push({
  command: "go build ./...",
  scope: packageInfo.relativePath,
});
```

### Simplified Scope System

Actions now use a unified scope system:

- **Root scope**: Repository-wide actions (`scope: "root"`)
- **Package scope**: Actions specific to individual packages (`scope: "packages/frontend"`)
- **Execution Context**: The scope indicates both the target and execution directory

## Testing Strategy

The implementation includes comprehensive test coverage:

### 1. **Recursive Detection Tests**

- Multi-language monorepo detection
- Gitignore pattern compliance
- Deep nesting support
- Python package variants

### 2. **Compatibility Tests**

- Backward compatibility with existing action detection
- Integration with previous test suites

### 3. **Edge Case Handling**

- Empty repositories
- Permission errors
- Malformed configuration files
- Circular directory structures (prevented by gitignore)

## Benefits of the New System

### 1. **Complete Repository Understanding**

- No more missed packages in subdirectories
- Full visibility into repository structure
- Accurate dependency mapping

### 2. **Respect for Developer Workflow**

- Honors gitignore patterns
- Skips build artifacts and dependencies
- Maintains clean scanning results

### 3. **Enhanced Monorepo Support**

- Works with any monorepo structure
- Supports mixed-language repositories
- Handles enterprise-scale codebases

### 4. **Improved Developer Experience**

- More accurate action suggestions
- Better package manager detection
- Cleaner, more organized results

### 5. **Extensibility**

- Easy to add new package types
- Configurable ignore patterns
- Modular scanning architecture

## Migration Notes

### Breaking Changes

- `scripts` field removed from `ProjectContext`
- Actions now use structured `RepositoryActions` format
- Package detection is now recursive by default
- **Simplified Actions**: `workingDirectory` field merged into `scope`
- **Terminology Change**: `apps` renamed to `targets` throughout the codebase
- **File-Based Targets**: Targets now point to files with full paths instead of parsed content
- **Root Context Cleanup**: Removed version, language, packageManager, dependencies from root
- **Targets as Map**: Changed from array to Record<string, TargetInfo> with "path:name" keys (":name" for root)
- **Full Path References**: All file paths are relative to repository root
- **Package-Specific Env Files**: Each target only includes its own environment files
- **On-Demand Parsing**: Added separate functions for reading env names and dependencies
- **Package Manager Detection**: Fixed monorepo detection to check repository root first

### Compatibility

- Existing action types are preserved
- Action execution context determined by `scope` field
- Tests updated to work with new structure and terminology

## Future Enhancements

1. **Configuration Files**: Support for custom ignore patterns
2. **Caching**: Cache scan results for large repositories
3. **Parallel Scanning**: Concurrent directory scanning for performance
4. **Custom Package Types**: User-defined package detection rules
5. **Workspace Integration**: Enhanced support for workspace tools (Nx, Lerna, Rush)

The recursive scanning upgrade represents a major improvement in repository understanding, making the tool much more capable of handling real-world, complex repository structures while maintaining respect for developer workflow and performance requirements.
