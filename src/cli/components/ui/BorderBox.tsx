import React from "react";
import { Box, Text } from "ink";

interface BorderBoxProps {
  children: React.ReactNode;
  borderStyle?: "single" | "double" | "round" | "bold" | "singleDouble" | "doubleSingle" | "classic";
  borderColor?: string;
  backgroundColor?: string;
  padding?: number;
  width?: number | string;
  height?: number | string;
  title?: string;
  titleColor?: string;
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
}

export const BorderBox: React.FC<BorderBoxProps> = ({
  children,
  borderStyle = "single",
  borderColor = "white",
  backgroundColor,
  padding = 2,
  width,
  height,
  title,
  titleColor = "white",
  alignItems = "center",
}) => {
  return (
    <Box
      borderStyle={borderStyle}
      borderColor={borderColor}
      backgroundColor={backgroundColor}
      padding={padding}
      width={width}
      height={height}
      flexDirection="column"
      alignItems={alignItems}
    >
      {title && (
        <>
          <Text color={titleColor} bold>
            {title}
          </Text>
          <Text> </Text>
        </>
      )}
      {children}
    </Box>
  );
}; 