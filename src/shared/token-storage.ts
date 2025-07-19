import fs from "fs/promises";
import path from "path";
import os from "os";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
  };
}

export class TokenStorage {
  private configDir: string;
  private tokenFilePath: string;

  constructor() {
    // Use standard config directories based on OS
    this.configDir = path.join(os.homedir(), ".config", "sourcewizard");
    this.tokenFilePath = path.join(this.configDir, "auth.json");
  }

  /**
   * Ensure the config directory exists
   */
  private async ensureConfigDir(): Promise<void> {
    try {
      await fs.access(this.configDir);
    } catch {
      await fs.mkdir(this.configDir, { recursive: true });
    }
  }

  /**
   * Store authentication tokens
   */
  async storeTokens(tokens: StoredTokens): Promise<void> {
    await this.ensureConfigDir();

    const tokenData = JSON.stringify(tokens, null, 2);
    await fs.writeFile(this.tokenFilePath, tokenData, { mode: 0o600 }); // Restrict file permissions
  }

  /**
   * Retrieve stored authentication tokens
   */
  async getTokens(): Promise<StoredTokens | null> {
    try {
      const tokenData = await fs.readFile(this.tokenFilePath, "utf-8");
      const tokens: StoredTokens = JSON.parse(tokenData);

      // Check if tokens are expired
      if (Date.now() >= tokens.expiresAt) {
        await this.clearTokens();
        return null;
      }

      return tokens;
    } catch (error) {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  /**
   * Clear stored authentication tokens
   */
  async clearTokens(): Promise<void> {
    try {
      await fs.unlink(this.tokenFilePath);
    } catch {
      // File doesn't exist, nothing to clear
    }
  }

  /**
   * Check if valid tokens exist
   */
  async hasValidTokens(): Promise<boolean> {
    const tokens = await this.getTokens();
    return tokens !== null;
  }

  /**
   * Get the stored user information
   */
  async getStoredUser(): Promise<{ id: string; email: string } | null> {
    const tokens = await this.getTokens();
    return tokens?.user || null;
  }
}

// Export singleton instance
export const tokenStorage = new TokenStorage();
