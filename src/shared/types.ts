/**
 * Shared types for MCP Package Manager
 */

export interface Package {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  repository?: string;
  homepage?: string;
  author?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  installCommand?: string;
  category: PackageCategory;
  popularity?: number;
  lastUpdated?: Date;
  size?: string;
}

export interface CodeSnippet {
  id: string;
  name: string;
  description: string;
  code: string;
  language: string;
  keywords: string[];
  category: CodeCategory;
  author?: string;
  framework?: string;
  dependencies?: string[];
  usageExample?: string;
  installInstructions?: string;
}

export enum PackageCategory {
  UTILITY = 'utility',
  FRAMEWORK = 'framework',
  LIBRARY = 'library',
  TOOL = 'tool',
  TESTING = 'testing',
  DATABASE = 'database',
  AUTH = 'auth',
  UI = 'ui',
  API = 'api',
  OTHER = 'other'
}

export enum CodeCategory {
  FUNCTION = 'function',
  CLASS = 'class',
  COMPONENT = 'component',
  HOOK = 'hook',
  UTILITY = 'utility',
  CONFIGURATION = 'configuration',
  TEMPLATE = 'template',
  SNIPPET = 'snippet',
  OTHER = 'other'
}

export interface SearchResult {
  packages: Package[];
  snippets: CodeSnippet[];
  total: number;
  query: string;
  executionTime: number;
}

export interface SearchOptions {
  query: string;
  category?: PackageCategory | CodeCategory;
  language?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'popularity' | 'date' | 'name';
  includePackages?: boolean;
  includeSnippets?: boolean;
}

export interface InstallationResult {
  success: boolean;
  message: string;
  installedPackages?: string[];
  createdFiles?: string[];
  errors?: string[];
  warnings?: string[];
}

export interface InstallationOptions {
  packageName: string;
  version?: string;
  dev?: boolean;
  global?: boolean;
  force?: boolean;
  skipDependencies?: boolean;
  customInstallPath?: string;
  aiInstructions?: string;
}

export interface AIInstallationInstruction {
  id: string;
  packageName: string;
  instructions: string;
  conditions?: string[];
  priority: number;
  lastUpdated: Date;
  success_rate?: number;
}

export interface RegistryEntry {
  type: 'package' | 'snippet';
  data: Package | CodeSnippet;
  metadata: {
    addedDate: Date;
    lastAccessed?: Date;
    accessCount: number;
    tags: string[];
    verified: boolean;
    source?: string;
  };
}

export interface RegistryConfig {
  name: string;
  url?: string;
  local: boolean;
  priority: number;
  credentials?: {
    username: string;
    token: string;
  };
}

export interface MCPSearchCommand {
  name: 'search_packages';
  description: 'Search for packages and code snippets';
  inputSchema: {
    type: 'object';
    properties: {
      query: { type: 'string' };
      options?: SearchOptions;
    };
    required: ['query'];
  };
}

export interface MCPInstallCommand {
  name: 'install_package';
  description: 'Install a package or code snippet';
  inputSchema: {
    type: 'object';
    properties: {
      packageName: { type: 'string' };
      options?: InstallationOptions;
    };
    required: ['packageName'];
  };
}

export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: Date;
    executionTime: number;
    requestId: string;
  };
}

export interface CLIConfig {
  defaultRegistry: string;
  registries: RegistryConfig[];
  aiProvider?: 'openai' | 'anthropic' | 'local';
  aiApiKey?: string;
  defaultInstallPath?: string;
  verboseLogging: boolean;
  autoConfirm: boolean;
  cacheExpiry: number; // in minutes
}

export interface ProjectContext {
  name: string;
  version: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  framework?: string;
  language: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  projectType: 'web' | 'node' | 'mobile' | 'desktop' | 'library' | 'cli' | 'other';
}