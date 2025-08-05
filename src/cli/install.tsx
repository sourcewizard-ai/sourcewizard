import { withFullScreen } from "fullscreen-ink";
import { AppLayout } from "./components/layout/AppLayout";
import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Link from "ink-link";
import { ProgressBar } from "./components/ui/ProgressBar";
import { Input } from "./components/ui/Input";
import { install, watchMCPStatus } from "./agent";
import { Logger } from "../shared/logger.js";

interface AppProps {
  packageName: string;
  jwt?: string;
  useMCP?: boolean;
}

const App: React.FC<AppProps> = ({
  packageName,
  jwt,
  useMCP = false,
}: AppProps) => {
  const [stage, setStage] = useState("start");
  const [value, setValue] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [maxSteps, setMaxSteps] = useState(10); // Default estimate
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (stage === "start") {
      (async () => {
        if (useMCP) {
          // Initialize MCP monitoring state
          setProgress(10); // Start with 10% to show activity
          setCurrentStep(1);
          setMaxSteps(1);
        } else {
          // Initialize installation state
          setProgress(0);
          setCurrentStep(0);
        }
        
        try {
          if (useMCP) {
            // Watch MCP status instead of triggering installation
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
              }
            );
          } else {
            await install(
              packageName,
              process.cwd(),
              ({ text, toolCalls, toolResults, finishReason, usage }) => {
                // Update stage text
                setStage(text || "Thinking...");

                // Track step progress
                setCurrentStep((prev) => {
                  const newStep = prev + 1;

                  // Update max steps estimate if we're getting close
                  setMaxSteps((currentMax) => {
                    const updatedMax =
                      newStep >= currentMax * 0.8 ? currentMax + 5 : currentMax;
                    // Update progress percentage with current values
                    setProgress(Math.min((newStep / updatedMax) * 100, 95)); // Cap at 95% until complete
                    return updatedMax;
                  });

                  return newStep;
                });

                // Check if installation is complete
                if (finishReason === "stop" || finishReason === "length") {
                  setIsComplete(true);
                  setProgress(100);
                  setStage("Installation complete!");
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
            stage: "installation"
          });
        }
      })();
    }
  }, [stage]);

  // Remove the old time-based progress tracking

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
              ? "Watching MCP Status"
              : `Installing Package: ${packageName}`}
          </Text>
        </Box>
        <Box flexDirection="column" paddingLeft={2}>
          <Box width={50} height={8} flexWrap="wrap" overflow="hidden">
            <Text color="black">
              {useMCP
                ? "Monitoring installation progress from MCP server..."
                : "Please sit back and relax while the agent integrates the package."}
            </Text>
            <Text color="black"> </Text>
            <Text color="black">
              Status: {stage} {packageName && `(${packageName})`}
            </Text>
            <Text color="black">
              {useMCP 
                ? (isComplete ? "Complete" : "In Progress...")
                : `Step: ${currentStep} / ${maxSteps} ${isComplete ? "(Complete)" : ""}`
              }
            </Text>
          </Box>
          <ProgressBar current={progress} total={100} width="90%" />
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
          {installStage(packageName)}
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
