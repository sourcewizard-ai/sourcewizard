import React from "react";
import { Box } from "ink";

interface CenteredLayoutProps {
  children: React.ReactNode;
  width?: number;
  height?: string;
  padding?: number;
}

export const CenteredLayout: React.FC<CenteredLayoutProps> = ({
  children,
  width,
  height = "100%",
  padding = 2,
}) => {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height={height}
      padding={padding}
    >
      {width ? (
        <Box width={width} flexDirection="column" alignItems="center">
          {children}
        </Box>
      ) : (
        children
      )}
    </Box>
  );
}; 