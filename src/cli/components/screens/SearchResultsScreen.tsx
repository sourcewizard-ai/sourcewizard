import React from "react";
import { Box, Text, useInput } from "ink";
import type { PageMetadata } from "../types.js";

interface SearchResultsScreenProps {
  results: any[];
  query: string;
  onContinue: () => void;
}

export const getSearchResultsMetadata = (query: string, resultsCount: number): PageMetadata => ({
  title: `MCP Package Manager - Search Results for: ${query}`,
  menuTitle: `Found ${resultsCount} Results`,
  menuWidth: 80,
  borderColor: "cyan"
});

export const SearchResultsScreen: React.FC<SearchResultsScreenProps> = ({
  results,
  query,
  onContinue,
}) => {
  useInput((input, key) => {
    if (key.return || input) {
      onContinue();
    }
  });

  return (
    <>
      {results.slice(0, 8).map((item, i) => {
        const name = item.name || item.id || "Unknown";
        const type = item.version ? "PKG" : "SNP";
        const desc = (item.description || "").substring(0, 45);
        return (
          <Box key={i} marginBottom={1}>
            <Text color="white">{i + 1}. </Text>
            <Text color="cyan">[{type}] </Text>
            <Text color="green">{name.padEnd(20)} </Text>
            <Text color="gray">{desc}</Text>
          </Box>
        );
      })}
      <Text> </Text>
      <Text color="yellow" bold>
        Press any key to continue...
      </Text>
    </>
  );
}; 