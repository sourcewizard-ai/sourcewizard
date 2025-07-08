import React from "react";
import { Text, useInput } from "ink";
import type { PageMetadata } from "../types.js";

interface WelcomeScreenProps {
  onContinue: () => void;
}

export const welcomeMetadata: PageMetadata = {
  title: "MCP Package Manager - Welcome",
  menuTitle: "Welcome to MCP Package Manager Setup",
  menuWidth: 70,
  borderColor: "cyan"
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onContinue,
}) => {
  useInput((input, key) => {
    if (key.return || input) {
      onContinue();
    }
  });

  return (
    <>
      <Text color="gray">
        This program will install packages and code snippets
      </Text>
      <Text color="gray">with AI-powered guidance on your system.</Text>
      <Text> </Text>
      <Text color="cyan">Features:</Text>
      <Text color="green">• Smart package search and installation</Text>
      <Text color="green">• AI-guided project context detection</Text>
      <Text color="green">• Personal code snippet registry</Text>
      <Text color="green">• Support for npm, yarn, pnpm, bun</Text>
      <Text> </Text>
      <Text color="yellow" bold>
        Press any key to continue...
      </Text>
    </>
  );
}; 