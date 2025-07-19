import { auth, SupabaseAuth } from "./supabase-client.js";
import { tokenStorage, StoredTokens } from "./token-storage.js";

export interface LoginOptions {
  email: string;
  password: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
  };
}

export class CLIAuth {
  private auth: SupabaseAuth;

  constructor(authInstance: SupabaseAuth = auth) {
    this.auth = authInstance;
  }

  /**
   * Initialize authentication by restoring session from stored tokens
   */
  async initialize(): Promise<void> {
    const tokens = await tokenStorage.getTokens();

    if (tokens) {
      try {
        await this.auth.setSession(tokens.accessToken, tokens.refreshToken);
      } catch (error) {
        // If session restoration fails, clear invalid tokens
        await tokenStorage.clearTokens();
      }
    }
  }

  /**
   * Login with email and password
   */
  async login(options: LoginOptions): Promise<AuthStatus> {
    try {
      const { session, user } = await this.auth.signInWithPassword(
        options.email,
        options.password
      );

      if (!session || !user) {
        throw new Error("Login failed: No session or user returned");
      }

      // Store tokens for persistence
      const tokens: StoredTokens = {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at
          ? session.expires_at * 1000
          : Date.now() + 3600000, // 1 hour default
        user: {
          id: user.id,
          email: user.email || options.email,
        },
      };

      await tokenStorage.storeTokens(tokens);

      return {
        isAuthenticated: true,
        user: {
          id: user.id,
          email: user.email || options.email,
        },
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Login failed with unknown error"
      );
    }
  }

  /**
   * Sign up with email and password
   */
  async signup(options: LoginOptions): Promise<AuthStatus> {
    try {
      const { user } = await this.auth.signUp(options.email, options.password);

      if (!user) {
        throw new Error("Signup failed: No user returned");
      }

      return {
        isAuthenticated: false, // User needs to confirm email
        user: {
          id: user.id,
          email: user.email || options.email,
        },
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Signup failed with unknown error"
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
      console.warn(
        "Warning: Supabase logout failed, but clearing local tokens"
      );
    } finally {
      await tokenStorage.clearTokens();
    }
  }

  /**
   * Get current authentication status
   */
  async getStatus(): Promise<AuthStatus> {
    // First check local tokens
    const storedUser = await tokenStorage.getStoredUser();

    if (!storedUser) {
      return { isAuthenticated: false };
    }

    // Verify with Supabase
    try {
      const isAuthenticated = await this.auth.isAuthenticated();

      if (!isAuthenticated) {
        // Clear invalid tokens
        await tokenStorage.clearTokens();
        return { isAuthenticated: false };
      }

      return {
        isAuthenticated: true,
        user: storedUser,
      };
    } catch (error) {
      // If verification fails, clear tokens and return unauthenticated
      await tokenStorage.clearTokens();
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

// Export singleton instance
export const cliAuth = new CLIAuth();
