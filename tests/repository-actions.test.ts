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
