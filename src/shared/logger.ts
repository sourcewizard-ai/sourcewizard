import fs from 'fs';
import path from 'path';
import os from 'os';

export class Logger {
  private static logDir: string;
  private static initialized = false;

  private static initializeLogDir(): void {
    if (this.initialized) return;

    // Use ~/.config/sourcewizard for logs
    this.logDir = path.join(os.homedir(), '.config', 'sourcewizard', 'logs');
    
    // Create directory if it doesn't exist
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
    
    this.initialized = true;
  }

  private static getLogFilePath(type: 'error' | 'install' | 'general'): string {
    this.initializeLogDir();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `${type}-${date}.log`);
  }

  private static writeLog(type: 'error' | 'install' | 'general', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type,
      message,
      ...(data && { data })
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    const logFile = this.getLogFilePath(type);

    try {
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  static logError(message: string, error?: Error | any, context?: any): void {
    const errorData = {
      message,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          ...(error.cause && { cause: error.cause })
        }
      }),
      ...(context && { context })
    };

    this.writeLog('error', message, errorData);
    
    // Also log to console for immediate visibility
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error);
  }

  static logInstallationError(packageName: string, error: Error | any, context?: any): void {
    const installError = {
      packageName,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...(error.cause && { cause: error.cause })
      },
      ...(context && { context })
    };

    this.writeLog('error', `Installation failed for package: ${packageName}`, installError);
    this.writeLog('install', `Failed: ${packageName}`, installError);
    
    // Also log to console
    console.error(`[${new Date().toISOString()}] INSTALL ERROR: Package ${packageName} failed:`, error);
  }

  static logInfo(message: string, data?: any): void {
    this.writeLog('general', message, data);
  }

  static logInstallationSuccess(packageName: string, context?: any): void {
    const successData = {
      packageName,
      ...(context && { context })
    };

    this.writeLog('install', `Success: ${packageName}`, successData);
    console.log(`[${new Date().toISOString()}] INSTALL SUCCESS: Package ${packageName} installed successfully`);
  }

  static getLogDirectory(): string {
    this.initializeLogDir();
    return this.logDir;
  }
}