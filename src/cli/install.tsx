import { withFullScreen } from "fullscreen-ink";
import { AppLayout } from "./components/layout/AppLayout";
import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Link from "ink-link";
import { ProgressBar } from "./components/ui";
import { Input } from "./components/ui/Input";

interface AppProps {
  packageName: string;
}

const App: React.FC<AppProps> = ({ packageName }: AppProps) => {
  const [stage, setStage] = useState("start");
  const [value, setValue] = useState("");
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (stage === "start") {
      setStage("installing");
      setProgress(0);
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== "installing") return;
    let step = 0;
    const totalSteps = 5;
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
  }, [stage]);

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

  return (
    <AppLayout title="Install">
      <Box flexDirection="row">
        <Box width="25%" flexDirection="column" backgroundColor="#A1C7EB">
          <Box
            flexGrow={1}
            paddingY={1}
            paddingLeft={2}
            backgroundColor="#0C246C"
          >
            <Text color="#ffffff">Insert API Key</Text>
          </Box>
          <Box flexGrow={1} paddingLeft={2} paddingY={1}>
            <Text color="black">Install Package</Text>
          </Box>
          <Box flexGrow={1} paddingLeft={2} paddingY={1}>
            <Text color="black">Integrate Package</Text>
          </Box>
        </Box>
        <Box width="75%" flexDirection="column">
          {apiKeyStage()}
          {/* <Box>
            <Text color="black">Insert API Key</Text>
          </Box>
          <Text color="black">Installing {packageName}</Text>
          <Text color="black">Stage: {stage}</Text>
          <Text color="black">Query: {value}</Text>
          <ProgressBar current={progress} total={100} width="100%" /> */}
        </Box>
      </Box>
      {/* <Box flexDirection="column" alignItems="center" justifyContent="center">
        <Text color="black">Installing {packageName}</Text>
        <Text color="black">Stage: {stage}</Text>
        <Text color="black">Query: {value}</Text>
        <ProgressBar current={progress} total={100} />
      </Box>
      <Box
        marginLeft={-4}
        marginTop={-8}
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={3}
        paddingRight={3}
        width="110%"
        backgroundColor="cyan"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        position="absolute"
        display={value.length > 0 ? "none" : "flex"}
      >
        <Text color="black">
          This tool requires an API key. Visit https://dashboard.clerk.com/ and
          then insert the API token here:
        </Text>
        <Input
          onSubmit={setValue}
          color="black"
          backgroundColor="#ffffff"
          width="100%"
          secret
        />
        <Text color="black">When you are ready, press enter to continue.</Text>
      </Box> */}
    </AppLayout>
  );
};

export function renderInstall(packageName: string) {
  withFullScreen(<App packageName={packageName} />).start();
}
