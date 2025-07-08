import React from "react";
import SelectInput from "ink-select-input";
import type { PageMetadata } from "../types.js";

interface PackageSelectionScreenProps {
  packages: string[];
  onSelect: (pkg: string) => void;
}

export const packageSelectionMetadata: PageMetadata = {
  title: "MCP Package Manager - Package Selection",
  menuTitle: "Select Package to Install",
  menuWidth: 80,
  borderColor: "cyan"
};

export const PackageSelectionScreen: React.FC<PackageSelectionScreenProps> = ({ 
  packages, 
  onSelect 
}) => {
  const getPackageDescription = (packageName: string): string => {
    const descriptions: Record<string, string> = {
      express: "Fast, unopinionated, minimalist web framework for Node.js",
      react: "A JavaScript library for building user interfaces",
      lodash:
        "A modern JavaScript utility library delivering modularity, performance & extras",
      axios: "Promise based HTTP client for the browser and node.js",
      typescript:
        "TypeScript is a superset of JavaScript that compiles to plain JavaScript",
      webpack: "A bundler for javascript and friends",
      eslint: "Find and fix problems in your JavaScript code",
    };
    return descriptions[packageName] || `Package: ${packageName}`;
  };

  const items = packages.map((pkg) => ({
    label: pkg,
    value: pkg,
    description: getPackageDescription(pkg),
  }));

  return (
    <SelectInput
      items={items}
      onSelect={(item) => onSelect(item.value)}
    />
  );
}; 