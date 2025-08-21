import z from "zod";

export const toolDefinitions = {
  read_file: {
    description: "Read the contents of a file",
    parameters: z.object({
      path: z
        .string()
        .describe("The path to the file to read (relative to repo root)"),
    }),
  },
  write_file: {
    description: "Write content to an existing file (overwrites the file)",
    parameters: z.object({
      path: z
        .string()
        .describe("The path to the file to write (relative to repo root)"),
      content: z.string().describe("The content to write to the file"),
    }),
  },
  create_file: {
    description: "Create a new file with the specified content",
    parameters: z.object({
      path: z
        .string()
        .describe(
          "The path where the new file should be created (relative to repo root)"
        ),
      content: z.string().describe("The content for the new file"),
    }),
  },
  list_directory: {
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
  },
  append_to_file: {
    description: "Append content to the end of an existing file",
    parameters: z.object({
      path: z
        .string()
        .describe("The path to the file to append to (relative to repo root)"),
      content: z.string().describe("The content to append to the file"),
    }),
  },
  delete_file: {
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
  },
  edit_file: {
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
  },
  get_bulk_target_data: {
    description:
      "Get bulk target data including dependencies and environment variables for specified targets",
    parameters: z.object({
      targetNames: z
        .union([z.array(z.string()), z.string()])
        .describe("List of target names to analyze (can be an array or string representation)."),
      repoPath: z
        .string()
        .optional()
        .describe("Repository path (defaults to current working directory)"),
    }),
  },
  typecheck: {
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
  },
};
