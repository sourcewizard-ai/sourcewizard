import * as path from "path";

// Extract the path normalization logic as a standalone function for testing
function normalizeTargetPath(target: string | undefined, workingDir: string, currentDir: string): string | undefined {
  if (!target) return undefined;

  // If target starts with //, it's already a repository-root-relative path
  if (target.startsWith("//")) {
    // Remove trailing slashes for consistency
    return target.replace(/\/+$/, "");
  }

  // If target contains a colon, it might be a target key - don't modify
  if (target.includes(":")) {
    return target;
  }

  // If target is an absolute path, don't modify
  if (path.isAbsolute(target)) {
    return target;
  }

  // Handle relative paths
  let cleanTarget = target;
  
  // Strip leading ./ if present
  if (cleanTarget.startsWith("./")) {
    cleanTarget = cleanTarget.substring(2);
  }

  // Get current directory relative to repo root
  const currentRelative = path.relative(workingDir, currentDir);
  
  let resolvedPath: string;
  
  // Handle special cases for current directory references
  if (cleanTarget === "" || cleanTarget === ".") {
    if (currentRelative === "") {
      // We're at repo root and target is current directory
      return "//";
    } else {
      // We're in subdirectory and target is current directory
      resolvedPath = currentRelative;
    }
  } else {
    // Handle normal relative paths
    if (currentRelative === "") {
      // We're at repo root
      resolvedPath = path.normalize(cleanTarget);
    } else {
      // We're in a subdirectory
      resolvedPath = path.normalize(path.join(currentRelative, cleanTarget));
    }
  }

  // Handle cases where path goes above repo root
  if (resolvedPath.startsWith("..")) {
    throw new Error(`Target path "${target}" resolves outside of repository root`);
  }

  // Convert to repository-root-relative format
  const normalized = resolvedPath === "." ? "//" : `//${resolvedPath}`;
  return normalized.replace(/\/+$/, ""); // Remove trailing slashes
}

describe("Path Normalization", () => {
  const mockRepoRoot = "/home/user/repo";

  describe("relative path resolution", () => {
    test("should handle ./ prefix correctly from repo root", () => {
      const result = normalizeTargetPath("./frontend", mockRepoRoot, mockRepoRoot);
      expect(result).toBe("//frontend");
    });

    test("should handle ./ prefix from subdirectory", () => {
      const currentDir = path.join(mockRepoRoot, "backend");
      const result = normalizeTargetPath("./src", mockRepoRoot, currentDir);
      expect(result).toBe("//backend/src");
    });

    test("should handle ../ prefix correctly", () => {
      const currentDir = path.join(mockRepoRoot, "backend");
      const result = normalizeTargetPath("../frontend", mockRepoRoot, currentDir);
      expect(result).toBe("//frontend");
    });

    test("should handle complex relative paths with ../", () => {
      const currentDir = path.join(mockRepoRoot, "backend", "src");
      const result = normalizeTargetPath("../../frontend/src", mockRepoRoot, currentDir);
      expect(result).toBe("//frontend/src");
    });

    test("should handle current directory (.) correctly from repo root", () => {
      const result = normalizeTargetPath(".", mockRepoRoot, mockRepoRoot);
      expect(result).toBe("//");
    });

    test("should handle current directory (./) correctly from repo root", () => {
      const result = normalizeTargetPath("./", mockRepoRoot, mockRepoRoot);
      expect(result).toBe("//");
    });

    test("should handle current directory from subdirectory", () => {
      const currentDir = path.join(mockRepoRoot, "frontend");
      const result = normalizeTargetPath(".", mockRepoRoot, currentDir);
      expect(result).toBe("//frontend");
    });

    test("should throw error when path goes outside repo", () => {
      expect(() => {
        normalizeTargetPath("../../outside", mockRepoRoot, mockRepoRoot);
      }).toThrow("Target path \"../../outside\" resolves outside of repository root");
    });

    test("should not modify paths that already start with //", () => {
      const result = normalizeTargetPath("//frontend/src", mockRepoRoot, mockRepoRoot);
      expect(result).toBe("//frontend/src");
    });

    test("should not modify target keys with colons", () => {
      const result = normalizeTargetPath("frontend:app", mockRepoRoot, mockRepoRoot);
      expect(result).toBe("frontend:app");
    });

    test("should not modify absolute paths", () => {
      const result = normalizeTargetPath("/absolute/path", mockRepoRoot, mockRepoRoot);
      expect(result).toBe("/absolute/path");
    });

    test("should handle empty string target", () => {
      const result = normalizeTargetPath("", mockRepoRoot, mockRepoRoot);
      expect(result).toBeUndefined();
    });

    test("should handle undefined target", () => {
      const result = normalizeTargetPath(undefined, mockRepoRoot, mockRepoRoot);
      expect(result).toBeUndefined();
    });
  });

  describe("path normalization edge cases", () => {
    test("should remove trailing slashes", () => {
      const result = normalizeTargetPath("./frontend/", mockRepoRoot, mockRepoRoot);
      expect(result).toBe("//frontend");
    });

    test("should handle multiple trailing slashes", () => {
      const result = normalizeTargetPath("//frontend///", mockRepoRoot, mockRepoRoot);
      expect(result).toBe("//frontend");
    });

    test("should handle paths with redundant segments", () => {
      const currentDir = path.join(mockRepoRoot, "backend");
      const result = normalizeTargetPath("./src/../lib", mockRepoRoot, currentDir);
      expect(result).toBe("//backend/lib");
    });

    test("should handle simple relative paths without prefix", () => {
      const result = normalizeTargetPath("frontend", mockRepoRoot, mockRepoRoot);
      expect(result).toBe("//frontend");
    });

    test("should handle nested relative paths without prefix", () => {
      const currentDir = path.join(mockRepoRoot, "backend");
      const result = normalizeTargetPath("src/utils", mockRepoRoot, currentDir);
      expect(result).toBe("//backend/src/utils");
    });

    test("should handle going up and down directories", () => {
      const currentDir = path.join(mockRepoRoot, "backend", "src");
      const result = normalizeTargetPath("../lib/utils", mockRepoRoot, currentDir);
      expect(result).toBe("//backend/lib/utils");
    });

    test("should handle complex directory navigation", () => {
      const currentDir = path.join(mockRepoRoot, "apps", "web", "src");
      const result = normalizeTargetPath("../../api/src", mockRepoRoot, currentDir);
      expect(result).toBe("//apps/api/src");
    });
  });
});