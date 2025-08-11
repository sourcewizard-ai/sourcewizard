import {
  TokenStorage,
  StoredTokens,
} from "../lib/cli-web-auth/token-storage.js";
import path from "path";
import os from "os";

// Create a mock auth client interface
interface MockAuthClient {
  refreshSession: jest.Mock;
}

describe("TokenStorage Automatic Refresh", () => {
  let tokenStorage: TokenStorage;
  let mockAuthClient: MockAuthClient;
  let testConfigDir: string;

  beforeEach(() => {
    // Create a mock auth client
    mockAuthClient = {
      refreshSession: jest.fn(),
    };

    // Use a temporary directory for testing
    testConfigDir = `test-sourcewizard-${Date.now()}`;

    tokenStorage = new TokenStorage(testConfigDir, mockAuthClient as any);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await tokenStorage.clearTokens();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("getTokens with automatic refresh", () => {
    it("should return valid tokens without refresh when not expired", async () => {
      const validTokens: StoredTokens = {
        accessToken: "valid_access_token",
        refreshToken: "valid_refresh_token",
        expiresAt: Date.now() + 3600000, // 1 hour from now
        user: {
          id: "user_123",
          email: "test@example.com",
        },
      };

      await tokenStorage.storeTokens(validTokens);

      const result = await tokenStorage.getTokens();

      expect(result).toEqual(validTokens);
      expect(mockAuthClient.refreshSession).not.toHaveBeenCalled();
    });

    it("should refresh tokens when they expire soon", async () => {
      const expiredTokens: StoredTokens = {
        accessToken: "expired_access_token",
        refreshToken: "valid_refresh_token",
        expiresAt: Date.now() + 60000, // 1 minute from now (within 5 minute threshold)
        user: {
          id: "user_123",
          email: "test@example.com",
        },
      };

      const refreshedSession = {
        access_token: "new_access_token",
        refresh_token: "new_refresh_token",
        expires_at: Math.floor((Date.now() + 3600000) / 1000), // 1 hour from now in seconds
        user: {
          id: "user_123",
          email: "test@example.com",
        },
      };

      mockAuthClient.refreshSession.mockResolvedValue({
        data: { session: refreshedSession },
        error: null,
      });

      await tokenStorage.storeTokens(expiredTokens);

      const result = await tokenStorage.getTokens();

      expect(mockAuthClient.refreshSession).toHaveBeenCalledWith({
        refresh_token: "valid_refresh_token",
      });

      expect(result).toEqual({
        accessToken: "new_access_token",
        refreshToken: "new_refresh_token",
        expiresAt: refreshedSession.expires_at * 1000,
        user: {
          id: "user_123",
          email: "test@example.com",
        },
      });
    });

    it("should clear tokens when refresh fails", async () => {
      const expiredTokens: StoredTokens = {
        accessToken: "expired_access_token",
        refreshToken: "invalid_refresh_token",
        expiresAt: Date.now() - 1000, // Already expired
        user: {
          id: "user_123",
          email: "test@example.com",
        },
      };

      mockAuthClient.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid refresh token" },
      });

      await tokenStorage.storeTokens(expiredTokens);

      const result = await tokenStorage.getTokens();

      expect(mockAuthClient.refreshSession).toHaveBeenCalled();
      expect(result).toBeNull();

      // Verify tokens were cleared
      const tokensAfterFailure = await tokenStorage.hasValidTokens();
      expect(tokensAfterFailure).toBe(false);
    });

    it("should handle refresh session throwing an error", async () => {
      const expiredTokens: StoredTokens = {
        accessToken: "expired_access_token",
        refreshToken: "valid_refresh_token",
        expiresAt: Date.now() - 1000, // Already expired
        user: {
          id: "user_123",
          email: "test@example.com",
        },
      };

      mockAuthClient.refreshSession.mockRejectedValue(
        new Error("Network error")
      );

      await tokenStorage.storeTokens(expiredTokens);

      const result = await tokenStorage.getTokens();

      expect(result).toBeNull();
    });

    it("should work without auth client but not refresh", async () => {
      const tokenStorageWithoutAuth = new TokenStorage(testConfigDir);

      const expiredTokens: StoredTokens = {
        accessToken: "expired_access_token",
        refreshToken: "valid_refresh_token",
        expiresAt: Date.now() - 1000, // Already expired
        user: {
          id: "user_123",
          email: "test@example.com",
        },
      };

      await tokenStorageWithoutAuth.storeTokens(expiredTokens);

      const result = await tokenStorageWithoutAuth.getTokens();

      expect(result).toBeNull();
    });
  });
});
