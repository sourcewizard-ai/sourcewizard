import { withFullScreen } from "fullscreen-ink";
import { AppLayout } from "./components/layout/AppLayout";
import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import Link from "ink-link";
import { ProgressBar } from "./components/ui/ProgressBar";
import { Input } from "./components/ui/Input";
import { install, watchMCPStatus, listInstallations, DiscoveredInstallation } from "./agent";
import { Logger } from "../lib/logger.js";
import { InstallationSelection } from "./components/InstallationSelection.js";

// Global installation state for signal handling
let isInstallationInProgress = false;
let currentInstallationPromise: Promise<void> | null = null;

// Global signal handler
const handleTermination = () => {
  if (isInstallationInProgress) {
    console.log("\n\nInstallation cancelled by user.");
    process.exit(0);
  }
};

process.on('SIGINT', handleTermination);
process.on('SIGTERM', handleTermination);

// Common interface for installation progress updates
interface InstallationProgressUpdate {
  text?: string;
  toolCalls?: any[];
  toolResults?: any[];
  finishReason?: string;
  usage?: any;
  stage?: string;
  description?: string;
  progress?: number; // Progress percentage from MCP server
  error?: string; // Error message if installation failed
  isError?: boolean; // Whether this is an error update
}

// Common interface for installation provider
interface InstallationProvider {
  start(callback: (update: InstallationProgressUpdate) => void): Promise<void>;
}

interface AppProps {
  packageName: string;
  jwt?: string;
  installationProvider: InstallationProvider;
}

function getStageDisplayName(stage: string, description?: string): string {
  const stageNames: Record<string, string> = {
    'thinking': 'Analyzing',
    'reading_file': 'Reading file',
    'reading_dir': 'Reading directory',
    'writing_file': 'Writing file',
    'creating_file': 'Creating file',
    'running_command': 'Running command',
    'completed': 'Completed',
    'failed': 'Failed',
    'waiting': 'Ready'
  };

  const displayName = stageNames[stage] || stage;
  return description ? `${displayName}: ${description}` : displayName;
}

// MCP Installation App that handles selection flow
const MCPInstallApp: React.FC<{ packageName: string; jwt?: string }> = ({ packageName, jwt }) => {
  const [stage, setStage] = useState<'discovering' | 'selecting' | 'installing'>('discovering');
  const [installations, setInstallations] = useState<DiscoveredInstallation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<DiscoveredInstallation | null>(null);

  useEffect(() => {
    if (stage === 'discovering') {
      (async () => {
        try {
          const discovered = await listInstallations();
          setInstallations(discovered);

          if (discovered.length === 0) {
            setStage('installing'); // No installations, proceed directly
          } else if (discovered.length === 1) {
            setSelectedInstallation(discovered[0]);
            setStage('installing'); // Single installation, auto-select
          } else {
            setStage('selecting'); // Multiple installations, show selection
          }
        } catch (error) {
          console.error('Error discovering installations:', error);
          setStage('installing'); // Fallback to direct installation
        }
      })();
    }
  }, [stage]);

  const handleInstallationSelect = (installation: DiscoveredInstallation) => {
    setSelectedInstallation(installation);
    setStage('installing');
  };

  if (stage === 'discovering') {
    return (
      <AppLayout title="Install">
        <Box flexDirection="column" paddingLeft={2}>
          <Box paddingY={1}>
            <Text color="black" bold>
              Discovering MCP Installations...
            </Text>
          </Box>
          <Box>
            <Text color="black">
              Please wait while we scan for available MCP installations.
            </Text>
          </Box>
        </Box>
      </AppLayout>
    );
  }

  if (stage === 'selecting') {
    return (
      <AppLayout title="Install">
        <Box flexDirection="row">
          <Box width="2%" flexDirection="column">
            <Box flexGrow={1} paddingY={7}></Box>
          </Box>
          <Box width="98%" flexDirection="column">
            <InstallationSelection
              installations={installations}
              onSelect={handleInstallationSelect}
            />
          </Box>
        </Box>
      </AppLayout>
    );
  }

  // Installing stage - use the package name from the selected installation if available
  const provider = new MCPInstallationProvider(selectedInstallation);
  const actualPackageName = selectedInstallation?.installationInfo.packageName || packageName || 'Unknown Package';
  return <App packageName={actualPackageName} jwt={jwt} installationProvider={provider} />;
};

const App: React.FC<AppProps> = ({
  packageName,
  jwt,
  installationProvider,
}: AppProps) => {
  const [stage, setStage] = useState("start");
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [stageDescription, setStageDescription] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [progress, setProgress] = useState(0);
  const [llmCallsCount, setLlmCallsCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [installationPromise, setInstallationPromise] = useState<Promise<void> | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (stage === "start") {
      // Initialize installation state
      setProgress(0);
      setLlmCallsCount(0);
      setStage("Starting installation...");
    }
  }, [stage]);


  // Start installation when stage changes to "Starting installation..."
  useEffect(() => {
    if (stage === "Starting installation...") {
      (async () => {
        // Initialize installation state
        setProgress(10); // Start with some progress to show activity
        setLlmCallsCount(0);

        try {
          isInstallationInProgress = true;
          const installPromise = installationProvider.start((update: InstallationProgressUpdate) => {
            const { text, toolCalls, toolResults, finishReason, usage, stage: installStage, description, progress: serverProgress, error, isError } = update;

            // Check for errors first
            if (isError || error) {
              console.log('Installation error detected:', { error, isError, installStage });
              isInstallationInProgress = false;
              setIsComplete(true);
              setProgress(0);
              setStage("Installation failed!");
              setCurrentStage("failed");
              setStageDescription(error || "Installation failed");
              Logger.logInstallationError(packageName, new Error(error || "Installation failed"), {
                jwt: !!jwt,
                cwd: process.cwd(),
                stage: "installation"
              });
              return;
            }

            // Check if installation is complete 
            if (finishReason === "stop" || finishReason === "length" || installStage === 'completed') {
              console.log('Installation completed detected:', { finishReason, installStage });
              isInstallationInProgress = false;
              setIsComplete(true);
              setProgress(100);
              setStage("Installation complete!");
              setCurrentStage("completed");
              setStageDescription("Package installed successfully");
              Logger.logInstallationSuccess(packageName, { jwt: !!jwt, finishReason, usage });
            } else {
              // Update stage information from structured data
              if (installStage && description) {
                setCurrentStage(installStage);
                setStageDescription(description);
                setStage(getStageDisplayName(installStage, description));

                // Use server progress if available, otherwise calculate based on LLM calls
                if (serverProgress !== undefined) {
                  setProgress(serverProgress);
                  // Reset LLM counter if we're using server progress
                  if (installStage === 'waiting' || serverProgress === 0) {
                    setLlmCallsCount(0);
                  }
                } else {
                  // Only increment progress if not completed
                  setLlmCallsCount((prev) => {
                    const newCount = prev + 1;
                    // Calculate progress based on LLM calls (each call represents progress)
                    // Start at 10%, increment by 2% per call, cap at 99% until completion
                    const progressIncrement = Math.min(10 + (newCount * 2), 99);
                    setProgress(progressIncrement);
                    return newCount;
                  });
                }
              } else {
                // Fallback to text-based stage - still increment calls count
                setStage(text || "Thinking...");
                setCurrentStage(null);
                setStageDescription(null);

                // Use server progress if available, otherwise calculate based on LLM calls
                if (serverProgress !== undefined) {
                  setProgress(serverProgress);
                } else {
                  setLlmCallsCount((prev) => {
                    const newCount = prev + 1;
                    const progressIncrement = Math.min(10 + (newCount * 2), 99);
                    setProgress(progressIncrement);
                    return newCount;
                  });
                }
              }
            }
          });
          setInstallationPromise(installPromise);
          currentInstallationPromise = installPromise;
          await installPromise;
          isInstallationInProgress = false;
        } catch (error) {
          isInstallationInProgress = false;
          setStage("Installation failed");
          setIsComplete(true);

          // Log the installation error with context
          Logger.logInstallationError(packageName, error, {
            jwt: !!jwt,
            cwd: process.cwd(),
            stage: "installation"
          });
        }
      })();
    }
  }, [stage, packageName, jwt, installationProvider]);

  // Handle exit animation
  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        process.exit(0);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isExiting]);


  const apiKeyStage = () => {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box paddingY={1}>
          <Text color="black" bold>
            Insert API Key
          </Text>
        </Box>
        <Box>
          <Text color="black">
            This tool requires an API key. Visit https://dashboard.clerk.com/
            and insert the API token here and press Enter to continue:
          </Text>
        </Box>
        <Box>
          <Input
            onSubmit={setValue}
            color="black"
            backgroundColor="#ffffff"
            width="90%"
            secret
          />
        </Box>
      </Box>
    );
  };

  const installStage = (packageName: string) => {
    if (isComplete) {
      const isSuccess = currentStage === "completed";
      // Completion dialog
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Box paddingY={1} justifyContent="center">
            <Text color="black" bold>
              {isSuccess ? "Installation Complete!" : "Installation Failed!"}
            </Text>
          </Box>
          <Box flexDirection="column" paddingLeft={2}>
            <Box paddingY={1} justifyContent="center">
              <Text color="black">
                {isSuccess
                  ? `${packageName} has been successfully installed and configured.`
                  : `Failed to install ${packageName}. ${stageDescription || 'Please check the error logs.'}`
                }
              </Text>
            </Box>
            <Box paddingY={1} justifyContent="center">
              <Text color="black">
                Press Enter to continue or Ctrl+C to exit.
              </Text>
            </Box>
            <Box paddingTop={1} justifyContent="center">
              <Box backgroundColor={isExiting ? "#C0C7C8" : "#000"} paddingRight={1} paddingBottom={1}>
                <Box
                  backgroundColor="#E0E0E0"
                  marginLeft={isExiting ? 0 : -1}
                  marginTop={isExiting ? 1 : 0}
                  paddingX={3}
                  paddingY={1}
                  justifyContent="center"
                >
                  <Text color="black" bold>
                    Exit the setup
                  </Text>
                </Box>
              </Box>
            </Box>
            <Box marginLeft={-1000} height={0} overflow="hidden">
              <Input
                onSubmit={() => setIsExiting(true)}
              />
            </Box>
          </Box>
        </Box>
      );
    }

    // Installation in progress
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box paddingY={1}>
          <Text color="black" bold>
            Installing: {packageName}
          </Text>
        </Box>
        <Box flexDirection="column" paddingLeft={2}>
          <Box flexDirection="column" width={50} height={6}>
            <Box>
              <Text color="black">
                Please sit back and relax while the agent integrates the package.
              </Text>
            </Box>
            {currentStage && (
              <Box>
                <Text color="black">
                  Current Stage: {getStageDisplayName(currentStage)}
                </Text>
              </Box>
            )}
            {stageDescription && (
              <Box>
                <Text color="black">
                  Working on: {stageDescription}
                </Text>
              </Box>
            )}
            <Box>
              <Text color="black">
                In Progress...
              </Text>
            </Box>
          </Box>
          <Box paddingTop={1}>
            <ProgressBar current={progress} total={100} width="90%" />
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <AppLayout title="Install">
      <Box flexDirection="row">
        <Box width="2%" flexDirection="column">
          <Box flexGrow={1} paddingY={7}></Box>
        </Box>
        <Box width="98%" flexDirection="column">
          {installStage(packageName)}
        </Box>
      </Box>
    </AppLayout>
  );
};

// Local installation provider
class LocalInstallationProvider implements InstallationProvider {
  constructor(
    private packageName: string,
    private cwd: string,
    private jwt?: string
  ) { }

  async start(callback: (update: InstallationProgressUpdate) => void): Promise<void> {
    await install(this.packageName, this.cwd, callback, this.jwt);
  }
}

// MCP installation provider
class MCPInstallationProvider implements InstallationProvider {
  constructor(private selectedInstallation?: DiscoveredInstallation) { }

  async start(callback: (update: InstallationProgressUpdate) => void): Promise<void> {
    await watchMCPStatus(callback, this.selectedInstallation);
  }
}

export function renderInstall(packageName: string, jwt?: string) {
  const provider = new LocalInstallationProvider(packageName, process.cwd(), jwt);

  withFullScreen(
    <App packageName={packageName} jwt={jwt} installationProvider={provider} />
  ).start();
}

export function renderMCPStatus(packageName: string, jwt?: string) {
  // For MCP, we need to discover installations and show selection UI
  withFullScreen(
    <MCPInstallApp packageName={packageName} jwt={jwt} />
  ).start();
}
