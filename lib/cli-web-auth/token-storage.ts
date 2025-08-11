import fs from "fs/promises";
import path from "path";
import os from "os";
import { SupabaseAuthClient } from "@supabase/supabase-js/src/lib/SupabaseAuthClient.js";

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
  private logsDir: string;
  private auth?: SupabaseAuthClient;

  constructor(configDir: string, authClient?: SupabaseAuthClient) {
    // Use standard config directories based on OS
    this.configDir = path.join(os.homedir(), ".config", configDir);
    this.tokenFilePath = path.join(this.configDir, "auth.json");
    this.logsDir = path.join(this.configDir, "logs");
    this.auth = authClient;
  }

  /**
   * Set the auth client for token refresh operations
   */
  setAuthClient(authClient: SupabaseAuthClient): void {
    this.auth = authClient;
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
   * Ensure the logs directory exists
   */
  private async ensureLogsDir(): Promise<void> {
    try {
      await fs.access(this.logsDir);
    } catch {
      await fs.mkdir(this.logsDir, { recursive: true });
    }
  }

  /**
   * Log error to file in logs directory
   */
  private async logError(error: string): Promise<void> {
    try {
      await this.ensureLogsDir();
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] Token refresh error: ${error}\n`;
      const logFile = path.join(this.logsDir, "errors.log");
      await fs.appendFile(logFile, logEntry);
    } catch (logError) {
      // Silent fail for logging errors to avoid infinite loops
      console.error("Failed to write to log file:", logError);
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
   * Refresh tokens using the stored refresh token
   */
  private async refreshTokens(
    currentTokens: StoredTokens
  ): Promise<StoredTokens | null> {
    if (!this.auth) {
      await this.logError("No auth client available for token refresh");
      return null;
    }

    try {
      // Use Supabase's refresh session method
      const { data, error } = await this.auth.refreshSession({
        refresh_token: currentTokens.refreshToken,
      });

      if (error || !data.session) {
        const errorMessage = error ? error.message : "No session data returned";
        await this.logError(`Token refresh failed: ${errorMessage}`);
        return null;
      }

      const session = data.session;
      const refreshedTokens: StoredTokens = {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at
          ? session.expires_at * 1000
          : Date.now() + 3600000, // Default 1 hour if no expires_at
        user: {
          id: session.user.id,
          email: session.user.email || currentTokens.user.email, // Fallback to stored email
        },
      };

      // Store the refreshed tokens
      await this.storeTokens(refreshedTokens);

      return refreshedTokens;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logError(`Token refresh exception: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Attempt to refresh tokens on startup - doesn't clear tokens on failure
   */
  async attemptStartupRefresh(): Promise<boolean> {
    try {
      const tokenData = await fs.readFile(this.tokenFilePath, "utf-8");
      const tokens: StoredTokens = JSON.parse(tokenData);

      // Check if tokens are expired or close to expiry
      const now = Date.now();
      const timeUntilExpiry = tokens.expiresAt - now;

      // If tokens expire within 10 minutes, try to refresh them
      if (timeUntilExpiry <= 10 * 60 * 1000) {
        const refreshedTokens = await this.refreshTokens(tokens);
        return refreshedTokens !== null;
      }

      return true; // Tokens are still valid
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logError(`Failed to read tokens for startup refresh: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Retrieve stored authentication tokens with automatic refresh
   */
  async getTokens(): Promise<StoredTokens | null> {
    try {
      const tokenData = await fs.readFile(this.tokenFilePath, "utf-8");
      const tokens: StoredTokens = JSON.parse(tokenData);

      // Check if tokens are expired
      const now = Date.now();
      const timeUntilExpiry = tokens.expiresAt - now;

      // If tokens expire within 5 minutes, try to refresh them
      if (timeUntilExpiry <= 5 * 60 * 1000) {
        const refreshedTokens = await this.refreshTokens(tokens);
        if (refreshedTokens) {
          return refreshedTokens;
        }

        // If refresh failed, return expired tokens but don't clear them
        // Let the application decide what to do with expired tokens
        await this.logError("Token refresh failed in getTokens, returning expired tokens");
        return tokens;
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
