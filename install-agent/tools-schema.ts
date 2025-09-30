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
  add_package: {
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
  },
  grep: {
    description: "Search for regex patterns in files",
    parameters: z.object({
      pattern: z
        .string()
        .describe("The regex pattern to search for"),
      paths: z
        .union([z.string(), z.array(z.string())])
        .describe("File path(s) to search in (relative to repo root). Can be a single path or array of paths"),
      ignoreCase: z
        .boolean()
        .optional()
        .describe("Whether to ignore case when matching (default: false)"),
      lineNumbers: z
        .boolean()
        .optional()
        .describe("Whether to include line numbers in results (default: true)"),
      contextLines: z
        .number()
        .optional()
        .describe("Number of context lines to show around matches (default: 0)"),
    }),
  },
  search_file: {
    description: "Read specific parts of a file by line range or by pattern matching",
    parameters: z.object({
      path: z
        .string()
        .describe("The path to the file to search in (relative to repo root)"),
      startLine: z
        .number()
        .optional()
        .describe("Starting line number (1-based) for line range reading"),
      endLine: z
        .number()
        .optional()
        .describe("Ending line number (1-based) for line range reading"),
      pattern: z
        .string()
        .optional()
        .describe("Regex pattern to find first and last matches for content extraction"),
      ignoreCase: z
        .boolean()
        .optional()
        .describe("Whether to ignore case when pattern matching (default: false)"),
      includeLineNumbers: z
        .boolean()
        .optional()
        .describe("Whether to include line numbers in output (default: true)"),
    }),
  },
};
