import { NewAgent } from "../install-agent/new-agent.js";
import { Logger } from "../lib/logger.js";
import React from 'react';
import { render } from 'ink';
import InstallationSelector from './components/InstallationSelector.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { analyzeRepositoryV2 } from "../repodetect/index.js";
import ora from 'ora';

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
  const repo = await analyzeRepositoryV2(path);

  const agent = new NewAgent({
    cwd: path,
    projectContext: repo,
    serverUrl: process.env.SOURCEWIZARD_SERVER_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://sourcewizard.ai"),
    jwt: jwt,
    apiKey: process.env.SOURCEWIZARD_API_KEY,
    onStepFinish: (stepData) => {
      // Handle search progress updates - don't render packages here since they'll be rendered at the end
      if (stepData.text && !stepData.packages) {
        console.log(`🔍 ${stepData.text}`);
      }
    }
  });

  const result = await agent.searchPackages(query);

  // Render final search results if we have them
  if (result.packages) {
    renderSearchResults(result.packages, result.query, result.totalAvailable);
  }

  return result;
}

export async function reuse(task: string, path: string, jwt?: string, verbose: boolean = false) {
  const repo = await analyzeRepositoryV2(path);

  const spinner = ora({
    text: 'Analyzing repository...',
    spinner: 'dots',
    discardStdin: false
  }).start();

  // Handle Ctrl+C gracefully
  const handleSigInt = () => {
    spinner.stop();
    console.log('\n\nOperation cancelled by user');
    process.exit(130);
  };
  process.on('SIGINT', handleSigInt);

  try {
    const agent = new NewAgent({
      cwd: path,
      projectContext: repo,
      serverUrl: process.env.SOURCEWIZARD_SERVER_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://sourcewizard.ai"),
      jwt: jwt,
      apiKey: process.env.SOURCEWIZARD_API_KEY,
      onStepFinish: (stepData) => {
        // Handle reuse progress updates
        if (stepData.toolCalls && stepData.toolCalls.length > 0) {
          // Tool is being called
          const toolCall = stepData.toolCalls[0];
          const toolName = toolCall.toolName || toolCall.args?.tool_name;

          // Use stage description if available (more user-friendly), otherwise generate from tool name
          let toolDescription = stepData.description;

          if (!toolDescription && toolName) {
            toolDescription = getToolDescription(toolName, toolCall.args);
          }

          if (!toolDescription) {
            toolDescription = 'Processing...';
          }

          if (verbose) {
            spinner.info(toolDescription);
            spinner.start('Processing...');
          } else {
            spinner.text = toolDescription;
          }
        } else if (stepData.text && !stepData.results) {
          // Text message from agent
          if (verbose) {
            spinner.info(stepData.text);
            spinner.start('Thinking...');
          }
        }
      }
    });

    const result = await agent.checkCodeReusability(task);
    spinner.stop();

    // Display structured results if we have them
    if (result.results) {
      renderReuseResults(result.results, result.task || task);
    } else if (result.text) {
      // Fallback to text display if no structured results
      console.log(`\n${result.text}\n`);
    }

    return result;
  } finally {
    // Clean up signal handler
    process.off('SIGINT', handleSigInt);
    spinner.stop();
  }
}


function getToolDescription(toolName: string, args: any): string {
  switch (toolName) {
    case 'read_file':
      return `Reading file ${args?.path || ''}`;
    case 'list_directory':
    case 'ls':
      return `Listing directory ${args?.path || ''}`;
    case 'write_file':
      return `Writing file ${args?.path || ''}`;
    case 'create_file':
      return `Creating file ${args?.path || ''}`;
    case 'edit_file':
      return `Editing file ${args?.path || ''}`;
    case 'delete_file':
      return `Deleting file ${args?.path || ''}`;
    case 'bash':
      return `Running command: ${args?.command || ''}`;
    case 'glob':
      return `Searching files: ${args?.pattern || ''}`;
    case 'grep':
      return `Searching for: ${args?.pattern || ''}`;
    case 'search_file':
      return `Searching in: ${args?.path || ''}`;
    case 'get_bulk_target_data':
      return 'Analyzing project targets';
    case 'typecheck':
      return `Type checking ${args?.target || 'project'}`;
    case 'add_package':
      return `Adding package: ${args?.packageName || ''}`;
    default:
      return `Executing ${toolName}`;
  }
}

function renderReuseResults(results: any[], task: string) {
  console.log(`\nReuse Results for "${task}":`);
  console.log(`Found ${results.length} reusable code option${results.length !== 1 ? 's' : ''}\n`);

  if (results.length === 0) {
    console.log("No existing code found that matches your requirements.");
    console.log("You may need to implement new code for this functionality.\n");
    return;
  }

  results.forEach((item, index) => {
    // Choose text based on reuse method
    let methodText = '';

    switch (item.reuse_method) {
      case 'import':
        methodText = 'Import';
        break;
      case 'install':
        methodText = 'Install';
        break;
      case 'copy':
        methodText = 'Copy';
        break;
    }

    const displayName = methodText ? `${item.name} [${methodText}]` : item.name;
    console.log(`${index + 1}. ${displayName}`);

    if (item.description) {
      console.log(`   ${item.description}`);
    }

    if (item.reuse_method) {
      console.log(`   Method: ${methodText} - ${getReuseMethodDescription(item.reuse_method)}`);
    }

    if (item.language) {
      console.log(`   Language: ${item.language}`);
    }

    if (item.files && item.files.length > 0) {
      console.log(`   Files: ${item.files.join(', ')}`);
    }

    if (item.target) {
      console.log(`   Target: ${item.target}`);
    }

    if (item.tags && item.tags.length > 0) {
      console.log(`   Tags: ${item.tags.join(', ')}`);
    }

    console.log('');
  });
}

function getReuseMethodDescription(method: string): string {
  switch (method) {
    case 'import':
      return 'Add import statement (minimal changes)';
    case 'install':
      return 'Install package first, then import';
    case 'copy':
      return 'Copy code snippet to your file';
    default:
      return 'Reuse this code';
  }
}

function renderSearchResults(packages: any[], query: string, totalAvailable: number) {
  console.log(`\n🔍 Search Results for "${query}":`);
  console.log(`Found ${packages.length} recommended packages (${totalAvailable} total available)\n`);

  if (packages.length === 0) {
    console.log("No packages found matching your query.");
    return;
  }

  packages.forEach((pkg, index) => {
    const integrationIcon = pkg.has_integration === true ? ' ✓' : (pkg.has_integration === false ? '' : '');
    console.log(`${index + 1}. ${pkg.name}${integrationIcon}`);
    if (pkg.description) {
      console.log(`   ${pkg.description}`);
    }
    if (pkg.has_integration !== undefined) {
      console.log(`   Integration: ${pkg.has_integration ? 'Available' : 'Not available'}`);
    }
    if (pkg.tags && pkg.tags.length > 0) {
      console.log(`   Tags: ${pkg.tags.join(', ')}`);
    }
    if (pkg.language) {
      console.log(`   Language: ${pkg.language}`);
    }
    console.log('');
  });

  console.log(`Use 'sourcewizard install <package-name>' to install a package.`);
}


export async function install(
  name: string,
  path: string,
  onStepFinish: (step: any) => void,
  jwt?: string
) {
  const repo = await analyzeRepositoryV2(path);

  const agent = new NewAgent({
    cwd: path,
    projectContext: repo,
    serverUrl: process.env.SOURCEWIZARD_SERVER_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://sourcewizard.ai"),
    jwt: jwt,
    apiKey: process.env.SOURCEWIZARD_API_KEY,
    onStepFinish: (stepData) => {
      // Pass through the structured data to the UI
      onStepFinish(stepData);
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
    let lastProgressText = "";
    let lastStepCounter = 0;

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

        // Only call onStepFinish if progress has actually changed
        const currentText = progress.text || "";
        const currentStepCounter = progress.step || 0;

        if (currentText !== lastProgressText || currentStepCounter !== lastStepCounter || progress.isComplete) {
          lastProgressText = currentText;
          lastStepCounter = currentStepCounter;

          onStepFinish({
            text: progress.text,
            finishReason: progress.isComplete ? "stop" : undefined,
            toolCalls: progress.toolCalls || [],
            toolResults: progress.toolResults || [],
            usage: progress.usage || {},
            stage: progress.stage,
            description: progress.description,
            progress: progress.progress,
          });
        }

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
