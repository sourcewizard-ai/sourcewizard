import express from "express";
import cors from "cors";
import { tokenStorage, StoredTokens } from "./token-storage.js";

export interface WebAuthOptions {
  port?: number; // 0 for random port
}

export class WebAuthServer {
  private app: express.Application;
  private server: any;
  private actualPort: number | null = null;
  private authPromise: Promise<StoredTokens> | null = null;
  private authResolve: ((tokens: StoredTokens) => void) | null = null;
  private authReject: ((error: Error) => void) | null = null;

  constructor(options: WebAuthOptions = {}) {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Enable CORS for all routes
    this.app.use(
      cors({
        origin: true, // Allow all origins
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );

    this.app.use(express.json());

    // Handle authentication callback
    this.app.post("/auth/callback", async (req, res) => {
      try {
        console.log("📡 Received authentication callback");
        const { access_token, refresh_token, expires_at, user } = req.body;

        if (!access_token || !refresh_token || !user) {
          throw new Error("Missing required authentication data");
        }

        const tokens: StoredTokens = {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: expires_at ? expires_at * 1000 : Date.now() + 3600000,
          user: {
            id: user.id,
            email: user.email,
          },
        };

        console.log("💾 Storing authentication tokens...");
        // Store tokens
        await tokenStorage.storeTokens(tokens);

        console.log("✅ Resolving authentication promise...");
        // Resolve the auth promise
        if (this.authResolve) {
          this.authResolve(tokens);
          console.log("🎉 Authentication promise resolved successfully");
        } else {
          console.warn("⚠️ No auth resolver available");
        }

        res.json({ success: true, message: "Authentication successful!" });
      } catch (error) {
        console.error("❌ Auth callback error:", error);

        if (this.authReject) {
          this.authReject(
            error instanceof Error ? error : new Error("Authentication failed")
          );
        }

        res.status(400).json({
          success: false,
          error:
            error instanceof Error ? error.message : "Authentication failed",
        });
      }
    });

    // Handle preflight OPTIONS requests
    this.app.options("/auth/callback", (req, res) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.sendStatus(200);
    });

    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        message: "Auth server is running",
        port: this.actualPort,
      });
    });
  }

  async start(port: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = this.app
        .listen(port, "localhost", () => {
          this.actualPort = this.server.address()?.port || port;
          console.log(
            `🔗 Auth server running on http://localhost:${this.actualPort}`
          );
          resolve(this.actualPort);
        })
        .on("error", (error) => {
          reject(error);
        });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          this.actualPort = null;
          resolve();
        });
      });
    }
  }

  async waitForAuth(): Promise<StoredTokens> {
    if (!this.authPromise) {
      this.authPromise = new Promise((resolve, reject) => {
        this.authResolve = resolve;
        this.authReject = reject;

        // Set a timeout for the auth process (5 minutes)
        const timeoutId = setTimeout(() => {
          this.authResolve = null;
          this.authReject = null;
          this.authPromise = null;
          reject(new Error("Authentication timeout - please try again"));
        }, 5 * 60 * 1000);

        // Clear timeout when promise resolves or rejects
        const originalResolve = this.authResolve;
        const originalReject = this.authReject;

        this.authResolve = (tokens: StoredTokens) => {
          clearTimeout(timeoutId);
          this.authResolve = null;
          this.authReject = null;
          this.authPromise = null;
          if (originalResolve) originalResolve(tokens);
        };

        this.authReject = (error: Error) => {
          clearTimeout(timeoutId);
          this.authResolve = null;
          this.authReject = null;
          this.authPromise = null;
          if (originalReject) originalReject(error);
        };
      });
    }

    return this.authPromise;
  }

  getPort(): number | null {
    return this.actualPort;
  }

  getCallbackUrl(): string | null {
    if (!this.actualPort) {
      return null;
    }
    return `http://localhost:${this.actualPort}/auth/callback`;
  }
}
