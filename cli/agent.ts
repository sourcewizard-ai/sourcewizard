import { detectRepo } from "../install-agent/repository-detector.js";
import { AIAgent } from "../install-agent/ai-agent.js";
import { ProgressServer } from "./progress-server.js";
import { Logger } from "../lib/logger.js";
import React from 'react';
import { render } from 'ink';
import InstallationSelector from './components/InstallationSelector.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface InstallationInfo {
  id: string;
  packageName: string;
  status: 'ready' | 'installing' | 'completed' | 'error';
  startedAt: number;
  completedAt?: number;
  errorAt?: number;
  error?: string;
  progress?: {
    step: number;
    maxSteps: number;
    progress: number;
    text: string;
  };
}

export interface MCPServerMetadata {
  port: number;
  pid: number;
  startTime: number;
  cwd: string;
  installations: { [installationId: string]: InstallationInfo };
}

export interface DiscoveredInstallation {
  mcpMetadata: MCPServerMetadata;
  installationInfo: InstallationInfo;
  filePath: string;
  displayName: string;
  mcpDisplayName: string;
}

export async function search(query: string, path: string, jwt?: string) {
  const repo = await detectRepo(path);

  const agent = new AIAgent({
    cwd: path,
    projectContext: repo,
    serverUrl: process.env.SOURCEWIZARD_SERVER_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://sourcewizard.ai"),
    jwt: jwt,
    apiKey: process.env.SOURCEWIZARD_API_KEY,
  });

  const result = await agent.searchPackages(query);
  console.log("Search result:", result);

  return result;
}

export async function install(
  name: string,
  path: string,
  onStepFinish: (step: any) => void,
  jwt?: string
) {
  const repo = await detectRepo(path);

  const agent = new AIAgent({
    cwd: path,
    projectContext: repo,
    serverUrl: process.env.SOURCEWIZARD_SERVER_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://sourcewizard.ai"),
    jwt: jwt,
    apiKey: process.env.SOURCEWIZARD_API_KEY,
    onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
      onStepFinish({ text, toolCalls, toolResults, finishReason, usage });
      // console.log("Agent step:", {
      //   text,
      //   toolCalls,
      //   toolResults,
      //   finishReason,
      //   usage,
      // });
    },
  });

  try {
    // Execute the installation task with the AI agent
    const result = await agent.installPackage(name);
    console.log("Installation result:", result);

    return result;
  } catch (error) {
    console.error("Error during installation:", error);

    // Log the installation error with detailed context
    Logger.logInstallationError(name, error, {
      path,
      jwt: !!jwt,
      repo: repo.name || 'unknown',
      serverUrl: process.env.SOURCEWIZARD_SERVER_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://sourcewizard.ai"),
      hasApiKey: !!process.env.SOURCEWIZARD_API_KEY,
      stage: "agent_execution"
    });

    throw error;
  }
}

async function discoverInstallations(): Promise<DiscoveredInstallation[]> {

  try {
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir);
    const portFiles = files.filter((f: string) => f.startsWith('sourcewizard-progress-') && f.endsWith('.port'));

    if (portFiles.length === 0) {
      return [];
    }

    const installations: DiscoveredInstallation[] = [];

    for (const file of portFiles) {
      try {
        const filePath = path.join(tmpDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const mcpMetadata: MCPServerMetadata = JSON.parse(content);

        const mcpDisplayName = `MCP #${mcpMetadata.pid}`;

        // If no installations exist yet, show the server as ready
        if (Object.keys(mcpMetadata.installations).length === 0) {
          installations.push({
            mcpMetadata,
            installationInfo: {
              id: 'ready',
              packageName: 'Ready for installation',
              status: 'ready',
              startedAt: mcpMetadata.startTime
            },
            filePath,
            displayName: `${mcpDisplayName} - Ready for installation`,
            mcpDisplayName
          });
        } else {
          // Add each installation from this MCP server
          for (const [installationId, installationInfo] of Object.entries(mcpMetadata.installations)) {
            let statusText = '';

            switch (installationInfo.status) {
              case 'installing':
                statusText = 'Installing';
                break;
              case 'completed':
                statusText = 'Completed';
                break;
              case 'error':
                statusText = 'Failed';
                break;
              default:
                statusText = 'Ready';
            }

            const displayName = `${installationInfo.packageName} (${mcpDisplayName})`;

            installations.push({
              mcpMetadata,
              installationInfo,
              filePath,
              displayName,
              mcpDisplayName
            });
          }
        }
      } catch (parseError) {
        // Skip invalid metadata files
        continue;
      }
    }

    // Sort by installation start time (most recent first)
    return installations.sort((a, b) => b.installationInfo.startedAt - a.installationInfo.startedAt);
  } catch (error) {
    return [];
  }
}

async function discoverProgressPort(): Promise<number | null> {
  const installations = await discoverInstallations();

  if (installations.length === 0) {
    return null;
  }

  // Return the port of the most recent installation
  return installations[0].mcpMetadata.port;
}

export async function listInstallations(): Promise<DiscoveredInstallation[]> {
  return await discoverInstallations();
}

export async function selectInstallation(installations: DiscoveredInstallation[]): Promise<DiscoveredInstallation | null> {
  if (installations.length === 0) {
    return null;
  }

  if (installations.length === 1) {
    return installations[0];
  }

  return new Promise((resolve) => {
    const { waitUntilExit } = render(
      React.createElement(InstallationSelector, {
        installations,
        onSelect: (installation) => {
          waitUntilExit();
          resolve(installation);
        }
      })
    );
  });
}

export async function watchMCPStatus(onStepFinish: (step: any) => void, selectedInstallation?: DiscoveredInstallation | null) {
  let installationToWatch = selectedInstallation;

  // If no installation provided, discover and select one
  if (!installationToWatch) {
    const installations = await listInstallations();

    if (installations.length === 0) {
      throw new Error(
        "No MCP servers found. Make sure an MCP server is running with 'sourcewizard mcp'"
      );
    }

    // Select which installation to follow
    installationToWatch = await selectInstallation(installations);

    if (!installationToWatch) {
      throw new Error("No installation selected");
    }
  }

  const progressPort = installationToWatch.mcpMetadata.port;
  const installationId = installationToWatch.installationInfo.id;

  try {
    // Poll for progress updates
    let isComplete = false;
    let hasConnected = false;

    while (!isComplete) {
      try {
        const progressUrl = installationId === 'ready'
          ? `http://localhost:${progressPort}/progress`
          : `http://localhost:${progressPort}/progress?installationId=${installationId}`;

        const progressResponse = await fetch(progressUrl);

        if (!progressResponse.ok) {
          throw new Error(
            "MCP server not running or progress server not available"
          );
        }

        const progress = await progressResponse.json();

        if (!hasConnected) {
          hasConnected = true;
          console.log("Connected to MCP server status");
        }

        onStepFinish({
          text: progress.text,
          finishReason: progress.isComplete ? "stop" : undefined,
          toolCalls: [],
          toolResults: [],
          usage: {},
        });

        isComplete = progress.isComplete;

        if (progress.error) {
          console.log("Installation completed with error:", progress.error);
          Logger.logError("MCP installation completed with error", progress.error, {
            progressPort,
            stage: "mcp_monitoring"
          });
          isComplete = true;
        }

        if (!isComplete) {
          // Wait before next poll
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (fetchError) {
        if (
          fetchError instanceof Error &&
          fetchError.message.includes("fetch")
        ) {
          Logger.logError("MCP server not running", fetchError, {
            progressPort,
            stage: "mcp_connection"
          });

          onStepFinish({
            text: "MCP server not running. Please start it with 'sourcewizard mcp' first.",
            finishReason: "stop",
            toolCalls: [],
            toolResults: [],
            usage: {},
          });
          throw new Error(
            "MCP server not running. Please start it with 'sourcewizard mcp' first."
          );
        }

        Logger.logError("MCP status monitoring error", fetchError, {
          progressPort,
          stage: "mcp_monitoring"
        });
        throw fetchError;
      }
    }

    console.log("Status monitoring completed");
    return { success: true };
  } catch (error) {
    console.error("Error monitoring MCP status:", error);
    Logger.logError("MCP status monitoring failed", error, {
      progressPort,
      stage: "mcp_monitoring_overall"
    });
    throw error;
  }
}
