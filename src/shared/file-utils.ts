import { promises as fs } from "fs";
import path from "path";
import { glob } from "glob";

/**
 * Read files matching given patterns and return a map of relative paths to content
 * @param cwd Current working directory
 * @param relevantFilesPattern Array of glob patterns to match files
 * @returns Map of relative file paths to file contents
 */
export async function readRelevantFiles(
  cwd: string,
  relevantFilesPattern: string[]
): Promise<Map<string, string>> {
  const fileMap = new Map<string, string>();

  for (const pattern of relevantFilesPattern) {
    try {
      // Use glob to find files matching the pattern
      const files = await glob(pattern, {
        cwd,
        nodir: true, // Only files, not directories
        ignore: ["node_modules/**", ".git/**", "**/dist/**", "**/build/**"], // Ignore common build/dependency directories
      });

      // Read each file and add to map
      for (const file of files) {
        const filePath = path.resolve(cwd, file);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          // Use relative path as key for cleaner paths
          const relativePath = path.relative(cwd, filePath);
          fileMap.set(relativePath, content);
        } catch (error) {
          console.warn(`Failed to read file ${filePath}:`, error);
          // Continue with other files instead of failing completely
        }
      }
    } catch (error) {
      console.warn(`Failed to process pattern ${pattern}:`, error);
      // Continue with other patterns
    }
  }

  return fileMap;
}

/**
 * Calculate token counts for content (simple whitespace-based estimation)
 * @param content Text content to count tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

/**
 * Log file information with token counts
 * @param fileMap Map of file paths to contents
 * @param setupPrompt Optional setup prompt to include in token count
 */
export function logFileInfo(
  fileMap: Map<string, string>,
  setupPrompt?: string
): void {
  console.log(`Found ${fileMap.size} relevant files:`);

  let totalTokens = 0;
  for (const [filePath, content] of fileMap) {
    const tokenCount = estimateTokenCount(content);
    totalTokens += tokenCount;
    console.log(
      `- ${filePath} (${content.length} characters, ~${tokenCount} tokens)`
    );
  }

  const setupPromptTokenCount = setupPrompt
    ? estimateTokenCount(setupPrompt)
    : 0;
  const promptTokens = totalTokens + setupPromptTokenCount;

  console.log(`Total tokens across relevant files: ~${totalTokens}`);
  if (setupPrompt) {
    console.log(
      `Prompt tokens (relevant files + setup prompt): ~${promptTokens}`
    );
  }
}
