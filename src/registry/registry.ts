import { promises as fs } from 'fs';
import path from 'path';
import { 
  Package, 
  CodeSnippet, 
  RegistryEntry, 
  SearchOptions, 
  SearchResult, 
  PackageCategory,
  CodeCategory 
} from '../shared/types.js';

export class Registry {
  private entries: Map<string, RegistryEntry> = new Map();
  private dataPath: string;
  private initialized: boolean = false;

  constructor(dataPath: string = './registry-data') {
    this.dataPath = dataPath;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.loadData();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize registry:', error);
      throw error;
    }
  }

  private async loadData(): Promise<void> {
    try {
      const registryFile = path.join(this.dataPath, 'registry.json');
      const data = await fs.readFile(registryFile, 'utf-8');
      const parsedData = JSON.parse(data);
      
      this.entries = new Map(
        Object.entries(parsedData).map(([key, value]) => [
          key,
          {
            ...value as RegistryEntry,
            metadata: {
              ...(value as RegistryEntry).metadata,
              addedDate: new Date((value as RegistryEntry).metadata.addedDate),
              lastAccessed: (value as RegistryEntry).metadata.lastAccessed 
                ? new Date((value as RegistryEntry).metadata.lastAccessed as string | number | Date)
                : undefined
            }
          }
        ])
      );
    } catch (error) {
      // If file doesn't exist, initialize with default data
      await this.initializeDefaultData();
    }
  }

  private async saveData(): Promise<void> {
    try {
      const registryFile = path.join(this.dataPath, 'registry.json');
      const data = Object.fromEntries(this.entries);
      await fs.writeFile(registryFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save registry data:', error);
      throw error;
    }
  }

  private async initializeDefaultData(): Promise<void> {
    // Add some default packages and snippets
    const defaultPackages: Package[] = [
      {
        name: 'lodash',
        version: '4.17.21',
        description: 'A modern JavaScript utility library delivering modularity, performance & extras.',
        keywords: ['utility', 'functional', 'performance'],
        repository: 'https://github.com/lodash/lodash',
        homepage: 'https://lodash.com/',
        author: 'John-David Dalton',
        license: 'MIT',
        category: PackageCategory.UTILITY,
        popularity: 98,
        lastUpdated: new Date('2021-02-20'),
        size: '4.4 MB'
      },
      {
        name: 'express',
        version: '4.18.2',
        description: 'Fast, unopinionated, minimalist web framework for node.',
        keywords: ['framework', 'web', 'http', 'server'],
        repository: 'https://github.com/expressjs/express',
        homepage: 'https://expressjs.com/',
        author: 'TJ Holowaychuk',
        license: 'MIT',
        category: PackageCategory.FRAMEWORK,
        popularity: 95,
        lastUpdated: new Date('2023-10-10'),
        size: '2.2 MB'
      },
      {
        name: 'axios',
        version: '1.6.0',
        description: 'Promise based HTTP client for the browser and node.js',
        keywords: ['http', 'request', 'ajax', 'promise'],
        repository: 'https://github.com/axios/axios',
        homepage: 'https://axios-http.com/',
        author: 'Matt Zabriskie',
        license: 'MIT',
        category: PackageCategory.LIBRARY,
        popularity: 92,
        lastUpdated: new Date('2023-10-21'),
        size: '1.8 MB'
      }
    ];

    const defaultSnippets: CodeSnippet[] = [
      {
        id: 'debounce-function',
        name: 'Debounce Function',
        description: 'A utility function to debounce function calls',
        code: `function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}`,
        language: 'typescript',
        keywords: ['utility', 'debounce', 'performance', 'async'],
        category: CodeCategory.FUNCTION,
        author: 'System',
        framework: 'vanilla',
        dependencies: [],
        usageExample: `const debouncedSave = debounce(saveData, 300);
debouncedSave(data);`,
        installInstructions: 'Copy the function and import it into your project'
      },
      {
        id: 'react-custom-hook',
        name: 'useLocalStorage Hook',
        description: 'React hook for localStorage with TypeScript support',
        code: `import { useState, useEffect } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading localStorage key "' + key + '":', error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error('Error setting localStorage key "' + key + '":', error);
    }
  };

  return [storedValue, setValue];
}`,
        language: 'typescript',
        keywords: ['react', 'hook', 'localstorage', 'state'],
        category: CodeCategory.HOOK,
        author: 'System',
        framework: 'react',
        dependencies: ['react'],
        usageExample: `const [name, setName] = useLocalStorage('username', '');`,
        installInstructions: 'Copy the hook and ensure React is installed'
      }
    ];

    // Add packages to registry
    for (const pkg of defaultPackages) {
      await this.addPackage(pkg);
    }

    // Add snippets to registry
    for (const snippet of defaultSnippets) {
      await this.addSnippet(snippet);
    }
  }

  async addPackage(pkg: Package): Promise<void> {
    const entry: RegistryEntry = {
      type: 'package',
      data: pkg,
      metadata: {
        addedDate: new Date(),
        accessCount: 0,
        tags: pkg.keywords,
        verified: true,
        source: 'registry'
      }
    };

    this.entries.set(`package:${pkg.name}`, entry);
    await this.saveData();
  }

  async addSnippet(snippet: CodeSnippet): Promise<void> {
    const entry: RegistryEntry = {
      type: 'snippet',
      data: snippet,
      metadata: {
        addedDate: new Date(),
        accessCount: 0,
        tags: snippet.keywords,
        verified: true,
        source: 'registry'
      }
    };

    this.entries.set(`snippet:${snippet.id}`, entry);
    await this.saveData();
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    
    if (!this.initialized) {
      await this.initialize();
    }

    const query = options.query.toLowerCase();
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const includePackages = options.includePackages !== false;
    const includeSnippets = options.includeSnippets !== false;

    let packages: Package[] = [];
    let snippets: CodeSnippet[] = [];

    for (const [key, entry] of this.entries) {
      // Update access count
      entry.metadata.lastAccessed = new Date();
      entry.metadata.accessCount++;

      const matchesCategory = !options.category || 
        (entry.data as Package | CodeSnippet).category === options.category;
      
      const matchesLanguage = !options.language || 
        (entry.type === 'snippet' && (entry.data as CodeSnippet).language === options.language);

      if (entry.type === 'package' && includePackages && matchesCategory) {
        const pkg = entry.data as Package;
        const score = this.calculateSearchScore(pkg, query);
        
        if (score > 0) {
          packages.push({ ...pkg, popularity: score });
        }
      } else if (entry.type === 'snippet' && includeSnippets && matchesCategory && matchesLanguage) {
        const snippet = entry.data as CodeSnippet;
        const score = this.calculateSearchScore(snippet, query);
        
        if (score > 0) {
          snippets.push(snippet);
        }
      }
    }

    // Sort results
    const sortBy = options.sortBy || 'relevance';
    packages = this.sortResults(packages, sortBy);
    snippets = this.sortResults(snippets, sortBy);

    // Apply pagination
    const allResults = [...packages, ...snippets];
    const total = allResults.length;
    const paginatedPackages = packages.slice(offset, offset + Math.ceil(limit / 2));
    const paginatedSnippets = snippets.slice(offset, offset + Math.ceil(limit / 2));

    const executionTime = Date.now() - startTime;

    await this.saveData(); // Save updated access counts

    return {
      packages: paginatedPackages,
      snippets: paginatedSnippets,
      total,
      query: options.query,
      executionTime
    };
  }

  private calculateSearchScore(item: Package | CodeSnippet, query: string): number {
    let score = 0;
    
    // Exact name match gets highest score
    if (item.name.toLowerCase() === query) {
      score += 100;
    } else if (item.name.toLowerCase().includes(query)) {
      score += 50;
    }

    // Description match
    if (item.description.toLowerCase().includes(query)) {
      score += 30;
    }

    // Keywords match
    const keywordMatches = item.keywords.filter(keyword => 
      keyword.toLowerCase().includes(query)
    ).length;
    score += keywordMatches * 20;

    // Popularity bonus for packages
    if ('popularity' in item && item.popularity) {
      score += item.popularity * 0.1;
    }

    return score;
  }

  private sortResults<T extends Package | CodeSnippet>(
    results: T[], 
    sortBy: string
  ): T[] {
    switch (sortBy) {
      case 'name':
        return results.sort((a, b) => a.name.localeCompare(b.name));
      case 'date':
        return results.sort((a, b) => {
          const aDate = 'lastUpdated' in a && a.lastUpdated ? a.lastUpdated : new Date(0);
          const bDate = 'lastUpdated' in b && b.lastUpdated ? b.lastUpdated : new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
      case 'popularity':
        return results.sort((a, b) => {
          const aPopularity = 'popularity' in a && a.popularity ? a.popularity : 0;
          const bPopularity = 'popularity' in b && b.popularity ? b.popularity : 0;
          return bPopularity - aPopularity;
        });
      case 'relevance':
      default:
        return results.sort((a, b) => {
          const aPopularity = 'popularity' in a && a.popularity ? a.popularity : 0;
          const bPopularity = 'popularity' in b && b.popularity ? b.popularity : 0;
          return bPopularity - aPopularity;
        });
    }
  }

  async getPackage(name: string): Promise<Package | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const entry = this.entries.get(`package:${name}`);
    return entry && entry.type === 'package' ? entry.data as Package : null;
  }

  async getSnippet(id: string): Promise<CodeSnippet | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const entry = this.entries.get(`snippet:${id}`);
    return entry && entry.type === 'snippet' ? entry.data as CodeSnippet : null;
  }

  async getAllPackages(): Promise<Package[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const packages: Package[] = [];
    for (const [key, entry] of this.entries) {
      if (entry.type === 'package') {
        packages.push(entry.data as Package);
      }
    }
    return packages;
  }

  async getAllSnippets(): Promise<CodeSnippet[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const snippets: CodeSnippet[] = [];
    for (const [key, entry] of this.entries) {
      if (entry.type === 'snippet') {
        snippets.push(entry.data as CodeSnippet);
      }
    }
    return snippets;
  }

  async removePackage(name: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const deleted = this.entries.delete(`package:${name}`);
    if (deleted) {
      await this.saveData();
    }
    return deleted;
  }

  async removeSnippet(id: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const deleted = this.entries.delete(`snippet:${id}`);
    if (deleted) {
      await this.saveData();
    }
    return deleted;
  }

  async getStats(): Promise<{
    totalPackages: number;
    totalSnippets: number;
    totalEntries: number;
    categories: Record<string, number>;
    languages: Record<string, number>;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const stats = {
      totalPackages: 0,
      totalSnippets: 0,
      totalEntries: this.entries.size,
      categories: {} as Record<string, number>,
      languages: {} as Record<string, number>
    };

    for (const [key, entry] of this.entries) {
      if (entry.type === 'package') {
        stats.totalPackages++;
        const category = (entry.data as Package).category;
        stats.categories[category] = (stats.categories[category] || 0) + 1;
      } else if (entry.type === 'snippet') {
        stats.totalSnippets++;
        const snippet = entry.data as CodeSnippet;
        const category = snippet.category;
        const language = snippet.language;
        stats.categories[category] = (stats.categories[category] || 0) + 1;
        stats.languages[language] = (stats.languages[language] || 0) + 1;
      }
    }

    return stats;
  }
}