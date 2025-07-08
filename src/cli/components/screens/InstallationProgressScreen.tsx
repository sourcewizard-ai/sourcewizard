import React from "react";
import { Box, Text } from "ink";
import { ProgressBar } from "../ui/index.js";
import type { PageMetadata } from "../types.js";

interface InstallationProgressScreenProps {
  packageName: string;
  step: number;
  steps: string[];
}

export const installationProgressMetadata: PageMetadata = {
  title: "MCP Package Manager - Installing",
  menuTitle: "Installation in Progress",
  menuWidth: 60,
  borderColor: "cyan",
};

export const InstallationProgressScreen: React.FC<
  InstallationProgressScreenProps
> = ({ packageName, step, steps }) => {
  return (
    <Box flexDirection="column" justifyContent="center">
      <Text color="white">
        Installing package:{" "}
        <Text color="green" bold>
          {packageName}
        </Text>
      </Text>
      <Text> </Text>
      <Text color="gray">Please wait while the package is being installed</Text>
      <Text color="gray">and configured for your project...</Text>
      <Text> </Text>
      <Text color="white">
        Current step: {step}/{steps.length}
      </Text>
      <Text color="yellow">{steps[step - 1]}</Text>
      <Text> </Text>
      <ProgressBar current={step} total={steps.length} width="100%" />
    </Box>
  );
};
