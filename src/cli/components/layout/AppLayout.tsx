import React from "react";
import { Box, Text } from "ink";
import figlet from "figlet";

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
  borderColor = "cyan",
}) => {
  return (
    // {/* Main content area with gradient background */}
    <Box
      flexDirection="column"
      height="100%"
      width="100%"
      //   justifyContent="center"
      //   alignItems="center"
      backgroundColor="linear-gradient"
    >
      <Box position="absolute" flexDirection="column">
        <Text color="white" bold backgroundColor="#0001F2">
          {" "}
        </Text>
        <Text color="white" italic bold backgroundColor="#0001F2">
          &nbsp;SourceWizard&nbsp;
        </Text>
      </Box>
      <Box
        width="100%"
        height="100%"
        justifyContent="center"
        alignItems="center"
      >
        <Box
          backgroundColor="#000"
          paddingRight={1}
          paddingBottom={1}
          width="80%"
        >
          <Box backgroundColor="#C0C7C8" marginLeft={-1} width="100%">
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
