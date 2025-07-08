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
  borderColor = "cyan",
}) => {
  return (
    // <Box flexDirection="column" height="100%">
    //   {/* Header */}
    //   <Box
    //     backgroundColor="blue"
    //     borderStyle="double"
    //     borderColor="blue"
    //     padding={1}
    //     justifyContent="center"
    //   >
    //     <Text color="white" bold>
    //       {title}
    //     </Text>
    //   </Box>

    // {/* Main content area with gradient background */}
    <Box
      flexDirection="column"
      height="100%"
      width="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor="linear-gradient"
    >
      {/* Menu Box Container */}
      <Box>
        <Box backgroundColor="#000" paddingRight={1} paddingBottom={1}>
          <Box flexDirection="column" backgroundColor="#C0C7C8" padding={2}>
            {children}
          </Box>
        </Box>
      </Box>
      {/* <Box
        backgroundColor="gray"
        // borderStyle="single"
        // borderColor={borderColor}
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
      </Box> */}
    </Box>
    // </Box>
  );
};
