import React from "react";
import { Box, Text } from "ink";

interface AppLayoutProps {
  title: string;
  menuTitle?: string;
  children: React.ReactNode;
  menuWidth?: number;
  borderColor?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ 
  title, 
  menuTitle,
  children, 
  menuWidth = 80,
  borderColor = "cyan"
}) => {
  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box
        backgroundColor="blue"
        borderStyle="double"
        borderColor="blue"
        padding={1}
        justifyContent="center"
      >
        <Text color="white" bold>
          {title}
        </Text>
      </Box>

      {/* Main content area with gradient background */}
      <Box 
        flexDirection="column" 
        height="100%" 
        padding={2} 
        backgroundColor="linear-gradient"
      >
        <Box justifyContent="center" alignItems="center" height="100%">
          {/* Menu Box Container */}
          <Box
            backgroundColor="gray"
            borderStyle="single"
            borderColor={borderColor}
            padding={2}
            width={menuWidth}
            flexDirection="column"
          >
            {menuTitle && (
              <>
                <Text color={borderColor} bold>
                  {menuTitle}
                </Text>
                <Text> </Text>
              </>
            )}
            {children}
            <Text> </Text>
            <Text color="gray">
              Use ↑↓ arrows to navigate, ENTER to select, ESC to exit
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}; 