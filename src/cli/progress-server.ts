import express from "express";
import cors from "cors";

export interface ProgressUpdate {
  text?: string;
  step: number;
  maxSteps: number;
  progress: number;
  isComplete: boolean;
  error?: string;
}

export class ProgressServer {
  private app: express.Application;
  private server: any;
  private port: number;
  private currentProgress: ProgressUpdate;

  constructor(port: number = 0) {
    this.port = port;
    this.app = express();
    this.currentProgress = {
      step: 0,
      maxSteps: 10,
      progress: 0,
      isComplete: false,
      text: "Ready for installation...",
    };

    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Get current progress
    this.app.get("/progress", (req, res) => {
      res.json(this.currentProgress);
    });

    // Reset progress for new installation
    this.app.post("/reset", (req, res) => {
      this.currentProgress = {
        step: 0,
        maxSteps: 10,
        progress: 0,
        isComplete: false,
        text: "Ready for installation...",
      };
      res.json({ success: true });
    });
  }

  updateProgress(progress: ProgressUpdate): void {
    this.currentProgress = progress;
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
