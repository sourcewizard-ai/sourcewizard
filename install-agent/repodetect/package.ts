import { promises as fs, Dirent } from "fs";
import * as path from "path";

export type ActionType = "build" | "dev" | "check" | "lint" | "test" | "add-package" | "remove-package";

export interface Target {
  id: string; // e.g., "//frontend:webapp" or "//api:server"
  name: string;
  path: string;
  language: string;
  packageManager?: string;
  framework?: string;
}

export interface PackageDetector {
  name: string;
  language: string;
  configFiles: string[];
  detect(currentPath: string, repoRoot: string, entries: Dirent[]): Promise<Target[]>;
  generateCommands(target: Target, actionType: ActionType, workingDir: string, additionalArgs?: string[]): Promise<string[]>;
}

// Cache detectors to avoid reimporting them
let cachedDetectors: PackageDetector[] | null = null;

async function getDetectors(): Promise<PackageDetector[]> {
  if (!cachedDetectors) {
    cachedDetectors = await Promise.all([
      import("./package/javascript.js").then(m => m.javascriptDetector),
      import("./package/python.js").then(m => m.pythonDetector),
      import("./package/go.js").then(m => m.goDetector),
      import("./package/rust.js").then(m => m.rustDetector),
      import("./package/java.js").then(m => m.javaDetector),
      import("./package/ruby.js").then(m => m.rubyDetector),
      import("./package/php.js").then(m => m.phpDetector),
    ]);
  }
  return cachedDetectors;
}

export async function detectPackages(currentPath: string, repoRoot: string): Promise<Target[]> {
  const targets: Target[] = [];

  try {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const detectors = await getDetectors();

    // Try each detector
    for (const detector of detectors) {
      const detectorTargets = await detector.detect(currentPath, repoRoot, entries);
      if (detectorTargets.length > 0) {
        targets.push(...detectorTargets);
      }
    }

  } catch (error) {
    // Skip directories we can't read
  }

  return targets;
}

export async function findDetectorForTarget(target: Target): Promise<PackageDetector | null> {
  const detectors = await getDetectors();

  // Find detector by language
  return detectors.find(detector =>
    detector.language === target.language ||
    (detector.language === "javascript" && target.language === "typescript")
  ) || null;
}

export function shouldSkipDirectory(name: string): boolean {
  const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.nyc_output', 'target', '__pycache__', '.pytest_cache', 'vendor'];
  return skipDirs.includes(name) || name.startsWith('.');
}
