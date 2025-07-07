import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Registry } from '../registry/registry.js';
import { AIInstallationService } from './ai-installation-service.js';
import { 
  SearchOptions, 
  InstallationOptions, 
  MCPResponse 
} from '../shared/types.js';

export class MCPPackageServer {
  private server: Server;
  private registry: Registry;
  private aiService: AIInstallationService;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-package-manager',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registry = new Registry();
    this.aiService = new AIInstallationService();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_packages',
            description: 'Search for packages and code snippets in the registry',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query to find packages and snippets',
                },
                options: {
                  type: 'object',
                  properties: {
                    category: {
                      type: 'string',
                      description: 'Filter by category (utility, framework, library, etc.)',
                    },
                    language: {
                      type: 'string',
                      description: 'Filter by programming language (for snippets)',
                    },
                    limit: {
                      type: 'number',
                      description: 'Maximum number of results to return',
                      default: 10,
                    },
                    offset: {
                      type: 'number',
                      description: 'Offset for pagination',
                      default: 0,
                    },
                    sortBy: {
                      type: 'string',
                      enum: ['relevance', 'popularity', 'date', 'name'],
                      description: 'Sort results by criteria',
                      default: 'relevance',
                    },
                    includePackages: {
                      type: 'boolean',
                      description: 'Include packages in results',
                      default: true,
                    },
                    includeSnippets: {
                      type: 'boolean',
                      description: 'Include code snippets in results',
                      default: true,
                    },
                  },
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'install_package',
            description: 'Install a package or apply a code snippet with AI guidance',
            inputSchema: {
              type: 'object',
              properties: {
                packageName: {
                  type: 'string',
                  description: 'Name of the package or snippet to install',
                },
                options: {
                  type: 'object',
                  properties: {
                    version: {
                      type: 'string',
                      description: 'Specific version to install',
                    },
                    dev: {
                      type: 'boolean',
                      description: 'Install as development dependency',
                      default: false,
                    },
                    global: {
                      type: 'boolean',
                      description: 'Install globally',
                      default: false,
                    },
                    force: {
                      type: 'boolean',
                      description: 'Force installation',
                      default: false,
                    },
                    skipDependencies: {
                      type: 'boolean',
                      description: 'Skip dependency installation',
                      default: false,
                    },
                    customInstallPath: {
                      type: 'string',
                      description: 'Custom path for installation',
                    },
                    aiInstructions: {
                      type: 'string',
                      description: 'Additional AI instructions for installation',
                    },
                  },
                },
              },
              required: ['packageName'],
            },
          },
          {
            name: 'get_package_info',
            description: 'Get detailed information about a specific package or snippet',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name or ID of the package/snippet',
                },
                type: {
                  type: 'string',
                  enum: ['package', 'snippet'],
                  description: 'Type of item to retrieve',
                },
              },
              required: ['name', 'type'],
            },
          },
          {
            name: 'get_registry_stats',
            description: 'Get statistics about the registry contents',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_packages':
            return await this.handleSearchPackages(args);
          case 'install_package':
            return await this.handleInstallPackage(args);
          case 'get_package_info':
            return await this.handleGetPackageInfo(args);
          case 'get_registry_stats':
            return await this.handleGetRegistryStats();
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Tool ${name} not found`
            );
        }
      } catch (error) {
        console.error(`Error handling tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to execute tool ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleSearchPackages(args: any): Promise<MCPResponse> {
    const startTime = Date.now();
    
    if (!args.query || typeof args.query !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Query parameter is required and must be a string'
      );
    }

    const searchOptions: SearchOptions = {
      query: args.query,
      category: args.options?.category,
      language: args.options?.language,
      limit: args.options?.limit || 10,
      offset: args.options?.offset || 0,
      sortBy: args.options?.sortBy || 'relevance',
      includePackages: args.options?.includePackages !== false,
      includeSnippets: args.options?.includeSnippets !== false,
    };

    const result = await this.registry.search(searchOptions);
    
    return {
      success: true,
      data: result,
      metadata: {
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        requestId: `search-${Date.now()}`,
      },
    };
  }

  private async handleInstallPackage(args: any): Promise<MCPResponse> {
    const startTime = Date.now();
    
    if (!args.packageName || typeof args.packageName !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'packageName parameter is required and must be a string'
      );
    }

    const installOptions: InstallationOptions = {
      packageName: args.packageName,
      version: args.options?.version,
      dev: args.options?.dev || false,
      global: args.options?.global || false,
      force: args.options?.force || false,
      skipDependencies: args.options?.skipDependencies || false,
      customInstallPath: args.options?.customInstallPath,
      aiInstructions: args.options?.aiInstructions,
    };

    const result = await this.aiService.installPackage(installOptions);
    
    return {
      success: result.success,
      data: result,
      error: result.success ? undefined : result.message,
      metadata: {
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        requestId: `install-${Date.now()}`,
      },
    };
  }

  private async handleGetPackageInfo(args: any): Promise<MCPResponse> {
    const startTime = Date.now();
    
    if (!args.name || typeof args.name !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'name parameter is required and must be a string'
      );
    }

    if (!args.type || !['package', 'snippet'].includes(args.type)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'type parameter is required and must be "package" or "snippet"'
      );
    }

    let result;
    if (args.type === 'package') {
      result = await this.registry.getPackage(args.name);
    } else {
      result = await this.registry.getSnippet(args.name);
    }

    if (!result) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `${args.type} "${args.name}" not found`
      );
    }

    return {
      success: true,
      data: result,
      metadata: {
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        requestId: `info-${Date.now()}`,
      },
    };
  }

  private async handleGetRegistryStats(): Promise<MCPResponse> {
    const startTime = Date.now();
    
    const stats = await this.registry.getStats();
    
    return {
      success: true,
      data: stats,
      metadata: {
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        requestId: `stats-${Date.now()}`,
      },
    };
  }

  async start(): Promise<void> {
    try {
      await this.registry.initialize();
      await this.aiService.initialize();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error('MCP Package Manager Server started successfully');
    } catch (error) {
      console.error('Failed to start MCP Package Manager Server:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    await this.server.close();
  }
}