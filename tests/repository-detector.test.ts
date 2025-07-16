import { detectRepo } from "../src/shared/repository-detector";
import { promises as fs } from "fs";
import path from "path";

// Mock dependencies
jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    access: jest.fn(),
  },
}));

jest.mock("path", () => ({
  ...jest.requireActual("path"),
  join: jest.fn(),
  basename: jest.fn(),
  extname: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe("Repository Detector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockPath.basename.mockImplementation((p) => p.split("/").pop() || "");
    mockPath.extname.mockImplementation((p) => {
      const parts = p.split(".");
      return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
    });

    // Mock process.cwd()
    jest.spyOn(process, "cwd").mockReturnValue("/test/project");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Node.js/JavaScript/TypeScript Detection", () => {
    it("should detect a basic JavaScript Node.js project", async () => {
      const packageJson = {
        name: "test-project",
        version: "1.0.0",
        dependencies: {
          express: "^4.18.0",
        },
        scripts: {
          start: "node index.js",
        },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(packageJson));
      mockFs.access.mockImplementation((filePath) => {
        if (filePath.toString().includes("package-lock.json")) {
          return Promise.resolve();
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const result = await detectRepo();

      expect(result).toEqual({
        name: "test-project",
        version: "1.0.0",
        packageManager: "npm",
        language: "javascript",
        dependencies: { express: "^4.18.0" },
        devDependencies: {},
        scripts: { start: "node index.js" },
        projectType: "web",
        framework: "express",
      });
    });

    it("should detect a TypeScript project with tsconfig.json", async () => {
      const packageJson = {
        name: "ts-project",
        version: "2.0.0",
        dependencies: {
          react: "^18.0.0",
          "react-dom": "^18.0.0",
        },
        devDependencies: {
          typescript: "^5.0.0",
          "@types/react": "^18.0.0",
        },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(packageJson));
      mockFs.access.mockImplementation((filePath) => {
        if (filePath.toString().includes("yarn.lock")) {
          return Promise.resolve();
        }
        return Promise.reject(new Error("ENOENT"));
      });

      // Mock require for tsconfig.json check
      const originalRequire = require;
      (global as any).require = jest.fn().mockImplementation((id) => {
        if (id === "fs") {
          return {
            accessSync: jest.fn().mockImplementation((path) => {
              if (path.includes("tsconfig.json")) {
                return true;
              }
              throw new Error("ENOENT");
            }),
          };
        }
        return originalRequire(id);
      });

      const result = await detectRepo();

      expect(result).toEqual({
        name: "ts-project",
        version: "2.0.0",
        packageManager: "yarn",
        language: "typescript",
        dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" },
        devDependencies: { typescript: "^5.0.0", "@types/react": "^18.0.0" },
        scripts: {},
        projectType: "web",
        framework: "react",
      });

      (global as any).require = originalRequire;
    });

    it("should detect CLI project type", async () => {
      const packageJson = {
        name: "cli-tool",
        version: "1.0.0",
        bin: {
          "cli-tool": "./bin/cli.js",
        },
        dependencies: {
          commander: "^9.0.0",
        },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(packageJson));
      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      const result = await detectRepo();

      expect(result.projectType).toBe("cli");
      expect(result.name).toBe("cli-tool");
    });

    it("should detect various frameworks", async () => {
      const frameworks = [
        { deps: { vue: "^3.0.0" }, expected: "vue" },
        { deps: { angular: "^15.0.0" }, expected: "angular" },
        { deps: { svelte: "^3.0.0" }, expected: "svelte" },
        { deps: { next: "^13.0.0" }, expected: "next" },
        { deps: { gatsby: "^4.0.0" }, expected: "gatsby" },
        { deps: { fastify: "^4.0.0" }, expected: "fastify" },
        { deps: { koa: "^2.0.0" }, expected: "koa" },
      ];

      for (const { deps, expected } of frameworks) {
        const packageJson = {
          name: "test-project",
          version: "1.0.0",
          dependencies: deps,
        };

        mockFs.readFile.mockResolvedValue(JSON.stringify(packageJson));
        mockFs.access.mockRejectedValue(new Error("ENOENT"));

        const result = await detectRepo();
        expect(result.framework).toBe(expected);
      }
    });
  });

  describe("Python Project Detection", () => {
    it("should detect Python project with requirements.txt", async () => {
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes("package.json")) {
          return Promise.reject(new Error("ENOENT"));
        }
        if (filePath.toString().includes("requirements.txt")) {
          return Promise.resolve(
            "django>=4.0.0\nflask>=2.0.0\nrequests>=2.25.0"
          );
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockFs.access.mockImplementation((filePath) => {
        if (filePath.toString().includes("requirements.txt")) {
          return Promise.resolve();
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockPath.basename.mockReturnValue("python-web-app");

      const result = await detectRepo();

      expect(result.language).toBe("python");
      expect(result.projectType).toBe("web");
      expect(result.framework).toBe("django");
      expect(result.dependencies).toEqual({
        django: ">=4.0.0",
        flask: ">=2.0.0",
        requests: ">=2.25.0",
      });
    });

    it("should detect Python project with setup.py", async () => {
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes("package.json")) {
          return Promise.reject(new Error("ENOENT"));
        }
        if (filePath.toString().includes("setup.py")) {
          return Promise.resolve(`
from setuptools import setup

setup(
    name="my-python-package",
    version="1.0.0",
    install_requires=[
        "fastapi>=0.68.0",
        "uvicorn>=0.15.0"
    ]
)
          `);
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockFs.access.mockImplementation((filePath) => {
        if (filePath.toString().includes("setup.py")) {
          return Promise.resolve();
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const result = await detectRepo();

      expect(result.language).toBe("python");
      expect(result.name).toBe("my-python-package");
    });
  });

  describe("Go Project Detection", () => {
    it("should detect Go project with go.mod", async () => {
      const goModContent = `
module github.com/user/awesome-go-project

go 1.19

require (
    github.com/gin-gonic/gin v1.9.0
    github.com/stretchr/testify v1.8.0
)
      `;

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes("package.json")) {
          return Promise.reject(new Error("ENOENT"));
        }
        if (filePath.toString().includes("go.mod")) {
          return Promise.resolve(goModContent);
        }
        if (filePath.toString().includes("main.go")) {
          return Promise.resolve(`
package main

import (
    "github.com/gin-gonic/gin"
)

func main() {
    r := gin.Default()
    r.GET("/", func(c *gin.Context) {
        c.JSON(200, gin.H{"message": "Hello World"})
    })
    r.Run()
}
          `);
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      const result = await detectRepo();

      expect(result.language).toBe("go");
      expect(result.name).toBe("awesome-go-project");
      expect(result.projectType).toBe("web");
      expect(result.dependencies).toEqual({
        "github.com/gin-gonic/gin": "v1.9.0",
        "github.com/stretchr/testify": "v1.8.0",
      });
    });
  });

  describe("Rust Project Detection", () => {
    it("should detect Rust project with Cargo.toml", async () => {
      const cargoTomlContent = `
[package]
name = "rust-cli-tool"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "rust-cli-tool"
path = "src/main.rs"

[dependencies]
clap = "4.0.0"
serde = { version = "1.0", features = ["derive"] }
      `;

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes("package.json")) {
          return Promise.reject(new Error("ENOENT"));
        }
        if (filePath.toString().includes("Cargo.toml")) {
          return Promise.resolve(cargoTomlContent);
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      const result = await detectRepo();

      expect(result.language).toBe("rust");
      expect(result.name).toBe("rust-cli-tool");
      expect(result.version).toBe("0.1.0");
      expect(result.projectType).toBe("cli");
      expect(result.dependencies).toEqual({
        clap: '"4.0.0"',
        serde: '{ version = "1.0", features = ["derive"] }',
      });
    });
  });

  describe("Java Project Detection", () => {
    it("should detect Maven project with pom.xml", async () => {
      const pomXmlContent = `
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>spring-boot-app</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
</project>
      `;

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes("package.json")) {
          return Promise.reject(new Error("ENOENT"));
        }
        if (filePath.toString().includes("pom.xml")) {
          return Promise.resolve(pomXmlContent);
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockFs.access.mockImplementation((filePath) => {
        if (filePath.toString().includes("pom.xml")) {
          return Promise.resolve();
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const result = await detectRepo();

      expect(result.language).toBe("java");
      expect(result.name).toBe("spring-boot-app");
      expect(result.framework).toBe("maven");
      expect(result.projectType).toBe("library");
    });

    it("should detect Gradle project", async () => {
      const buildGradleContent = `
plugins {
    id 'java'
    id 'application'
}

rootProject.name = 'gradle-app'

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
}
      `;

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes("package.json")) {
          return Promise.reject(new Error("ENOENT"));
        }
        if (filePath.toString().includes("build.gradle")) {
          return Promise.resolve(buildGradleContent);
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockFs.access.mockImplementation((filePath) => {
        if (filePath.toString().includes("build.gradle")) {
          return Promise.resolve();
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const result = await detectRepo();

      expect(result.language).toBe("java");
      expect(result.name).toBe("gradle-app");
      expect(result.framework).toBe("gradle");
    });
  });

  describe("PHP Project Detection", () => {
    it("should detect PHP project with composer.json", async () => {
      const composerJson = {
        name: "laravel/laravel-app",
        version: "1.0.0",
        require: {
          php: "^8.1",
          "laravel/framework": "^9.0",
        },
        "require-dev": {
          "phpunit/phpunit": "^9.0",
        },
      };

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes("package.json")) {
          return Promise.reject(new Error("ENOENT"));
        }
        if (filePath.toString().includes("composer.json")) {
          return Promise.resolve(JSON.stringify(composerJson));
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      const result = await detectRepo();

      expect(result.language).toBe("php");
      expect(result.name).toBe("laravel/laravel-app");
      expect(result.framework).toBe("laravel");
      expect(result.projectType).toBe("web");
      expect(result.dependencies).toEqual({
        php: "^8.1",
        "laravel/framework": "^9.0",
      });
      expect(result.devDependencies).toEqual({
        "phpunit/phpunit": "^9.0",
      });
    });
  });

  describe("Ruby Project Detection", () => {
    it("should detect Ruby on Rails project", async () => {
      const gemfileContent = `
source 'https://rubygems.org'
git_source(:github) { |repo| "https://github.com/#{repo}.git" }

ruby '3.1.0'

gem 'rails', '~> 7.0.0'
gem 'sqlite3', '~> 1.4'
gem 'puma', '~> 5.0'
      `;

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes("package.json")) {
          return Promise.reject(new Error("ENOENT"));
        }
        if (filePath.toString().includes("Gemfile")) {
          return Promise.resolve(gemfileContent);
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockFs.access.mockImplementation((filePath) => {
        if (filePath.toString().includes("Gemfile")) {
          return Promise.resolve();
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockPath.basename.mockReturnValue("rails-app");

      const result = await detectRepo();

      expect(result.language).toBe("ruby");
      expect(result.name).toBe("rails-app");
      expect(result.framework).toBe("rails");
      expect(result.projectType).toBe("web");
    });
  });

  describe("Package Manager Detection", () => {
    it("should detect different package managers based on lock files", async () => {
      const lockFileTests = [
        { file: "yarn.lock", expected: "yarn" },
        { file: "pnpm-lock.yaml", expected: "pnpm" },
        { file: "bun.lockb", expected: "bun" },
        { file: "package-lock.json", expected: "npm" },
      ];

      for (const { file, expected } of lockFileTests) {
        const packageJson = {
          name: "test-project",
          version: "1.0.0",
          dependencies: {},
        };

        mockFs.readFile.mockResolvedValue(JSON.stringify(packageJson));
        mockFs.access.mockImplementation((filePath) => {
          if (filePath.toString().includes(file)) {
            return Promise.resolve();
          }
          return Promise.reject(new Error("ENOENT"));
        });

        const result = await detectRepo();
        expect(result.packageManager).toBe(expected);
      }
    });

    it("should default to npm when no lock files are found", async () => {
      const packageJson = {
        name: "test-project",
        version: "1.0.0",
        dependencies: {},
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(packageJson));
      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      const result = await detectRepo();
      expect(result.packageManager).toBe("npm");
    });
  });

  describe("Error Handling", () => {
    it("should return default context when no project files are found", async () => {
      mockFs.readFile.mockRejectedValue(new Error("ENOENT"));
      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      const result = await detectRepo();

      expect(result).toEqual({
        name: "unknown",
        version: "1.0.0",
        packageManager: "npm",
        language: "unknown",
        dependencies: {},
        devDependencies: {},
        scripts: {},
        projectType: "other",
      });
    });

    it("should handle malformed package.json gracefully", async () => {
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes("package.json")) {
          return Promise.resolve("invalid json content");
        }
        return Promise.reject(new Error("ENOENT"));
      });
      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      const result = await detectRepo();

      expect(result.language).toBe("unknown");
      expect(result.projectType).toBe("other");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty package.json", async () => {
      mockFs.readFile.mockResolvedValue("{}");
      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      const result = await detectRepo();

      expect(result.name).toBe("unknown");
      expect(result.version).toBe("1.0.0");
      expect(result.language).toBe("javascript");
    });

    it("should prioritize first successful detector", async () => {
      // Setup both package.json and requirements.txt
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes("package.json")) {
          return Promise.resolve(
            JSON.stringify({
              name: "js-project",
              dependencies: { react: "^18.0.0" },
            })
          );
        }
        if (filePath.toString().includes("requirements.txt")) {
          return Promise.resolve("django>=4.0.0");
        }
        return Promise.reject(new Error("ENOENT"));
      });

      mockFs.access.mockImplementation((filePath) => {
        if (filePath.toString().includes("requirements.txt")) {
          return Promise.resolve();
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const result = await detectRepo();

      // Should detect as JavaScript since Node detector runs first
      expect(result.language).toBe("javascript");
      expect(result.name).toBe("js-project");
      expect(result.framework).toBe("react");
    });
  });
});
