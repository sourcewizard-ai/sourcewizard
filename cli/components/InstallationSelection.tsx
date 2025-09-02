import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { DiscoveredInstallation } from '../agent.js';

interface Props {
  installations: DiscoveredInstallation[];
  onSelect: (installation: DiscoveredInstallation) => void;
}

export function InstallationSelection({ installations, onSelect }: Props) {
  const items = installations.map((installation, index) => {
    return {
      key: `${installation.mcpMetadata.pid}-${installation.installationInfo.id}`,
      label: installation.displayName,
      value: installation
    };
  });

  const handleSelect = (item: { label: string; value: DiscoveredInstallation }) => {
    onSelect(item.value);
  };

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box paddingY={1}>
        <Text color="black" bold>
          Select Installation to Monitor
        </Text>
      </Box>
      <Box>
        <Text color="black">
          Multiple MCP installations found. Please select one to follow:
        </Text>
      </Box>
      <Box marginTop={1} paddingLeft={2}>
        <SelectInput 
          items={items} 
          onSelect={handleSelect}
          limit={8}
          indicatorComponent={({ isSelected }) => (
            <Text color={isSelected ? "black" : "black"}>
              {isSelected ? ">" : " "}
            </Text>
          )}
          itemComponent={({ isSelected, label }) => (
            <Text color="black" backgroundColor={isSelected ? "white" : undefined}>
              {label}
            </Text>
          )}
        />
      </Box>
    </Box>
  );
}