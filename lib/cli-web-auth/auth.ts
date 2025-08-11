import { TokenStorage } from "./token-storage.js";
import { WebAuthServer } from "./server.js";
import { WebAuthOptions } from "./types.js";
import open from "open";
import { SupabaseAuthClient } from "@supabase/supabase-js/src/lib/SupabaseAuthClient.js";

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
  };
}

export class CLIAuth {
  private auth: SupabaseAuthClient;
  private tokenStorage: TokenStorage;

  constructor(authInstance: SupabaseAuthClient, configDir: string) {
    this.auth = authInstance;
    this.tokenStorage = new TokenStorage(configDir, authInstance);
  }

  /**
   * Initialize authentication by restoring session from stored tokens
   * Now includes automatic token refresh if tokens are expired
   */
  async initialize(): Promise<void> {
    // First attempt to refresh tokens on startup
    await this.tokenStorage.attemptStartupRefresh();
    
    // Then get tokens (which may have been refreshed)
    const tokens = await this.tokenStorage.getTokens();

    if (tokens) {
      try {
        // Set the session with potentially refreshed tokens
        await this.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
      } catch (error) {
        // If session restoration fails, log the error but don't clear tokens immediately
        // The user may still be able to use them for some operations
        console.error("Failed to restore session:", error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Login using web-based authentication
   */
  async login(options: WebAuthOptions = {}): Promise<AuthStatus> {
    const webAuthServer = new WebAuthServer({
      tokenStorage: this.tokenStorage,
    });

    try {
      // Start the web auth server on a random port
      const port = await webAuthServer.start();
      const callbackUrl = webAuthServer.getCallbackUrl();

      if (!callbackUrl) {
        throw new Error("Failed to get callback URL");
      }

      // Construct login page URL with callback parameter
      const loginPageUrl =
        options.loginPageUrl ||
        `http://localhost:3000/cli-login?redirect_to=${encodeURIComponent(
          callbackUrl
        )}`;

      await open(loginPageUrl);

      // Wait for authentication
      const tokens = await webAuthServer.waitForAuth();

      // Stop the server
      await webAuthServer.stop();

      return {
        isAuthenticated: true,
        user: tokens.user,
      };
    } catch (error) {
      // Make sure to stop the server on error
      try {
        await webAuthServer.stop();
      } catch (stopError) {
        // Ignore stop errors
      }

      throw new Error(
        error instanceof Error
          ? error.message
          : "Web authentication failed with unknown error"
      );
    }
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch (error) {
      // Even if Supabase logout fails, clear local tokens
    } finally {
      await this.tokenStorage.clearTokens();
    }
  }

  /**
   * Get current authentication status
   * Now uses the automatic token refresh functionality
   */
  async getStatus(): Promise<AuthStatus> {
    // Check tokens (this will automatically refresh if needed)
    const storedUser = await this.tokenStorage.getStoredUser();

    if (!storedUser) {
      return { isAuthenticated: false };
    }

    // Verify with Supabase session
    try {
      const {
        data: { session },
        error,
      } = await this.auth.getSession();

      if (error || !session) {
        // Don't immediately clear tokens - they might be refreshable
        return { isAuthenticated: false };
      }

      return {
        isAuthenticated: true,
        user: storedUser,
      };
    } catch (error) {
      // If verification fails, return unauthenticated but don't clear tokens
      // The tokens might still be valid for API operations
      return { isAuthenticated: false };
    }
  }

  /**
   * Ensure user is authenticated, throw error if not
   */
  async requireAuth(): Promise<{ id: string; email: string }> {
    const status = await this.getStatus();

    if (!status.isAuthenticated || !status.user) {
      throw new Error(
        "Authentication required. Please login first using: sourcewizard login"
      );
    }

    return status.user;
  }

  /**
   * Get current user ID for database operations
   */
  async getCurrentUserId(): Promise<string> {
    const user = await this.requireAuth();
    return user.id;
  }
}
