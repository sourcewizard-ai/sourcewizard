import React from "react";
import { Box, Text } from "ink";

interface MenuLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: number;
  borderColor?: string;
  backgroundColor?: string;
  showHelp?: boolean;
  helpText?: string;
}

export const MenuLayout: React.FC<MenuLayoutProps> = ({
  title,
  subtitle,
  children,
  width = 80,
  borderColor = "cyan",
  backgroundColor,
  showHelp = true,
  helpText = "Use ↑↓ arrows to navigate, ENTER to select, ESC to exit",
}) => {
  return (
    <Box justifyContent="center" alignItems="center" height="100%">
      <Box
        backgroundColor={backgroundColor}
        borderStyle="single"
        borderColor={borderColor}
        padding={2}
        width={width}
        flexDirection="column"
      >
        <Text color={borderColor} bold>
          {title}
        </Text>
        {subtitle && (
          <>
            <Text> </Text>
            <Text color="white">{subtitle}</Text>
          </>
        )}
        <Text> </Text>
        {children}
        {showHelp && (
          <>
            <Text> </Text>
            <Text color="gray">{helpText}</Text>
          </>
        )}
      </Box>
    </Box>
  );
}; 