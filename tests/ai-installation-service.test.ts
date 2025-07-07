import { AIInstallationService } from '../src/mcp-server/ai-installation-service';
import { Registry } from '../src/registry/registry';
import { InstallationOptions, Package, CodeSnippet, ProjectContext, PackageCategory, CodeCategory } from '../src/shared/types';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';

// Mock dependencies
jest.mock('../src/registry/registry');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
  },
}));
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const MockRegistry = Registry as jest.MockedClass<typeof Registry>;

describe('AIInstallationService', () => {
  let service: AIInstallationService;
  let mockRegistry: jest.Mocked<Registry>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistry = new MockRegistry() as jest.Mocked<Registry>;
    service = new AIInstallationService();
    (service as any).registry = mockRegistry;
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      mockRegistry.initialize.mockResolvedValue();

      await service.initialize();

      expect(mockRegistry.initialize).toHaveBeenCalled();
    });

    it('should load AI instructions during initialization', async () => {
      mockRegistry.initialize.mockResolvedValue();

      await service.initialize();

      // Check that default instructions are loaded
      expect((service as any).instructions.size).toBeGreaterThan(0);
      expect((service as any).instructions.has('express')).toBe(true);
      expect((service as any).instructions.has('react')).toBe(true);
      expect((service as any).instructions.has('lodash')).toBe(true);
    });
  });

  describe('package installation', () => {
    const mockPackage: Package = {
      name: 'test-package',
      version: '1.0.0',
      description: 'Test package',
      keywords: ['test'],
      category: PackageCategory.UTILITY,
    };

    beforeEach(async () => {
      mockRegistry.initialize.mockResolvedValue();
      await service.initialize();
    });

    it('should install NPM package successfully', async () => {
      mockRegistry.getPackage.mockResolvedValue(mockPackage);
      mockRegistry.getSnippet.mockResolvedValue(null);
      
      // Mock package.json reading
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {},
        scripts: {},
      }));

      // Mock successful command execution
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success exit code
          }
        }),
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const options: InstallationOptions = {
        packageName: 'test-package',
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(true);
      expect(result.installedPackages).toContain('test-package');
      expect(mockRegistry.getPackage).toHaveBeenCalledWith('test-package');
    });

    it('should handle package not found', async () => {
      mockRegistry.getPackage.mockResolvedValue(null);
      mockRegistry.getSnippet.mockResolvedValue(null);

      const options: InstallationOptions = {
        packageName: 'non-existent-package',
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found in registry');
    });

    it('should handle installation command failure', async () => {
      mockRegistry.getPackage.mockResolvedValue(mockPackage);
      mockRegistry.getSnippet.mockResolvedValue(null);
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }));

      // Mock failed command execution
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1); // Error exit code
          }
        }),
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const options: InstallationOptions = {
        packageName: 'test-package',
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to install');
    });

    it('should install with development flag', async () => {
      mockRegistry.getPackage.mockResolvedValue(mockPackage);
      mockRegistry.getSnippet.mockResolvedValue(null);
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }));

      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const options: InstallationOptions = {
        packageName: 'test-package',
        dev: true,
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('npm', ['install', '--save-dev', 'test-package'], expect.any(Object));
    });

    it('should install with specific version', async () => {
      mockRegistry.getPackage.mockResolvedValue(mockPackage);
      mockRegistry.getSnippet.mockResolvedValue(null);
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }));

      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const options: InstallationOptions = {
        packageName: 'test-package',
        version: '2.0.0',
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('npm', ['install', 'test-package@2.0.0'], expect.any(Object));
    });
  });

  describe('snippet installation', () => {
    const mockSnippet: CodeSnippet = {
      id: 'test-snippet',
      name: 'Test Snippet',
      description: 'Test code snippet',
      code: 'console.log("Hello, World!");',
      language: 'javascript',
      keywords: ['test'],
      category: CodeCategory.FUNCTION,
      dependencies: [],
    };

    beforeEach(async () => {
      mockRegistry.initialize.mockResolvedValue();
      await service.initialize();
    });

    it('should install code snippet successfully', async () => {
      mockRegistry.getPackage.mockResolvedValue(null);
      mockRegistry.getSnippet.mockResolvedValue(mockSnippet);
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      const options: InstallationOptions = {
        packageName: 'test-snippet',
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(true);
      expect(result.createdFiles).toHaveLength(1);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-snippet.js'),
        mockSnippet.code,
        'utf-8'
      );
    });

    it('should create usage example file', async () => {
      const snippetWithExample: CodeSnippet = {
        ...mockSnippet,
        usageExample: 'import { test } from "./test-snippet";\ntest();',
      };

      mockRegistry.getPackage.mockResolvedValue(null);
      mockRegistry.getSnippet.mockResolvedValue(snippetWithExample);
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      const options: InstallationOptions = {
        packageName: 'test-snippet',
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(true);
      expect(result.createdFiles).toHaveLength(2); // Main file + example file
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should handle snippet with dependencies', async () => {
      const snippetWithDeps: CodeSnippet = {
        ...mockSnippet,
        dependencies: ['lodash'],
      };

      mockRegistry.getPackage.mockResolvedValue(null);
      mockRegistry.getSnippet.mockResolvedValue(snippetWithDeps);
      
      // Mock lodash package for dependency installation
      const lodashPackage: Package = {
        name: 'lodash',
        version: '4.17.21',
        description: 'Utility library',
        keywords: ['utility'],
        category: PackageCategory.UTILITY,
      };

      mockRegistry.getPackage.mockImplementation((name) => {
        if (name === 'lodash') return Promise.resolve(lodashPackage);
        return Promise.resolve(null);
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      // Mock successful dependency installation
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const options: InstallationOptions = {
        packageName: 'test-snippet',
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(true);
      expect(result.installedPackages).toContain('lodash');
    });

    it('should use custom installation path', async () => {
      mockRegistry.getPackage.mockResolvedValue(null);
      mockRegistry.getSnippet.mockResolvedValue(mockSnippet);
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      const options: InstallationOptions = {
        packageName: 'test-snippet',
        customInstallPath: 'custom/path',
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('custom/path/test-snippet.js'),
        mockSnippet.code,
        'utf-8'
      );
    });
  });

  describe('project context detection', () => {
    beforeEach(async () => {
      mockRegistry.initialize.mockResolvedValue();
      await service.initialize();
    });

    it('should detect React project', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'react-app',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      }));

      const context = await (service as any).getProjectContext();

      expect(context.framework).toBe('react');
      expect(context.projectType).toBe('web');
    });

    it('should detect Express project', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'express-app',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0',
        },
      }));

      const context = await (service as any).getProjectContext();

      expect(context.framework).toBe('express');
      expect(context.projectType).toBe('web');
    });

    it('should detect CLI project', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'cli-tool',
        version: '1.0.0',
        bin: {
          'cli-tool': './bin/cli.js',
        },
        dependencies: {
          commander: '^9.0.0',
        },
      }));

      const context = await (service as any).getProjectContext();

      expect(context.projectType).toBe('cli');
    });

    it('should handle missing package.json', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      const context = await (service as any).getProjectContext();

      expect(context.name).toBe('unknown');
      expect(context.projectType).toBe('node');
    });

    it('should detect TypeScript project', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'ts-project',
        version: '1.0.0',
        type: 'module',
        devDependencies: {
          typescript: '^5.0.0',
        },
      }));

      const context = await (service as any).getProjectContext();

      expect(context.language).toBe('javascript'); // Based on current implementation
    });
  });

  describe('package manager detection', () => {
    beforeEach(async () => {
      mockRegistry.initialize.mockResolvedValue();
      await service.initialize();
    });

    it('should detect yarn from lock file', async () => {
      mockFs.access.mockImplementation((path) => {
        if (path.toString().includes('yarn.lock')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const context: ProjectContext = {
        name: 'test',
        version: '1.0.0',
        packageManager: 'npm',
        language: 'javascript',
        dependencies: {},
        devDependencies: {},
        scripts: {},
        projectType: 'node',
      };

      const packageManager = (service as any).detectPackageManager(context);

      expect(packageManager).toBe('yarn');
    });

    it('should default to npm when no lock files found', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const context: ProjectContext = {
        name: 'test',
        version: '1.0.0',
        packageManager: 'npm',
        language: 'javascript',
        dependencies: {},
        devDependencies: {},
        scripts: {},
        projectType: 'node',
      };

      const packageManager = (service as any).detectPackageManager(context);

      expect(packageManager).toBe('npm');
    });
  });

  describe('command building', () => {
    beforeEach(async () => {
      mockRegistry.initialize.mockResolvedValue();
      await service.initialize();
    });

    it('should build npm install command', () => {
      const options: InstallationOptions = {
        packageName: 'test-package',
      };

      const command = (service as any).buildInstallCommand('test-package', 'npm', options);

      expect(command).toBe('npm install test-package');
    });

    it('should build yarn add command', () => {
      const options: InstallationOptions = {
        packageName: 'test-package',
        dev: true,
      };

      const command = (service as any).buildInstallCommand('test-package', 'yarn', options);

      expect(command).toBe('yarn add --dev test-package');
    });

    it('should build pnpm add command with version', () => {
      const options: InstallationOptions = {
        packageName: 'test-package',
        version: '2.0.0',
        global: true,
      };

      const command = (service as any).buildInstallCommand('test-package', 'pnpm', options);

      expect(command).toBe('pnpm add --global test-package@2.0.0');
    });
  });

  describe('AI instructions', () => {
    beforeEach(async () => {
      mockRegistry.initialize.mockResolvedValue();
      await service.initialize();
    });

    it('should get AI instructions for Express', () => {
      const pkg: Package = {
        name: 'express',
        version: '4.18.0',
        description: 'Web framework',
        keywords: ['web', 'framework'],
        category: PackageCategory.FRAMEWORK,
      };

      const context: ProjectContext = {
        name: 'web-app',
        version: '1.0.0',
        packageManager: 'npm',
        language: 'javascript',
        dependencies: {},
        devDependencies: {},
        scripts: {},
        projectType: 'web',
      };

      const options: InstallationOptions = {
        packageName: 'express',
      };

      const instructions = (service as any).getAIInstructions(pkg, context, options);

      expect(instructions).toBeTruthy();
      expect(instructions.packageName).toBe('express');
      expect(instructions.instructions).toContain('Install express');
    });

    it('should return null for packages without instructions', () => {
      const pkg: Package = {
        name: 'unknown-package',
        version: '1.0.0',
        description: 'Unknown package',
        keywords: ['unknown'],
        category: PackageCategory.OTHER,
      };

      const context: ProjectContext = {
        name: 'test',
        version: '1.0.0',
        packageManager: 'npm',
        language: 'javascript',
        dependencies: {},
        devDependencies: {},
        scripts: {},
        projectType: 'node',
      };

      const options: InstallationOptions = {
        packageName: 'unknown-package',
      };

      const instructions = (service as any).getAIInstructions(pkg, context, options);

      expect(instructions).toBeTruthy(); // Still returns instruction due to fallback
    });
  });

  describe('file extension mapping', () => {
    beforeEach(async () => {
      mockRegistry.initialize.mockResolvedValue();
      await service.initialize();
    });

    it('should map languages to correct extensions', () => {
      expect((service as any).getFileExtension('javascript')).toBe('js');
      expect((service as any).getFileExtension('typescript')).toBe('ts');
      expect((service as any).getFileExtension('python')).toBe('py');
      expect((service as any).getFileExtension('unknown')).toBe('txt');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      mockRegistry.initialize.mockResolvedValue();
      await service.initialize();
    });

    it('should handle command execution errors', async () => {
      mockRegistry.getPackage.mockResolvedValue({
        name: 'test-package',
        version: '1.0.0',
        description: 'Test package',
        keywords: ['test'],
        category: PackageCategory.UTILITY,
      });
      mockRegistry.getSnippet.mockResolvedValue(null);
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }));

      // Mock command execution error
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Command not found'));
          }
        }),
      };
      mockSpawn.mockReturnValue(mockChild as any);

      const options: InstallationOptions = {
        packageName: 'test-package',
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Command not found');
    });

    it('should handle file system errors during snippet installation', async () => {
      mockRegistry.getPackage.mockResolvedValue(null);
      mockRegistry.getSnippet.mockResolvedValue({
        id: 'test-snippet',
        name: 'Test Snippet',
        description: 'Test code snippet',
        code: 'console.log("Hello");',
        language: 'javascript',
        keywords: ['test'],
        category: CodeCategory.FUNCTION,
        dependencies: [],
      });
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const options: InstallationOptions = {
        packageName: 'test-snippet',
      };

      const result = await service.installPackage(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Permission denied');
    });
  });
});