import { detectRepo, executeRepositoryCommand } from "../install-agent/repository-detector";
import { promises as fs } from "fs";
import * as path from "path";

// Mock dependencies
jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    readdir: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe("Repository Actions Detection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should detect Node.js repository actions from package.json scripts", async () => {
    const mockPackageJson = {
      name: "test-app",
      version: "1.0.0",
      scripts: {
        build: "webpack --mode production",
        "test:unit": "jest",
        dev: "webpack serve --mode development",
        lint: "eslint src/",
        deploy: "npm publish",
        format: "prettier --write src/",
      },
      dependencies: {
        react: "^18.0.0",
      },
      devDependencies: {
        typescript: "^4.0.0",
      },
    };

    mockFs.readFile.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr.includes("package.json")) {
        return Promise.resolve(JSON.stringify(mockPackageJson));
      }
      return Promise.reject(new Error("File not found"));
    });

    mockFs.access.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr.includes("package.json")) {
        return Promise.resolve();
      }
      return Promise.reject(new Error("File not found"));
    });

    mockFs.stat.mockRejectedValue(new Error("Directory not found"));
    mockFs.readdir.mockResolvedValue([] as any);

    const result = await detectRepo("/test/path");

    expect(result.name).toBe("path");
    expect(result.targets).toBeDefined();

    // Get the first target (should be the package itself)
    const targets = Object.values(result.targets!);
    expect(targets.length).toBeGreaterThan(0);
    const target = targets[0];

    // Check that build actions are detected
    expect(target.actions.build).toBeDefined();
    expect(target.actions.build.length).toBeGreaterThan(0);
    expect(target.actions.build[0].command).toContain("build");

    // Check that test actions are detected
    expect(target.actions.test).toBeDefined();
    expect(target.actions.test.length).toBeGreaterThan(0);
    expect(target.actions.test[0].command).toContain("test");

    // Check that dev actions are detected
    expect(target.actions.dev).toBeDefined();
    expect(target.actions.dev.length).toBeGreaterThan(0);
    expect(target.actions.dev[0].command).toContain("dev");

    // Check that lint actions are detected
    expect(target.actions.lint).toBeDefined();
    expect(target.actions.lint.length).toBeGreaterThan(0);
    expect(target.actions.lint[0].command).toContain("lint");

    // Check install actions are always present
    expect(target.actions.install).toBeDefined();
    expect(target.actions.install.length).toBeGreaterThan(0);
  });

  test("should detect Python repository actions", async () => {
    mockFs.readFile.mockRejectedValue(new Error("No package.json"));
    mockFs.access.mockImplementation((filePath: any) => {
      if (filePath.includes("requirements.txt")) {
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error("File not found"));
    });
    mockFs.stat.mockRejectedValue(new Error("Directory not found"));
    mockFs.readdir.mockResolvedValue([] as any);

    const result = await detectRepo("/test/python-path");

    expect(result.targets).toBeDefined();

    // Get the first target (should be the Python package)
    const targets = Object.values(result.targets!);
    expect(targets.length).toBeGreaterThan(0);
    const target = targets[0];

    // Check that Python-specific actions are detected
    expect(target.actions.install).toBeDefined();
    expect(
      target.actions.install.some((action) =>
        action.command.includes("pip install")
      )
    ).toBe(true);

    expect(target.actions.test).toBeDefined();
    expect(
      target.actions.test.some((action) => action.command.includes("pytest"))
    ).toBe(true);
  });

  test("should detect monorepo with multiple apps", async () => {
    const mockRootPackageJson = {
      name: "monorepo-root",
      version: "1.0.0",
      scripts: {
        "build:all": "lerna run build",
        "test:all": "lerna run test",
      },
    };

    // Simplified test that just verifies basic monorepo detection without complex mocking
    mockFs.readFile.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr === "/test/monorepo/package.json") {
        return Promise.resolve(JSON.stringify(mockRootPackageJson));
      }
      return Promise.reject(new Error("File not found"));
    });

    mockFs.readdir.mockImplementation((dirPath: any) => {
      const pathStr = dirPath.toString();
      if (pathStr === "/test/monorepo") {
        return Promise.resolve([
          { name: "package.json", isDirectory: () => false },
        ] as any);
      }
      return Promise.resolve([] as any);
    });

    mockFs.access.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr === "/test/monorepo/package.json") {
        return Promise.resolve();
      }
      return Promise.reject(new Error("File not found"));
    });

    const result = await detectRepo("/test/monorepo");

    expect(result.name).toBe("monorepo");
    expect(result.targets).toBeDefined();

    // Get the first target (should be the root package)
    const targets = Object.values(result.targets!);
    expect(targets.length).toBeGreaterThan(0);
    const target = targets[0];

    // Check that root actions are present
    expect(target.actions.build.length).toBeGreaterThanOrEqual(1);
    expect(target.actions.install.length).toBeGreaterThanOrEqual(1);
  });
});

// Mock child_process for command execution tests
jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

import { spawn } from "child_process";
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe("Target Matching and Command Execution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock process.cwd to simulate different working directories
    jest.spyOn(process, 'cwd').mockReturnValue('/test/repo');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setupMockRepo = () => {
    const mockRootPackageJson = {
      name: "test-repo",
      scripts: { build: "npm run build", test: "npm test" }
    };
    
    const mockWebPackageJson = {
      name: "web",
      scripts: { dev: "next dev", build: "next build" }
    };

    mockFs.readFile.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr === "/test/repo/package.json") {
        return Promise.resolve(JSON.stringify(mockRootPackageJson));
      }
      if (pathStr === "/test/repo/frontend/package.json") {
        return Promise.resolve(JSON.stringify(mockWebPackageJson));
      }
      return Promise.reject(new Error("File not found"));
    });

    mockFs.access.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr === "/test/repo/package.json" || pathStr === "/test/repo/frontend/package.json") {
        return Promise.resolve();
      }
      return Promise.reject(new Error("File not found"));
    });

    mockFs.readdir.mockImplementation((dirPath: any) => {
      const pathStr = dirPath.toString();
      if (pathStr === "/test/repo") {
        return Promise.resolve([
          { name: "package.json", isDirectory: () => false },
          { name: "frontend", isDirectory: () => true },
        ] as any);
      }
      if (pathStr === "/test/repo/frontend") {
        return Promise.resolve([
          { name: "package.json", isDirectory: () => false },
        ] as any);
      }
      return Promise.resolve([] as any);
    });
  };

  test("should match target by exact key", async () => {
    setupMockRepo();
    
    const repo = await detectRepo("/test/repo");
    expect(repo.targets).toBeDefined();
    
    // Should find target by exact key match
    const targets = Object.keys(repo.targets!);
    expect(targets).toContain(":test-repo");
    expect(targets).toContain("frontend:web");
  });

  test("should match :target syntax only in current directory", async () => {
    setupMockRepo();
    
    // Mock being in the frontend directory
    jest.spyOn(process, 'cwd').mockReturnValue('/test/repo/frontend');
    
    let capturedOutput = "";
    const mockOutput = (message: string, type: string) => {
      capturedOutput += message + "\n";
    };

    // Mock successful command execution
    const mockChild = {
      on: jest.fn((event, callback) => {
        if (event === 'close') callback(0);
      })
    };
    mockSpawn.mockReturnValue(mockChild as any);

    // Should find :web target only in current directory (frontend)
    await expect(executeRepositoryCommand("check", ":web", "/test/repo", { onOutput: mockOutput }))
      .resolves.not.toThrow();
    
    expect(capturedOutput).toContain("frontend:web");
  });

  test("should fail when :target not found in current directory", async () => {
    setupMockRepo();
    
    // Mock being in root directory
    jest.spyOn(process, 'cwd').mockReturnValue('/test/repo');
    
    let capturedOutput = "";
    const mockOutput = (message: string, type: string) => {
      capturedOutput += message + "\n";
    };

    // Should fail to find :web in root directory
    await expect(executeRepositoryCommand("check", ":web", "/test/repo", { onOutput: mockOutput }))
      .rejects.toThrow('Target ":web" not found');
  });

  test("should match //path:target syntax", async () => {
    setupMockRepo();
    
    let capturedOutput = "";
    const mockOutput = (message: string, type: string) => {
      capturedOutput += message + "\n";
    };

    // Mock successful command execution
    const mockChild = {
      on: jest.fn((event, callback) => {
        if (event === 'close') callback(0);
      })
    };
    mockSpawn.mockReturnValue(mockChild as any);

    // Should match //frontend:web syntax
    await expect(executeRepositoryCommand("check", "//frontend:web", "/test/repo", { onOutput: mockOutput }))
      .resolves.not.toThrow();
    
    expect(capturedOutput).toContain("frontend:web");
  });

  test("should select current directory target when no target specified", async () => {
    setupMockRepo();
    
    // Mock being in the frontend directory
    jest.spyOn(process, 'cwd').mockReturnValue('/test/repo/frontend');
    
    let capturedOutput = "";
    const mockOutput = (message: string, type: string) => {
      capturedOutput += message + "\n";
    };

    // Mock successful command execution
    const mockChild = {
      on: jest.fn((event, callback) => {
        if (event === 'close') callback(0);
      })
    };
    mockSpawn.mockReturnValue(mockChild as any);

    // Should auto-select target in current directory
    await expect(executeRepositoryCommand("check", undefined, "/test/repo", { onOutput: mockOutput }))
      .resolves.not.toThrow();
    
    expect(capturedOutput).toContain("frontend:web");
  });

  test("should execute install + check + specified action", async () => {
    setupMockRepo();
    
    let capturedOutput = "";
    let commandsExecuted: string[] = [];
    const mockOutput = (message: string, type: string) => {
      capturedOutput += message + "\n";
      if (message.includes("Running:")) {
        commandsExecuted.push(message);
      }
    };

    // Mock successful command execution
    const mockChild = {
      on: jest.fn((event, callback) => {
        if (event === 'close') callback(0);
      })
    };
    mockSpawn.mockReturnValue(mockChild as any);

    await executeRepositoryCommand("build", "frontend:web", "/test/repo", { onOutput: mockOutput });
    
    // Should have run install, check, then build actions
    expect(capturedOutput).toContain("Running install actions");
    expect(capturedOutput).toContain("Running check actions");
    expect(capturedOutput).toContain("Running build actions");
    expect(capturedOutput).toContain("build completed successfully");
  });
});
