# MCP Package Manager Architecture

## Project Overview

The MCP Package Manager is a TypeScript-based intelligent package and code snippet management system that consists of two main components:

1. **MCP Server**: A server that provides search and installation commands through the Model Context Protocol (MCP)
2. **CLI Tool**: A command-line interface that interacts with the MCP server and provides user-friendly package management

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Interface                         │
├─────────────────────────┬───────────────────────────────────────┤
│     CLI Tool            │           MCP Client                  │
│  - Interactive Mode     │      (External applications)         │
│  - Command Mode         │                                       │
│  - User Management      │                                       │
├─────────────────────────┼───────────────────────────────────────┤
│                      MCP Server                                 │
│  - Search Handler                                               │
│  - Installation Handler                                         │
│  - Package Info Handler                                         │
│  - Registry Stats Handler                                       │
├─────────────────────────┼───────────────────────────────────────┤
│      Registry           │        AI Installation Service       │
│  - Package Storage      │    - Project Context Detection       │
│  - Snippet Storage      │    - AI-guided Installation          │
│  - Search Engine        │    - Package Manager Detection       │
│  - Metadata Management  │    - Smart Setup Instructions        │
└─────────────────────────┴───────────────────────────────────────┘
```

## Component Details

### 1. MCP Server (`src/mcp-server/`)

The MCP server is the core component that provides the following tools:

- **search_packages**: Search for packages and code snippets
- **install_package**: Install packages or apply code snippets with AI guidance
- **get_package_info**: Get detailed information about specific items
- **get_registry_stats**: Get statistics about the registry

#### Key Files:
- `server.ts`: Main MCP server implementation
- `ai-installation-service.ts`: AI-powered installation service
- `index.ts`: Server entry point

### 2. Registry System (`src/registry/`)

The registry manages storage and retrieval of packages and code snippets:

- **Persistent Storage**: JSON-based storage with metadata
- **Search Engine**: Fuzzy search with ranking and categorization
- **Metadata Management**: Access tracking, popularity scoring
- **Default Content**: Pre-populated with common packages and snippets

#### Key Features:
- Category-based filtering
- Language-specific search for code snippets
- Popularity-based ranking
- Access pattern tracking
- Versioning support

### 3. CLI Tool (`src/cli/`)

The CLI provides multiple interaction modes:

- **Command Mode**: Direct command execution
- **Interactive Mode**: Menu-driven interface
- **Batch Operations**: Multiple package management

#### Available Commands:
- `search <query>`: Search packages and snippets
- `install <name>`: Install package or snippet
- `info <name>`: Get detailed information
- `list`: List all available items
- `add`: Add new packages or snippets
- `stats`: Show registry statistics
- `interactive`: Start interactive mode

### 4. AI Installation Service

The AI service provides intelligent installation guidance:

- **Project Context Detection**: Automatically detects project type, framework, and dependencies
- **Smart Installation**: Chooses appropriate package manager and installation options
- **Setup Instructions**: Provides AI-generated setup instructions for packages
- **Dependency Management**: Handles complex dependency chains

#### AI Features:
- Package manager detection (npm, yarn, pnpm, bun)
- Framework-specific setup instructions
- Project type detection (web, node, mobile, etc.)
- Intelligent error handling and recovery

### 5. Shared Types (`src/shared/`)

Type definitions ensure type safety across the system:

- **Package**: NPM package metadata
- **CodeSnippet**: Code snippet with language and framework info
- **SearchOptions**: Search parameters and filters
- **InstallationOptions**: Installation configuration
- **ProjectContext**: Project metadata for smart decisions

## Data Flow

### Search Operation
1. User submits search query via CLI or MCP client
2. MCP server receives search request
3. Registry performs fuzzy search with ranking
4. Results are filtered, sorted, and paginated
5. Response includes packages, snippets, and metadata

### Installation Operation
1. User requests package/snippet installation
2. AI service analyzes project context
3. Appropriate installation strategy is selected
4. Package manager commands are executed
5. AI-guided setup is performed if available
6. Installation results are reported

### Registry Management
1. Registry loads from persistent storage
2. Search requests update access patterns
3. New packages/snippets are added with metadata
4. Periodic saves maintain data consistency

## Configuration

### Registry Configuration
- **Data Path**: Location for registry storage
- **Default Packages**: Pre-populated content
- **Search Parameters**: Ranking and filtering options

### AI Service Configuration
- **Instruction Templates**: Pre-defined setup instructions
- **Project Detection Rules**: Framework and type detection
- **Package Manager Preferences**: Installation command templates

### CLI Configuration
- **Display Options**: Colors, formatting, pagination
- **Interactive Mode**: Menu structure and flow
- **Command Aliases**: Shorthand command names

## Extensibility

### Adding New Package Types
1. Extend the `Package` interface in shared types
2. Update registry search and storage logic
3. Add AI installation instructions
4. Update CLI display methods

### Adding New AI Instructions
1. Define instruction templates in AI service
2. Add condition matching logic
3. Implement setup automation
4. Test with target packages

### Adding New Search Filters
1. Extend `SearchOptions` interface
2. Update registry search algorithm
3. Add CLI command options
4. Update MCP server tool schemas

## Performance Considerations

### Search Performance
- In-memory search index for fast lookups
- Caching of search results
- Pagination to limit response size
- Asynchronous processing for large datasets

### Installation Performance
- Parallel dependency installation
- Caching of project context analysis
- Efficient file system operations
- Progress tracking for user feedback

### Memory Management
- Lazy loading of registry data
- Efficient data structures for search
- Garbage collection of unused cache entries
- Streaming for large file operations

## Security Considerations

### Input Validation
- Sanitization of search queries
- Validation of installation parameters
- File path traversal protection
- Command injection prevention

### Package Safety
- Verification of package metadata
- Trusted source validation
- Malicious code detection
- Sandbox execution for snippets

### Data Protection
- Secure storage of registry data
- Access control for sensitive operations
- Audit logging of installation activities
- Privacy protection for user data

## Testing Strategy

### Unit Tests
- Registry operations (search, add, remove)
- AI service logic (context detection, installation)
- CLI command handlers
- Type validation and edge cases

### Integration Tests
- MCP server tool execution
- CLI command workflows
- Registry persistence
- AI service integration

### End-to-End Tests
- Complete search and installation workflows
- Interactive mode navigation
- Error handling and recovery
- Performance benchmarks

## Future Enhancements

### Planned Features
- Remote registry support
- Package dependency graphs
- Installation analytics
- Advanced AI model integration
- Multi-language support
- Plugin architecture

### Scalability Improvements
- Database backend for large registries
- Distributed search infrastructure
- Caching layers for performance
- API rate limiting and throttling

## Dependencies

### Core Dependencies
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `commander`: CLI framework
- `inquirer`: Interactive prompts
- `chalk`: Terminal styling
- `ora`: Progress spinners

### Development Dependencies
- `typescript`: Type checking and compilation
- `jest`: Unit testing framework
- `eslint`: Code linting
- `tsx`: TypeScript execution

## Deployment

### Local Development
1. Install dependencies: `npm install`
2. Build project: `npm run build`
3. Run MCP server: `npm run start:server`
4. Use CLI tool: `npm run cli`

### Production Deployment
1. Build for production: `npm run build`
2. Configure environment variables
3. Start MCP server as daemon
4. Install CLI tool globally: `npm install -g`

## Monitoring and Debugging

### Logging
- Structured logging with different levels
- Request/response logging for MCP operations
- Installation activity tracking
- Performance metrics collection

### Error Handling
- Graceful error recovery
- User-friendly error messages
- Detailed error logging
- Automatic retry mechanisms

### Health Checks
- Registry data integrity checks
- MCP server connectivity tests
- AI service availability monitoring
- CLI command validation