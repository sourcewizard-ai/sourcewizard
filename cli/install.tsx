import { withFullScreen } from "fullscreen-ink";
import { AppLayout } from "./components/layout/AppLayout";
import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Link from "ink-link";
import { ProgressBar } from "./components/ui/ProgressBar";
import { Input } from "./components/ui/Input";
import { install, watchMCPStatus, listInstallations, DiscoveredInstallation } from "./agent";
import { Logger } from "../lib/logger.js";
import { InstallationSelection } from "./components/InstallationSelection.js";

interface AppProps {
  packageName: string;
  jwt?: string;
  useMCP?: boolean;
}

function getStageDisplayName(stage: string, description?: string): string {
  const stageNames: Record<string, string> = {
    'thinking': 'Analyzing',
    'reading_file': 'Reading file',
    'reading_dir': 'Reading directory',
    'writing_file': 'Writing file',
    'creating_file': 'Creating file',
    'completed': 'Completed'
  };

  const displayName = stageNames[stage] || stage;
  return description ? `${displayName}: ${description}` : displayName;
}


const App: React.FC<AppProps> = ({
  packageName,
  jwt,
  useMCP = false,
}: AppProps) => {
  const [stage, setStage] = useState("start");
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [stageDescription, setStageDescription] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [progress, setProgress] = useState(0);
  const [llmCallsCount, setLlmCallsCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [availableInstallations, setAvailableInstallations] = useState<DiscoveredInstallation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<DiscoveredInstallation | null>(null);
  const [showingSelection, setShowingSelection] = useState(false);

  useEffect(() => {
    if (stage === "start") {
      (async () => {
        if (useMCP) {
          // First, discover available installations
          try {
            setStage("Discovering installations...");
            const installations = await listInstallations();
            setAvailableInstallations(installations);

            if (installations.length === 0) {
              setStage("No MCP installations found");
              setIsComplete(true);
              return;
            } else if (installations.length === 1) {
              // Only one installation, select it automatically
              setSelectedInstallation(installations[0]);
              setStage("monitoring");
            } else {
              // Multiple installations, show selection UI
              setShowingSelection(true);
              setStage("selection");
            }
          } catch (error) {
            setStage("Failed to discover installations");
            setIsComplete(true);
            return;
          }
        } else {
          // Initialize installation state
          setProgress(0);
          setLlmCallsCount(0);
          setStage("Starting installation...");
        }
      })();
    }
  }, [stage]);

  // Separate effect for monitoring once an installation is selected
  useEffect(() => {
    if (stage === "monitoring" || stage === "Starting installation...") {
      (async () => {
        if (useMCP) {
          // Initialize MCP monitoring state
          setProgress(10); // Start with 10% to show activity
        } else {
          // Initialize installation state
          setProgress(10); // Start with some progress to show activity
          setLlmCallsCount(0);
        }

        try {
          if (useMCP) {
            // Watch MCP status for the selected installation
            await watchMCPStatus(
              ({ text, toolCalls, toolResults, finishReason, usage }) => {
                // Update stage text only
                setStage(text || "Watching status...");

                // Check if monitoring is complete
                if (finishReason === "stop" || finishReason === "length") {
                  setIsComplete(true);
                  setProgress(100);
                  setStage(text || "Installation complete!");
                } else {
                  // For MCP, only move progress bar if not in ready state
                  if (!text || !text.toLowerCase().includes('ready')) {
                    // Show gradual progress to indicate activity
                    setProgress(prev => Math.min(prev + 2, 90)); // Gradually increase up to 90%
                  }
                }
              },
              selectedInstallation // Pass the selected installation
            );
          } else {
            await install(
              packageName,
              process.cwd(),
              (stepData) => {
                const { text, toolCalls, toolResults, finishReason, usage, stage: installStage, description } = stepData;

                // Increment LLM calls count for progress tracking
                setLlmCallsCount((prev) => {
                  const newCount = prev + 1;
                  // Calculate progress based on LLM calls (each call represents progress)
                  // Start at 10%, increment by 8% per call, cap at 90% until completion
                  const progressIncrement = Math.min(10 + (newCount * 8), 90);
                  setProgress(progressIncrement);
                  return newCount;
                });

                // Update stage information from structured data
                if (installStage && description) {
                  setCurrentStage(installStage);
                  setStageDescription(description);
                  setStage(getStageDisplayName(installStage, description));
                  
                  // Set progress to 100% when stage is completed
                  if (installStage === 'completed') {
                    setProgress(100);
                  }
                } else {
                  // Fallback to text-based stage
                  setStage(text || "Thinking...");
                  setCurrentStage(null);
                  setStageDescription(null);
                }

                // Check if installation is complete
                if (finishReason === "stop" || finishReason === "length") {
                  setIsComplete(true);
                  setProgress(100);
                  setStage("Installation complete!");
                  setCurrentStage("completed");
                  setStageDescription("Package installed successfully");
                  Logger.logInstallationSuccess(packageName, { jwt: !!jwt, finishReason, usage });
                }
              },
              jwt
            );
          }
        } catch (error) {
          setStage("Installation failed");
          setIsComplete(true);

          // Log the installation error with context
          Logger.logInstallationError(packageName, error, {
            jwt: !!jwt,
            useMCP,
            cwd: process.cwd(),
            stage: useMCP ? "mcp_monitoring" : "installation"
          });
        }
      })();
    }
  }, [stage, selectedInstallation]);

  const handleInstallationSelect = (installation: DiscoveredInstallation) => {
    setSelectedInstallation(installation);
    setShowingSelection(false);
    setStage("monitoring");
  };

  const selectionStage = () => {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <InstallationSelection
          installations={availableInstallations}
          onSelect={handleInstallationSelect}
        />
      </Box>
    );
  };

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
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box paddingY={1}>
          <Text color="black" bold>
            {useMCP
              ? `Installing: ${selectedInstallation?.displayName || "Installing package"}`
              : `Installing: ${packageName}`}
          </Text>
        </Box>
        <Box flexDirection="column" paddingLeft={2}>
          <Box width={50} height={6} flexWrap="wrap" overflow="hidden">
            <Text color="black">
              {useMCP
                ? selectedInstallation
                  ? `Monitoring ${selectedInstallation.installationInfo.packageName} installation...`
                  : "Monitoring installation progress from MCP server..."
                : "Please sit back and relax while the agent integrates the package."}
            </Text>
            <Text color="black"> </Text>
            <Text color="black">
              Status: {stage}
            </Text>
            {currentStage && (
              <Text color="black">
                Current Stage: {getStageDisplayName(currentStage)}
              </Text>
            )}
            {stageDescription && (
              <>
                <Text color="black">
                  Working on: {stageDescription}
                </Text>
                <Text color="black"> </Text>
              </>
            )}
            <Text color="black">
              {isComplete ? "Complete" : "In Progress..."}
            </Text>
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
          {/* {apiKeyStage()} */}
          {showingSelection ? selectionStage() : installStage(packageName)}
        </Box>
      </Box>
    </AppLayout>
  );
};

export function renderInstall(packageName: string, jwt?: string) {
  withFullScreen(
    <App packageName={packageName} jwt={jwt} useMCP={false} />
  ).start();
}

export function renderMCPStatus(packageName: string, jwt?: string) {
  withFullScreen(
    <App packageName={packageName} jwt={jwt} useMCP={true} />
  ).start();
}
