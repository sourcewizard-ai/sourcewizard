import { Registry } from '../src/registry/registry';
import { Package, CodeSnippet, SearchOptions, PackageCategory, CodeCategory } from '../src/shared/types';
import { promises as fs } from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Registry', () => {
  let registry: Registry;
  let testDataPath: string;

  beforeEach(() => {
    jest.clearAllMocks();
    testDataPath = '/tmp/test-registry';
    registry = new Registry(testDataPath);
  });

  describe('initialization', () => {
    it('should initialize with default data when no registry file exists', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      await registry.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(testDataPath, { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should load existing registry data', async () => {
      const mockData = {
        'package:test-package': {
          type: 'package',
          data: {
            name: 'test-package',
            version: '1.0.0',
            description: 'Test package',
            keywords: ['test'],
            category: PackageCategory.UTILITY,
          },
          metadata: {
            addedDate: '2023-01-01T00:00:00.000Z',
            accessCount: 0,
            tags: ['test'],
            verified: true,
            source: 'registry',
          },
        },
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockData));

      await registry.initialize();

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(testDataPath, 'registry.json'),
        'utf-8'
      );
    });

    it('should handle initialization errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(registry.initialize()).rejects.toThrow('Permission denied');
    });
  });

  describe('package management', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await registry.initialize();
    });

    it('should add a package successfully', async () => {
      const testPackage: Package = {
        name: 'test-package',
        version: '1.0.0',
        description: 'A test package',
        keywords: ['test', 'utility'],
        category: PackageCategory.UTILITY,
        author: 'Test Author',
        license: 'MIT',
      };

      await registry.addPackage(testPackage);

      expect(mockFs.writeFile).toHaveBeenCalled();
      
      const pkg = await registry.getPackage('test-package');
      expect(pkg).toEqual(testPackage);
    });

    it('should get all packages', async () => {
      const testPackages: Package[] = [
        {
          name: 'package1',
          version: '1.0.0',
          description: 'Package 1',
          keywords: ['test'],
          category: PackageCategory.UTILITY,
        },
        {
          name: 'package2',
          version: '2.0.0',
          description: 'Package 2',
          keywords: ['test'],
          category: PackageCategory.LIBRARY,
        },
      ];

      for (const pkg of testPackages) {
        await registry.addPackage(pkg);
      }

      const allPackages = await registry.getAllPackages();
      expect(allPackages).toHaveLength(testPackages.length + 3); // +3 for default packages
    });

    it('should remove a package', async () => {
      const testPackage: Package = {
        name: 'removable-package',
        version: '1.0.0',
        description: 'A removable package',
        keywords: ['test'],
        category: PackageCategory.UTILITY,
      };

      await registry.addPackage(testPackage);
      const removed = await registry.removePackage('removable-package');

      expect(removed).toBe(true);
      
      const pkg = await registry.getPackage('removable-package');
      expect(pkg).toBeNull();
    });

    it('should return false when removing non-existent package', async () => {
      const removed = await registry.removePackage('non-existent-package');
      expect(removed).toBe(false);
    });
  });

  describe('snippet management', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await registry.initialize();
    });

    it('should add a code snippet successfully', async () => {
      const testSnippet: CodeSnippet = {
        id: 'test-snippet',
        name: 'Test Snippet',
        description: 'A test code snippet',
        code: 'console.log("Hello, World!");',
        language: 'javascript',
        keywords: ['test', 'demo'],
        category: CodeCategory.FUNCTION,
        framework: 'vanilla',
        dependencies: [],
      };

      await registry.addSnippet(testSnippet);

      expect(mockFs.writeFile).toHaveBeenCalled();
      
      const snippet = await registry.getSnippet('test-snippet');
      expect(snippet).toEqual(testSnippet);
    });

    it('should get all snippets', async () => {
      const testSnippets: CodeSnippet[] = [
        {
          id: 'snippet1',
          name: 'Snippet 1',
          description: 'First snippet',
          code: 'const x = 1;',
          language: 'javascript',
          keywords: ['test'],
          category: CodeCategory.FUNCTION,
          dependencies: [],
        },
        {
          id: 'snippet2',
          name: 'Snippet 2',
          description: 'Second snippet',
          code: 'const y = 2;',
          language: 'typescript',
          keywords: ['test'],
          category: CodeCategory.UTILITY,
          dependencies: [],
        },
      ];

      for (const snippet of testSnippets) {
        await registry.addSnippet(snippet);
      }

      const allSnippets = await registry.getAllSnippets();
      expect(allSnippets).toHaveLength(testSnippets.length + 2); // +2 for default snippets
    });

    it('should remove a snippet', async () => {
      const testSnippet: CodeSnippet = {
        id: 'removable-snippet',
        name: 'Removable Snippet',
        description: 'A removable snippet',
        code: 'console.log("removable");',
        language: 'javascript',
        keywords: ['test'],
        category: CodeCategory.FUNCTION,
        dependencies: [],
      };

      await registry.addSnippet(testSnippet);
      const removed = await registry.removeSnippet('removable-snippet');

      expect(removed).toBe(true);
      
      const snippet = await registry.getSnippet('removable-snippet');
      expect(snippet).toBeNull();
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await registry.initialize();

      // Add test data
      const testPackage: Package = {
        name: 'search-test',
        version: '1.0.0',
        description: 'Package for search testing',
        keywords: ['search', 'test', 'utility'],
        category: PackageCategory.UTILITY,
        popularity: 85,
      };

      const testSnippet: CodeSnippet = {
        id: 'search-snippet',
        name: 'Search Snippet',
        description: 'Snippet for search testing',
        code: 'function search() { return "test"; }',
        language: 'javascript',
        keywords: ['search', 'function'],
        category: CodeCategory.FUNCTION,
        dependencies: [],
      };

      await registry.addPackage(testPackage);
      await registry.addSnippet(testSnippet);
    });

    it('should search packages by name', async () => {
      const searchOptions: SearchOptions = {
        query: 'search-test',
        includeSnippets: false,
      };

      const results = await registry.search(searchOptions);

      expect(results.packages).toHaveLength(1);
      expect(results.packages[0]!.name).toBe('search-test');
      expect(results.snippets).toHaveLength(0);
    });

    it('should search snippets by name', async () => {
      const searchOptions: SearchOptions = {
        query: 'search-snippet',
        includePackages: false,
      };

      const results = await registry.search(searchOptions);

      expect(results.packages).toHaveLength(0);
      expect(results.snippets).toHaveLength(1);
      expect(results.snippets[0]!.name).toBe('Search Snippet');
    });

    it('should search by keywords', async () => {
      const searchOptions: SearchOptions = {
        query: 'search',
      };

      const results = await registry.search(searchOptions);

      expect(results.total).toBeGreaterThan(0);
      expect(results.packages.length + results.snippets.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const searchOptions: SearchOptions = {
        query: 'test',
        category: CodeCategory.FUNCTION,
      };

      const results = await registry.search(searchOptions);

      expect(results.snippets.every(s => s.category === CodeCategory.FUNCTION)).toBe(true);
    });

    it('should filter by language', async () => {
      const searchOptions: SearchOptions = {
        query: 'test',
        language: 'javascript',
      };

      const results = await registry.search(searchOptions);

      expect(results.snippets.every(s => s.language === 'javascript')).toBe(true);
    });

    it('should limit results', async () => {
      const searchOptions: SearchOptions = {
        query: 'test',
        limit: 1,
      };

      const results = await registry.search(searchOptions);

      expect(results.packages.length + results.snippets.length).toBeLessThanOrEqual(1);
    });

    it('should sort results by popularity', async () => {
      const searchOptions: SearchOptions = {
        query: 'test',
        sortBy: 'popularity',
      };

      const results = await registry.search(searchOptions);

      // Check that packages are sorted by popularity (descending)
      for (let i = 0; i < results.packages.length - 1; i++) {
        const current = results.packages[i]!.popularity || 0;
        const next = results.packages[i + 1]!.popularity || 0;
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('should sort results by name', async () => {
      const searchOptions: SearchOptions = {
        query: 'test',
        sortBy: 'name',
      };

      const results = await registry.search(searchOptions);

      // Check that packages are sorted by name (ascending)
      for (let i = 0; i < results.packages.length - 1; i++) {
        const current = results.packages[i]!.name;
        const next = results.packages[i + 1]!.name;
        expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
      }
    });

    it('should handle empty search results', async () => {
      const searchOptions: SearchOptions = {
        query: 'nonexistent-package-name-xyz',
      };

      const results = await registry.search(searchOptions);

      expect(results.total).toBe(0);
      expect(results.packages).toHaveLength(0);
      expect(results.snippets).toHaveLength(0);
    });

    it('should update access count when searching', async () => {
      const searchOptions: SearchOptions = {
        query: 'search-test',
      };

      await registry.search(searchOptions);

      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle search with pagination', async () => {
      const searchOptions: SearchOptions = {
        query: 'test',
        limit: 2,
        offset: 1,
      };

      const results = await registry.search(searchOptions);

      expect(results.packages.length + results.snippets.length).toBeLessThanOrEqual(2);
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await registry.initialize();
    });

    it('should return correct statistics', async () => {
      const stats = await registry.getStats();

      expect(stats).toHaveProperty('totalPackages');
      expect(stats).toHaveProperty('totalSnippets');
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('categories');
      expect(stats).toHaveProperty('languages');

      expect(stats.totalPackages).toBeGreaterThan(0);
      expect(stats.totalSnippets).toBeGreaterThan(0);
      expect(stats.totalEntries).toBe(stats.totalPackages + stats.totalSnippets);
    });

    it('should track categories correctly', async () => {
      const testPackage: Package = {
        name: 'stats-test',
        version: '1.0.0',
        description: 'Package for stats testing',
        keywords: ['test'],
        category: PackageCategory.TESTING,
      };

      await registry.addPackage(testPackage);
      const stats = await registry.getStats();

      expect(stats.categories).toHaveProperty(PackageCategory.TESTING);
      expect(stats.categories[PackageCategory.TESTING]).toBeGreaterThan(0);
    });

    it('should track languages correctly', async () => {
      const testSnippet: CodeSnippet = {
        id: 'stats-snippet',
        name: 'Stats Snippet',
        description: 'Snippet for stats testing',
        code: 'print("Hello")',
        language: 'python',
        keywords: ['test'],
        category: CodeCategory.FUNCTION,
        dependencies: [],
      };

      await registry.addSnippet(testSnippet);
      const stats = await registry.getStats();

      expect(stats.languages).toHaveProperty('python');
      expect(stats.languages['python']).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors during save', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await registry.initialize();

      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const testPackage: Package = {
        name: 'error-test',
        version: '1.0.0',
        description: 'Package for error testing',
        keywords: ['test'],
        category: PackageCategory.UTILITY,
      };

      await expect(registry.addPackage(testPackage)).rejects.toThrow('Permission denied');
    });

    it('should handle corrupted registry data', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('invalid json data');
      mockFs.writeFile.mockResolvedValue();

      await expect(registry.initialize()).rejects.toThrow();
    });
  });

  describe('search scoring', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await registry.initialize();
    });

    it('should score exact name matches higher', async () => {
      const exactMatch: Package = {
        name: 'exact',
        version: '1.0.0',
        description: 'Different description',
        keywords: ['other'],
        category: PackageCategory.UTILITY,
        popularity: 50,
      };

      const partialMatch: Package = {
        name: 'exact-partial',
        version: '1.0.0',
        description: 'Contains exact keyword',
        keywords: ['exact'],
        category: PackageCategory.UTILITY,
        popularity: 90,
      };

      await registry.addPackage(exactMatch);
      await registry.addPackage(partialMatch);

      const searchOptions: SearchOptions = {
        query: 'exact',
      };

      const results = await registry.search(searchOptions);

      // Exact name match should score higher despite lower popularity
      expect(results.packages[0]!.name).toBe('exact');
    });

    it('should consider popularity in scoring', async () => {
      const lowPopularity: Package = {
        name: 'low-pop',
        version: '1.0.0',
        description: 'Package with low popularity',
        keywords: ['common'],
        category: PackageCategory.UTILITY,
        popularity: 10,
      };

      const highPopularity: Package = {
        name: 'high-pop',
        version: '1.0.0',
        description: 'Package with high popularity',
        keywords: ['common'],
        category: PackageCategory.UTILITY,
        popularity: 95,
      };

      await registry.addPackage(lowPopularity);
      await registry.addPackage(highPopularity);

      const searchOptions: SearchOptions = {
        query: 'common',
      };

      const results = await registry.search(searchOptions);

      // Higher popularity should score higher when other factors are equal
      expect(results.packages[0]!.name).toBe('high-pop');
    });
  });
});