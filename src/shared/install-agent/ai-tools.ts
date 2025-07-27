import { promises as fs } from "fs";
import * as path from "path";
import { tool } from "ai";
import z from "zod";
import { getBulkTargetData, TargetInfo } from "./repository-detector";

/**
 * Create a read_file tool for AI agents
 * @param cwd Current working directory for relative path resolution
 */
export function createReadFileTool(cwd: string) {
  return tool({
    description: "Read the contents of a file",
    parameters: z.object({
      path: z
        .string()
        .describe("The path to the file to read (relative to repo root)"),
    }),
    execute: async ({ path: filePath }) => {
      try {
        const absolutePath = path.resolve(cwd, filePath);
        const content = await fs.readFile(absolutePath, "utf-8");
        return {
          path: filePath,
          content,
          success: true,
        };
      } catch (error) {
        return {
          path: filePath,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    },
  });
}

/**
 * Create a write_file tool for AI agents
 * @param cwd Current working directory for relative path resolution
 */
export function createWriteFileTool(cwd: string) {
  return tool({
    description: "Write content to an existing file (overwrites the file)",
    parameters: z.object({
      path: z
        .string()
        .describe("The path to the file to write (relative to repo root)"),
      content: z.string().describe("The content to write to the file"),
    }),
    execute: async ({ path: filePath, content }) => {
      try {
        const absolutePath = path.resolve(cwd, filePath);
        await fs.writeFile(absolutePath, content, "utf-8");
        return {
          path: filePath,
          success: true,
          message: "File written successfully",
        };
      } catch (error) {
        return {
          path: filePath,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    },
  });
}

/**
 * Create a create_file tool for AI agents
 * @param cwd Current working directory for relative path resolution
 */
export function createCreateFileTool(cwd: string) {
  return tool({
    description: "Create a new file with the specified content",
    parameters: z.object({
      path: z
        .string()
        .describe(
          "The path where the new file should be created (relative to repo root)"
        ),
      content: z.string().describe("The content for the new file"),
    }),
    execute: async ({ path: filePath, content }) => {
      try {
        const absolutePath = path.resolve(cwd, filePath);
        // Ensure directory exists
        const dir = path.dirname(absolutePath);
        await fs.mkdir(dir, { recursive: true });

        // Check if file already exists
        try {
          await fs.access(absolutePath);
          return {
            path: filePath,
            error: "File already exists",
            success: false,
          };
        } catch {
          // File doesn't exist, proceed with creation
          await fs.writeFile(absolutePath, content, "utf-8");
          return {
            path: filePath,
            success: true,
            message: "File created successfully",
          };
        }
      } catch (error) {
        return {
          path: filePath,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    },
  });
}

/**
 * Create a list_directory tool for AI agents
 * @param cwd Current working directory for relative path resolution
 */
export function createListDirectoryTool(cwd: string) {
  return tool({
    description: "List files and directories in a given path",
    parameters: z.object({
      path: z
        .string()
        .describe("The directory path to list (relative to repo root)"),
      include_hidden: z
        .boolean()
        .optional()
        .describe("Whether to include hidden files (starting with .)"),
    }),
    execute: async ({ path: dirPath, include_hidden = false }) => {
      try {
        const absolutePath = path.resolve(cwd, dirPath);
        const entries = await fs.readdir(absolutePath, {
          withFileTypes: true,
        });
        const items = entries
          .filter((entry) => include_hidden || !entry.name.startsWith("."))
          .map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
            path: path.join(dirPath, entry.name),
          }));

        return {
          path: dirPath,
          items,
          success: true,
        };
      } catch (error) {
        return {
          path: dirPath,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    },
  });
}

/**
 * Create an append_to_file tool for AI agents
 * @param cwd Current working directory for relative path resolution
 */
export function createAppendToFileTool(cwd: string) {
  return tool({
    description: "Append content to the end of an existing file",
    parameters: z.object({
      path: z
        .string()
        .describe("The path to the file to append to (relative to repo root)"),
      content: z.string().describe("The content to append to the file"),
    }),
    execute: async ({ path: filePath, content }) => {
      try {
        const absolutePath = path.resolve(cwd, filePath);
        await fs.appendFile(absolutePath, content, "utf-8");
        return {
          path: filePath,
          success: true,
          message: "Content appended successfully",
        };
      } catch (error) {
        return {
          path: filePath,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    },
  });
}

/**
 * Create a delete_file tool for AI agents
 * @param cwd Current working directory for relative path resolution
 */
export function createDeleteFileTool(cwd: string) {
  return tool({
    description: "Delete a file or directory",
    parameters: z.object({
      path: z
        .string()
        .describe(
          "The path to the file or directory to delete (relative to repo root)"
        ),
      recursive: z
        .boolean()
        .optional()
        .describe("Whether to delete directories recursively"),
    }),
    execute: async ({ path: targetPath, recursive = false }) => {
      try {
        const absolutePath = path.resolve(cwd, targetPath);
        const stats = await fs.lstat(absolutePath);
        if (stats.isDirectory()) {
          await fs.rmdir(absolutePath, { recursive });
        } else {
          await fs.unlink(absolutePath);
        }
        return {
          path: targetPath,
          success: true,
          message: `${
            stats.isDirectory() ? "Directory" : "File"
          } deleted successfully`,
        };
      } catch (error) {
        return {
          path: targetPath,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    },
  });
}

/**
 * Create a getBulkTargetData tool for AI agents
 * @param cwd Current working directory for relative path resolution
 * @param repositoryTargets Available targets in the repository
 */
export function createGetBulkTargetDataTool(
  cwd: string,
  repositoryTargets: Record<string, TargetInfo>
) {
  return tool({
    description:
      "Get bulk target data including dependencies and environment variables for specified targets",
    parameters: z.object({
      targetNames: z
        .array(z.string())
        .describe(
          "List of target names to analyze (available targets: " +
            Object.keys(repositoryTargets).join(", ") +
            ")"
        ),
      repoPath: z
        .string()
        .optional()
        .describe("Repository path (defaults to current working directory)"),
    }),
    execute: async ({ targetNames, repoPath }) => {
      try {
        const resolvedRepoPath = repoPath ? path.resolve(cwd, repoPath) : cwd;

        // Filter repository targets by requested names
        const requestedTargets: Record<string, TargetInfo> = {};
        const availableTargetNames = Object.keys(repositoryTargets);
        const invalidTargets: string[] = [];

        for (const targetName of targetNames) {
          if (repositoryTargets[targetName]) {
            requestedTargets[targetName] = repositoryTargets[targetName];
          } else {
            invalidTargets.push(targetName);
          }
        }

        if (invalidTargets.length > 0) {
          return {
            success: false,
            error: `Invalid target names: ${invalidTargets.join(
              ", "
            )}. Available targets: ${availableTargetNames.join(", ")}`,
          };
        }

        if (Object.keys(requestedTargets).length === 0) {
          return {
            success: false,
            error: "No valid targets specified",
          };
        }

        const result = await getBulkTargetData(
          requestedTargets,
          resolvedRepoPath
        );
        return {
          success: true,
          data: result,
          requestedTargets: Object.keys(requestedTargets),
          availableTargets: availableTargetNames,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}

/**
 * Create a complete set of file operation tools for AI agents
 * @param cwd Current working directory for relative path resolution
 * @param repositoryTargets Optional repository targets for the getBulkTargetData tool
 */
export function createFileOperationTools(
  cwd: string,
  repositoryTargets?: Record<string, TargetInfo>
) {
  const tools: any = {
    read_file: createReadFileTool(cwd),
    write_file: createWriteFileTool(cwd),
    create_file: createCreateFileTool(cwd),
    list_directory: createListDirectoryTool(cwd),
    append_to_file: createAppendToFileTool(cwd),
    delete_file: createDeleteFileTool(cwd),
  };

  // Only add getBulkTargetData tool if repository targets are provided
  if (repositoryTargets) {
    tools.get_bulk_target_data = createGetBulkTargetDataTool(
      cwd,
      repositoryTargets
    );
  }

  return tools;
}
