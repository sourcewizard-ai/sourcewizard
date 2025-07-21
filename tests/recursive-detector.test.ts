import { detectRepo } from "../src/shared/install-agent/repository-detector";
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

describe("Recursive Repository Detection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should recursively detect multiple packages in monorepo", async () => {
    // Mock file system structure for a monorepo with multiple packages
    const mockStructure = {
      "/test/repo": {
        ".gitignore": "node_modules\n.cache\n*.log",
        "package.json": {
          name: "monorepo-root",
          scripts: { "build:all": "lerna run build" },
        },
      },
      "/test/repo/packages/frontend": {
        "package.json": {
          name: "frontend-app",
          scripts: {
            build: "webpack build",
            test: "jest",
            dev: "webpack serve",
          },
          dependencies: { react: "^18.0.0" },
        },
      },
      "/test/repo/packages/backend": {
        "package.json": {
          name: "backend-api",
          scripts: { build: "tsc", test: "jest", start: "node dist/index.js" },
        },
      },
      "/test/repo/services/auth": {
        "go.mod":
          "module github.com/example/auth\n\ngo 1.19\n\nrequire github.com/gin-gonic/gin v1.9.0",
      },
      "/test/repo/libs/shared": {
        "Cargo.toml":
          '[package]\nname = "shared"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1.0"',
      },
    };

    // Mock fs.readdir to return directory structure
    mockFs.readdir.mockImplementation((dirPath: any) => {
      const path = dirPath.toString();
      if (path === "/test/repo") {
        return Promise.resolve([
          { name: ".gitignore", isDirectory: () => false },
          { name: "package.json", isDirectory: () => false },
          { name: "packages", isDirectory: () => true },
          { name: "services", isDirectory: () => true },
          { name: "libs", isDirectory: () => true },
          { name: "node_modules", isDirectory: () => true }, // Should be ignored
        ] as any);
      } else if (path === "/test/repo/packages") {
        return Promise.resolve([
          { name: "frontend", isDirectory: () => true },
          { name: "backend", isDirectory: () => true },
        ] as any);
      } else if (path === "/test/repo/services") {
        return Promise.resolve([
          { name: "auth", isDirectory: () => true },
        ] as any);
      } else if (path === "/test/repo/libs") {
        return Promise.resolve([
          { name: "shared", isDirectory: () => true },
        ] as any);
      } else if (path === "/test/repo/node_modules") {
        return Promise.reject(new Error("Should not scan node_modules"));
      }
      return Promise.resolve([] as any);
    });

    // Mock fs.access to indicate file existence
    mockFs.access.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();

      // Check if the file exists in our mock structure
      for (const [dirPath, files] of Object.entries(mockStructure)) {
        for (const fileName of Object.keys(files)) {
          if (pathStr === path.join(dirPath, fileName)) {
            return Promise.resolve();
          }
        }
      }

      return Promise.reject(new Error(`File not found: ${pathStr}`));
    });

    // Mock fs.readFile to return file contents
    mockFs.readFile.mockImplementation((filePath: any, encoding: any) => {
      const pathStr = filePath.toString();

      for (const [dirPath, files] of Object.entries(mockStructure)) {
        for (const [fileName, content] of Object.entries(files)) {
          if (pathStr === path.join(dirPath, fileName)) {
            return Promise.resolve(
              typeof content === "string" ? content : JSON.stringify(content)
            );
          }
        }
      }

      return Promise.reject(new Error("File not found"));
    });

    const result = await detectRepo("/test/repo");

    // Should detect the root as the directory name (not package name)
    expect(result.name).toBe("repo");

    // Should detect multiple targets
    expect(result.targets).toBeDefined();
    expect(Object.keys(result.targets!).length).toBeGreaterThanOrEqual(2); // At least frontend and backend

    // Check frontend target
    const frontendTarget = Object.values(result.targets!).find(
      (target) => target.name === "frontend-app"
    );
    expect(frontendTarget).toBeDefined();
    expect(frontendTarget!.path).toBe("packages/frontend");
    expect(frontendTarget!.language).toBe("javascript");
    expect(frontendTarget!.dependency_files).toBeDefined();
    expect(frontendTarget!.env_files).toBeDefined();

    // Check backend target
    const backendTarget = Object.values(result.targets!).find(
      (target) => target.name === "backend-api"
    );
    expect(backendTarget).toBeDefined();
    expect(backendTarget!.path).toBe("packages/backend");

    // Check Go service
    const authTarget = Object.values(result.targets!).find(
      (target) => target.name === "auth"
    );
    expect(authTarget).toBeDefined();
    expect(authTarget!.path).toBe("services/auth");
    expect(authTarget!.language).toBe("go");

    // Check Rust library
    const sharedTarget = Object.values(result.targets!).find(
      (target) => target.name === "shared"
    );
    expect(sharedTarget).toBeDefined();
    expect(sharedTarget!.path).toBe("libs/shared");
    expect(sharedTarget!.language).toBe("rust");

    // Check that actions are generated for all packages
    expect(result.actions.build.length).toBeGreaterThan(1);
    expect(result.actions.test.length).toBeGreaterThan(1);
    expect(result.actions.install.length).toBeGreaterThan(1);

    // Verify different scopes are present
    const scopes = result.actions.build.map((action) => action.scope);
    expect(scopes).toContain("root");
    expect(scopes).toContain("packages/frontend");
    expect(scopes).toContain("services/auth");
  });

  test("should respect gitignore patterns", async () => {
    // Mock a repository with .gitignore
    mockFs.readdir.mockImplementation((dirPath: any) => {
      const path = dirPath.toString();
      if (path === "/test/repo") {
        return Promise.resolve([
          { name: ".gitignore", isDirectory: () => false },
          { name: "package.json", isDirectory: () => false },
          { name: "src", isDirectory: () => true },
          { name: "build", isDirectory: () => true }, // Should be ignored
          { name: "node_modules", isDirectory: () => true }, // Should be ignored
        ] as any);
      } else if (path === "/test/repo/src") {
        return Promise.resolve([
          { name: "package.json", isDirectory: () => false },
        ] as any);
      }
      return Promise.resolve([] as any);
    });

    mockFs.readFile.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr.endsWith(".gitignore")) {
        return Promise.resolve("build/\nnode_modules/\n*.log");
      } else if (pathStr.endsWith("package.json")) {
        return Promise.resolve(JSON.stringify({ name: "test-app" }));
      }
      return Promise.reject(new Error("File not found"));
    });

    mockFs.access.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      return pathStr.includes("build") || pathStr.includes("node_modules")
        ? Promise.reject(new Error("Should not access ignored paths"))
        : Promise.resolve();
    });

    const result = await detectRepo("/test/repo");

    expect(result.name).toBe("repo");
    // Should include root package as a target now
    expect(Object.keys(result.targets || {}).length).toBeGreaterThanOrEqual(1);
  });

  test("should detect Python packages with different config files", async () => {
    mockFs.readdir.mockImplementation((dirPath: any) => {
      const path = dirPath.toString();
      if (path === "/test/repo") {
        return Promise.resolve([
          { name: "api", isDirectory: () => true },
          { name: "cli", isDirectory: () => true },
        ] as any);
      } else if (path === "/test/repo/api") {
        return Promise.resolve([
          { name: "requirements.txt", isDirectory: () => false },
          { name: "setup.py", isDirectory: () => false },
        ] as any);
      } else if (path === "/test/repo/cli") {
        return Promise.resolve([
          { name: "pyproject.toml", isDirectory: () => false },
        ] as any);
      }
      return Promise.resolve([] as any);
    });

    mockFs.access.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      // Only allow access to Python files
      if (
        pathStr.includes("requirements.txt") ||
        pathStr.includes("setup.py") ||
        pathStr.includes("pyproject.toml")
      ) {
        return Promise.resolve();
      }
      return Promise.reject(new Error("File not found"));
    });

    mockFs.readFile.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr.includes("requirements.txt")) {
        return Promise.resolve("flask==2.0.0\nrequests>=2.25.0");
      } else if (pathStr.includes("setup.py")) {
        return Promise.resolve('setup(name="api-service", version="1.0.0")');
      } else if (pathStr.includes("pyproject.toml")) {
        return Promise.resolve(
          '[project]\nname = "cli-tool"\nversion = "0.1.0"'
        );
      }
      return Promise.reject(new Error("File not found"));
    });

    const result = await detectRepo("/test/repo");

    expect(result.targets).toBeDefined();
    expect(Object.keys(result.targets!).length).toBeGreaterThanOrEqual(2);

    const apiTarget = Object.values(result.targets!).find(
      (target) => target.name === "api-service"
    );
    expect(apiTarget).toBeDefined();
    expect(apiTarget!.language).toBe("python");

    const cliTarget = Object.values(result.targets!).find(
      (target) => target.name === "cli-tool"
    );
    expect(cliTarget).toBeDefined();
    expect(cliTarget!.language).toBe("python");

    // Should have Python-specific actions
    const pythonActions = result.actions.test.filter((action) =>
      action.command.includes("pytest")
    );
    expect(pythonActions.length).toBeGreaterThan(0);
  });

  test("should handle deeply nested packages", async () => {
    mockFs.readdir.mockImplementation((dirPath: any) => {
      const path = dirPath.toString();
      if (path === "/test/repo") {
        return Promise.resolve([
          { name: "projects", isDirectory: () => true },
        ] as any);
      } else if (path === "/test/repo/projects") {
        return Promise.resolve([
          { name: "team-a", isDirectory: () => true },
        ] as any);
      } else if (path === "/test/repo/projects/team-a") {
        return Promise.resolve([
          { name: "microservice", isDirectory: () => true },
        ] as any);
      } else if (path === "/test/repo/projects/team-a/microservice") {
        return Promise.resolve([
          { name: "go.mod", isDirectory: () => false },
        ] as any);
      }
      return Promise.resolve([] as any);
    });

    mockFs.access.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      // Only allow access to go.mod files
      if (pathStr.includes("go.mod")) {
        return Promise.resolve();
      }
      return Promise.reject(new Error("File not found"));
    });

    mockFs.readFile.mockImplementation((filePath: any) => {
      const pathStr = filePath.toString();
      if (pathStr.includes("go.mod")) {
        return Promise.resolve("module example.com/microservice\n\ngo 1.19");
      }
      return Promise.reject(new Error("File not found"));
    });

    const result = await detectRepo("/test/repo");

    expect(result.targets).toBeDefined();
    expect(Object.keys(result.targets!).length).toBeGreaterThanOrEqual(1);

    // Find the Go microservice target
    const goTargets = Object.values(result.targets!).filter(
      (target) => target.language === "go"
    );
    expect(goTargets.length).toBeGreaterThan(0);

    const microserviceTarget = goTargets.find((target) =>
      target.path.includes("microservice")
    );
    expect(microserviceTarget).toBeDefined();
    expect(microserviceTarget!.name).toBe("microservice");
    expect(microserviceTarget!.language).toBe("go");
  });
});
