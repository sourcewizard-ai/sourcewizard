import { promises as fs } from "fs";
import * as path from "path";
import { tool } from "ai";
import z from "zod";
import { getBulkTargetData, TargetInfo, executeRepositoryCommand, executeAddCommand } from "./repository-detector";

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
 * Create an edit_file tool for AI agents
 * @param cwd Current working directory for relative path resolution
 */
export function createEditFileTool(cwd: string) {
  return tool({
    description: "Edit a file by replacing specific content using string replacement",
    parameters: z.object({
      path: z
        .string()
        .describe("The path to the file to modify (relative to repo root)"),
      old_string: z
        .string()
        .describe("The exact string to replace in the file"),
      new_string: z
        .string()
        .describe("The new string to replace the old string with"),
    }),
    execute: async ({ path: filePath, old_string, new_string }) => {
      try {
        const absolutePath = path.resolve(cwd, filePath);
        
        // Read the current file content
        const currentContent = await fs.readFile(absolutePath, "utf-8");
        
        // Check if the old_string exists in the file
        if (!currentContent.includes(old_string)) {
          return {
            path: filePath,
            error: "Old string not found in file",
            success: false,
          };
        }
        
        // Apply the replacement
        const newContent = currentContent.replace(old_string, new_string);
        
        // Write the modified content back to the file
        await fs.writeFile(absolutePath, newContent, "utf-8");
        
        return {
          path: filePath,
          success: true,
          message: "File edited successfully",
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
 * Create a typecheck tool for AI agents
 * @param cwd Current working directory for relative path resolution
 */
export function createTypecheckTool(cwd: string) {
  return tool({
    description: "Run type checking on the repository using the check command",
    parameters: z.object({
      target: z
        .string()
        .optional()
        .describe("Target to typecheck (defaults to root target)"),
      repoPath: z
        .string()
        .optional()
        .describe("Repository path (defaults to current working directory)"),
    }),
    execute: async ({ target, repoPath }) => {
      try {
        const resolvedRepoPath = repoPath ? path.resolve(cwd, repoPath) : cwd;
        let output = "";
        let hasError = false;

        const result = await executeRepositoryCommand(
          "check",
          target,
          resolvedRepoPath,
          {
            onOutput: (message: string, type: 'info' | 'error' | 'success') => {
              output += `[${type}] ${message}\n`;
              if (type === 'error') {
                hasError = true;
              }
            }
          }
        );

        return {
          success: !hasError,
          output: output.trim(),
          target: target || "default",
          repoPath: resolvedRepoPath,
          message: hasError ? "Type checking completed with errors" : "Type checking completed successfully"
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          target: target || "default",
          repoPath: repoPath || cwd,
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
        .union([z.array(z.string()), z.string()])
        .describe(
          "List of target names to analyze (can be an array or string representation). Available targets: " +
            Object.keys(repositoryTargets).join(", ")
        ),
      repoPath: z
        .string()
        .optional()
        .describe("Repository path (defaults to current working directory)"),
    }),
    execute: async ({ targetNames, repoPath }) => {
      try {
        // Handle case where targetNames might be passed as a string representation of an array
        let processedTargetNames: string[];
        if (typeof targetNames === "string") {
          // Try to parse string representations like "[:sample-app]" or "[\"sample-app\"]"
          const cleanString = targetNames.trim();
          if (cleanString.startsWith("[") && cleanString.endsWith("]")) {
            try {
              // Remove brackets and split by comma, then clean each item
              const innerContent = cleanString.slice(1, -1);
              if (innerContent.startsWith(":")) {
                // Handle special case like "[:sample-app]"
                processedTargetNames = [innerContent.slice(1)];
              } else {
                // Handle standard JSON array format
                processedTargetNames = JSON.parse(cleanString);
              }
            } catch {
              // If parsing fails, treat as single item
              processedTargetNames = [cleanString];
            }
          } else {
            // Single string value
            processedTargetNames = [cleanString];
          }
        } else {
          processedTargetNames = targetNames;
        }

        const resolvedRepoPath = repoPath ? path.resolve(cwd, repoPath) : cwd;

        // Filter repository targets by requested names
        const requestedTargets: Record<string, TargetInfo> = {};
        const availableTargetNames = Object.keys(repositoryTargets);
        const invalidTargets: string[] = [];

        for (const targetName of processedTargetNames) {
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
 * Create an add_package tool for AI agents
 * @param cwd Current working directory for relative path resolution
 */
export function createAddPackageTool(cwd: string) {
  return tool({
    description: "Add a package/dependency to the repository using the add command",
    parameters: z.object({
      packageName: z
        .string()
        .describe("Name of the package to add"),
      target: z
        .string()
        .optional()
        .describe("Target to add the package to (defaults to root target)"),
      isDev: z
        .boolean()
        .optional()
        .describe("Whether to add as a dev dependency"),
      useWorkspace: z
        .boolean()
        .optional()
        .describe("Whether to use workspace flag (e.g., -w for pnpm workspaces)"),
      additionalFlags: z
        .array(z.string())
        .optional()
        .describe("Additional flags to pass to the add command"),
      repoPath: z
        .string()
        .optional()
        .describe("Repository path (defaults to current working directory)"),
    }),
    execute: async ({ packageName, target, isDev = false, useWorkspace, additionalFlags, repoPath }) => {
      try {
        const resolvedRepoPath = repoPath ? path.resolve(cwd, repoPath) : cwd;
        let output = "";
        let hasError = false;

        const result = await executeAddCommand(
          target,
          resolvedRepoPath,
          {
            packageName,
            isDev,
            useWorkspace,
            additionalFlags,
            onOutput: (message: string, type: 'info' | 'error' | 'success') => {
              output += `[${type}] ${message}\n`;
              if (type === 'error') {
                hasError = true;
              }
            }
          }
        );

        return {
          success: !hasError,
          output: output.trim(),
          target: target || "default",
          packageName,
          isDev,
          repoPath: resolvedRepoPath,
          message: hasError ? `Failed to add package ${packageName}` : `Package ${packageName} added successfully`
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          target: target || "default",
          packageName,
          isDev,
          repoPath: repoPath || cwd,
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
    edit_file: createEditFileTool(cwd),
    typecheck: createTypecheckTool(cwd),
    add_package: createAddPackageTool(cwd),
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

export function createSearchTools(
  cwd: string,
  repositoryTargets: Record<string, TargetInfo>
) {
  const tools: any = {
    get_bulk_target_data: createGetBulkTargetDataTool(cwd, repositoryTargets),
  };

  return tools;
}
