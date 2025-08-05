#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(__dirname, '..', 'dist');

async function fixImports(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      await fixImports(fullPath);
    } else if (entry.name.endsWith('.js')) {
      let content = await fs.readFile(fullPath, 'utf-8');
      
      // Fix relative imports without extensions
      content = content.replace(
        /from ["'](\.[^"']*?)["']/g,
        (match, path) => {
          if (path.endsWith('.js') || path.endsWith('.json')) {
            return match; // Already has extension
          }
          return match.replace(path, path + '.js');
        }
      );
      
      // Fix import statements without extensions
      content = content.replace(
        /import ["'](\.[^"']*?)["']/g,
        (match, path) => {
          if (path.endsWith('.js') || path.endsWith('.json')) {
            return match; // Already has extension
          }
          return match.replace(path, path + '.js');
        }
      );
      
      await fs.writeFile(fullPath, content, 'utf-8');
    }
  }
}

await fixImports(distPath);
console.log('✅ Fixed import extensions in dist folder');