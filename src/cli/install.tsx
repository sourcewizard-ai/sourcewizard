import { withFullScreen } from "fullscreen-ink";
import { AppLayout } from "./components/layout/AppLayout";
import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Link from "ink-link";
import { ProgressBar } from "./components/ui/ProgressBar";
import { Input } from "./components/ui/Input";
import { install } from "./agent";

interface AppProps {
  packageName: string;
}

const App: React.FC<AppProps> = ({ packageName }: AppProps) => {
  const [stage, setStage] = useState("start");
  const [value, setValue] = useState("");
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (stage === "start") {
      (async () => {
        setProgress(0);
        await install(
          packageName,
          process.cwd(),
          ({ text, toolCalls, toolResults, finishReason, usage }) => {
            // TODO: Handle step results
            setStage(text || "Thinking...");
          }
        );
      })();
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== "start") {
      let step = 0;
      const totalSteps = 60;
      setProgress(0);
      const interval = setInterval(() => {
        step += 1;
        setProgress((step / totalSteps) * 100);
        if (step >= totalSteps) {
          clearInterval(interval);
          setStage("done");
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [stage === "start"]); // Only trigger when we move away from "start"

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
            Installing Package: {packageName}
          </Text>
        </Box>
        <Box flexDirection="column" paddingLeft={2}>
          <Box width={50} height={8} flexWrap="wrap" overflow="hidden">
            <Text color="black">
              Please sit back and relax while the agent integrates the package.
            </Text>
            <Text color="black"> </Text>
            <Text color="black">Status: {stage}</Text>
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

export function renderInstall(packageName: string) {
  withFullScreen(<App packageName={packageName} />).start();
}
