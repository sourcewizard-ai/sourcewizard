import { promises as fs, Dirent } from "fs";
import * as path from "path";
import { Target, PackageDetector } from "../package.js";

async function detectPythonFramework(currentPath: string): Promise<string | undefined> {
  try {
    // Check for Django
    const entries = await fs.readdir(currentPath);
    if (entries.includes('manage.py') || entries.includes('settings.py')) {
      return "django";
    }
    
    // Check for Flask in requirements.txt or setup.py
    for (const configFile of ['requirements.txt', 'setup.py', 'pyproject.toml']) {
      try {
        const content = await fs.readFile(path.join(currentPath, configFile), 'utf-8');
        if (content.toLowerCase().includes('flask')) return "flask";
        if (content.toLowerCase().includes('fastapi')) return "fastapi";
        if (content.toLowerCase().includes('streamlit')) return "streamlit";
      } catch {}
    }
  } catch {}
  
  return undefined;
}

async function extractProjectName(currentPath: string): Promise<string> {
  // Try pyproject.toml first
  try {
    const pyprojectPath = path.join(currentPath, 'pyproject.toml');
    const content = await fs.readFile(pyprojectPath, 'utf-8');
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    if (nameMatch) return nameMatch[1];
  } catch {}
  
  // Try setup.py
  try {
    const setupPath = path.join(currentPath, 'setup.py');
    const content = await fs.readFile(setupPath, 'utf-8');
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    if (nameMatch) return nameMatch[1];
  } catch {}
  
  // Default to directory name
  return path.basename(currentPath);
}

function detectPackageManager(entries: Dirent[]): string {
  if (entries.some(e => e.name === 'poetry.lock')) return "poetry";
  if (entries.some(e => e.name === 'Pipfile')) return "pipenv";
  if (entries.some(e => e.name === 'conda.yaml' || e.name === 'environment.yml')) return "conda";
  return "pip";
}

export const pythonDetector: PackageDetector = {
  name: "Python",
  language: "python", 
  configFiles: ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile", "conda.yaml", "environment.yml"],
  
  async detect(currentPath: string, repoRoot: string, entries: Dirent[]): Promise<Target[]> {
    const pythonFiles = this.configFiles.filter(file =>
      entries.some(e => e.name === file && e.isFile())
    );

    if (pythonFiles.length === 0) return [];

    try {
      const relativePath = path.relative(repoRoot, currentPath);
      const normalizedPath = relativePath === "" ? "//" : `//${relativePath}`;
      const targetName = await extractProjectName(currentPath);

      return [{
        id: `${normalizedPath}:${targetName}`,
        name: targetName,
        path: normalizedPath,
        language: "python",
        packageManager: detectPackageManager(entries),
        framework: await detectPythonFramework(currentPath)
      }];
    } catch {
      return [];
    }
  },

  async generateCommands(target: Target, actionType: "build" | "dev" | "check" | "lint" | "test" | "add-package" | "remove-package", workingDir: string, additionalArgs: string[] = []): Promise<string[]> {
    const commands: string[] = [];
    const packageManager = target.packageManager || "pip";

    switch (actionType) {
      case "build":
        if (packageManager === "poetry") {
          commands.push("poetry build");
        } else {
          commands.push("python -m build");
        }
        break;
      case "dev":
        if (target.framework === "django") {
          commands.push("python manage.py runserver");
        } else if (target.framework === "flask") {
          commands.push("flask run");
        } else if (target.framework === "fastapi") {
          commands.push("uvicorn main:app --reload");
        } else {
          commands.push("python main.py");
        }
        break;
      case "check":
        commands.push("python -m flake8");
        commands.push("python -m mypy .");
        break;
      case "lint":
        commands.push("python -m flake8");
        commands.push("python -m mypy .");
        break;
      case "test":
        commands.push("python -m pytest");
        break;
      case "add-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for add-package action");
        }

        const packageName = additionalArgs[0];
        const isDevDependency = additionalArgs.includes("--dev");
        const otherArgs = additionalArgs.slice(1).filter(arg => arg !== "--dev");

        if (packageManager === "poetry") {
          let command = `poetry add ${packageName}`;
          if (isDevDependency) command += " -D";
          if (otherArgs.length > 0) command += ` ${otherArgs.join(" ")}`;
          commands.push(command);
        } else if (packageManager === "pipenv") {
          let command = `pipenv install ${packageName}`;
          if (isDevDependency) command += " --dev";
          if (otherArgs.length > 0) command += ` ${otherArgs.join(" ")}`;
          commands.push(command);
        } else {
          // pip
          let command = `pip install ${packageName}`;
          if (otherArgs.length > 0) command += ` ${otherArgs.join(" ")}`;
          commands.push(command);
        }
        break;
      case "remove-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for remove-package action");
        }

        const removePackageName = additionalArgs[0];
        const removeOtherArgs = additionalArgs.slice(1);

        if (packageManager === "poetry") {
          let command = `poetry remove ${removePackageName}`;
          if (removeOtherArgs.length > 0) command += ` ${removeOtherArgs.join(" ")}`;
          commands.push(command);
        } else if (packageManager === "pipenv") {
          let command = `pipenv uninstall ${removePackageName}`;
          if (removeOtherArgs.length > 0) command += ` ${removeOtherArgs.join(" ")}`;
          commands.push(command);
        } else {
          // pip
          let command = `pip uninstall ${removePackageName}`;
          if (removeOtherArgs.length > 0) command += ` ${removeOtherArgs.join(" ")}`;
          commands.push(command);
        }
        break;
    }

    return commands;
  }
};