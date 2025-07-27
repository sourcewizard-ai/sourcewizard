import React, { useEffect, useState } from "react";
import { Box, Text, useStdout } from "ink";
interface AppLayoutProps {
  title: string;
  menuTitle?: string;
  children: React.ReactNode;
  menuWidth?: number;
  borderColor?: string;
}

function useStdoutDimensions(): [number, number] {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState<[number, number]>([
    stdout.columns,
    stdout.rows,
  ]);

  useEffect(() => {
    const handler = () => setDimensions([stdout.columns, stdout.rows]);
    stdout.on("resize", handler);
    return () => {
      stdout.off("resize", handler);
    };
  }, [stdout]);

  return dimensions;
}

const GradientBox = ({
  height,
  width,
}: {
  height?: number | string;
  width?: number | string;
}) => {
  const [columns, rows] = useStdoutDimensions();
  return (
    <Box
      position="absolute"
      flexDirection="column"
      height={height}
      width={width}
    >
      {Array.from({ length: rows }).map((_, index) => {
        const ratio = index / (rows - 1);
        const r = 0;
        const g = 0;
        const b = Math.floor(255 * (1 - ratio));
        const color = `rgb(${r}, ${g}, ${b})`;
        return (
          <Box key={index}>
            <Text key={index} backgroundColor={color}>
              {Array.from({ length: columns }).map((_, index) => " ")}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  title,
  menuTitle,
  children,
  menuWidth = 80,
  borderColor = "cyan",
}) => {
  return (
    <Box flexDirection="column" height="100%" width="100%">
      <GradientBox />
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
