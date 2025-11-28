import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { DiscoveredInstallation } from '../agent.js';

interface Props {
  installations: DiscoveredInstallation[];
  onSelect: (installation: DiscoveredInstallation) => void;
}

export default function InstallationSelector({ installations, onSelect }: Props) {
  const items = installations.map((installation, index) => {
    return {
      label: installation.displayName,
      value: installation
    };
  });

  const handleSelect = (item: { label: string; value: DiscoveredInstallation }) => {
    onSelect(item.value);
  };

  return (
    <Box flexDirection="column">
      <Text>
        Multiple MCP installations found. Please select one to follow:
      </Text>
      <Box marginTop={1}>
        <SelectInput items={items} onSelect={handleSelect} limit={8} />
      </Box>
    </Box>
  );
}