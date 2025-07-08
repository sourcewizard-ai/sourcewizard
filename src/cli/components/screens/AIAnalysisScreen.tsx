import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { PageMetadata } from "../types.js";

interface AIAnalysisScreenProps {
  context: any;
  onComplete: () => void;
}

export const aiAnalysisMetadata: PageMetadata = {
  title: "MCP Package Manager - AI Analysis",
  menuTitle: "AI Context Detection",
  menuWidth: 65,
  borderColor: "cyan"
};

export const AIAnalysisScreen: React.FC<AIAnalysisScreenProps> = ({
  context,
  onComplete,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnalyzing(false);
      setTimeout(onComplete, 1000);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <>
      <Text color="white">AI Project Analysis Results:</Text>
      <Text> </Text>
      <Box borderStyle="single" borderColor="gray" padding={1}>
        <Box flexDirection="column">
          <Text color="white">
            Project Type:{" "}
            <Text color="cyan">{context.projectType || "Unknown"}</Text>
          </Text>
          <Text color="white">
            Framework:{" "}
            <Text color="cyan">{context.framework || "None"}</Text>
          </Text>
          <Text color="white">
            Language:{" "}
            <Text color="cyan">{context.language || "Unknown"}</Text>
          </Text>
          <Text color="white">
            Pkg Manager:{" "}
            <Text color="cyan">{context.packageManager || "Unknown"}</Text>
          </Text>
        </Box>
      </Box>
      <Text> </Text>
      <Text color="gray">
        The AI has analyzed your project and will provide
      </Text>
      <Text color="gray">optimized installation instructions.</Text>
      <Text> </Text>
      {isAnalyzing ? (
        <Box justifyContent="center">
          <Text color="cyan">
            {/* <Spinner type="dots" /> AI analyzing... */}
            AI analyzing...
          </Text>
        </Box>
      ) : (
        <Box justifyContent="center">
          <Text color="green">✓ Analysis complete!</Text>
        </Box>
      )}
    </>
  );
}; 