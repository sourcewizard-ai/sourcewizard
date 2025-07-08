import React from "react";
import { Box, Text } from "ink";

interface PageLayoutProps {
  title: string;
  titleColor?: string;
  borderColor?: string;
  children: React.ReactNode;
  padding?: number;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  titleColor = "blue",
  borderColor = "blue",
  children,
  padding = 2,
}) => {
  return (
    <Box flexDirection="column" height="100%" padding={padding}>
      <Box
        borderStyle="double"
        borderColor={borderColor}
        padding={1}
        marginBottom={2}
        justifyContent="center"
      >
        <Text color="white" bold>
          {title}
        </Text>
      </Box>
      {children}
    </Box>
  );
}; 