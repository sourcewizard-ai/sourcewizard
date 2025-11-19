import express from "express";
import cors from "cors";

export interface ProgressUpdate {
  operationId?: string;
  installationId?: string; // Legacy field for backwards compatibility
  text?: string;
  toolCalls?: any[];
  toolResults?: any[];
  finishReason?: string;
  usage?: any;
  stage?: string;
  description?: string;
  result?: any;
  // Legacy fields for backwards compatibility
  step?: number;
  maxSteps?: number;
  progress?: number;
  isComplete: boolean;
  error?: string;
}

export class ProgressServer {
  private app: express.Application;
  private server: any;
  private port: number;
  private installationProgress: Map<string, ProgressUpdate>;
  private defaultProgress: ProgressUpdate;

  constructor(port: number = 0) {
    this.port = port;
    this.app = express();
    this.installationProgress = new Map();
    this.defaultProgress = {
      text: "Ready for installation...",
      isComplete: false,
      stage: "waiting",
      description: "Waiting for installation to begin",
      progress: 0
    };

    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Get current progress (returns default/most recent if no installation ID specified)
    this.app.get("/progress", (req, res) => {
      const installationId = req.query.installationId as string;
      
      if (installationId && this.installationProgress.has(installationId)) {
        res.json(this.installationProgress.get(installationId));
      } else {
        // Return the most recent installation progress, or default if none exist
        const latestProgress = Array.from(this.installationProgress.values())
          .sort((a, b) => (b.installationId?.localeCompare(a.installationId || '') || 0))[0];
        
        res.json(latestProgress || this.defaultProgress);
      }
    });

    // Get all installations
    this.app.get("/installations", (req, res) => {
      const allInstallations = Array.from(this.installationProgress.entries())
        .map(([id, progress]) => ({
          installationId: id,
          ...progress
        }));
      
      res.json(allInstallations);
    });

    // Reset progress for new installation
    this.app.post("/reset", (req, res) => {
      const installationId = req.body.installationId as string;
      
      if (installationId) {
        this.installationProgress.delete(installationId);
      } else {
        // Reset all
        this.installationProgress.clear();
      }
      
      res.json({ success: true });
    });
  }

  updateProgress(progress: ProgressUpdate): void {
    if (progress.installationId) {
      this.installationProgress.set(progress.installationId, progress);
    } else {
      // For backwards compatibility, update the default progress
      this.defaultProgress = progress;
    }
  }

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        const actualPort = this.server.address()?.port;
        console.log(
          `Progress server running on http://localhost:${actualPort}`
        );
        resolve(actualPort);
      });

      this.server.on("error", (error: any) => {
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}
