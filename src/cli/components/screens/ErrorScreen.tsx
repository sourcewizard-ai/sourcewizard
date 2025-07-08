import React from "react";
import { Text, useInput } from "ink";
import type { PageMetadata } from "../types.js";

interface ErrorScreenProps {
  title: string;
  message: string;
  onContinue: () => void;
}

export const getErrorMetadata = (title: string): PageMetadata => ({
  title: "MCP Package Manager - Error",
  menuTitle: `⚠ ${title}`,
  menuWidth: 60,
  borderColor: "red"
});

export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  title,
  message,
  onContinue,
}) => {
  useInput((input, key) => {
    if (key.return || input) {
      onContinue();
    }
  });

  return (
    <>
      {message.split("\n").map((line, i) => (
        <Text key={i} color="white">
          {line}
        </Text>
      ))}
      <Text> </Text>
      <Text color="yellow" bold>
        Press any key to continue...
      </Text>
    </>
  );
}; 