import React from "react";
import { Box, Text } from "ink";

interface ProgressBarProps {
  current: number;
  total: number;
  width?: number | string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  width = 40,
}) => {
  // const percentage = (current / total) * 100;
  // return (
  //   <Box>
  //     <Text color="cyan">{"█".repeat(Math.floor(percentage))}</Text>
  //     <Text color="gray">{"█".repeat(Math.floor(100 - percentage))}</Text>
  //   </Box>
  // );
  // const filled = Math.floor((current / total) * width);
  // const empty = width - filled;
  // const percentage = Math.floor((current / total) * 100);

  const filled_pct = Math.floor((current / total) * 100);
  // const empty_pct = 100 - filled_pct;
  const textColor = filled_pct >= 50 ? "white" : "#00007C";
  const bgTextColor = filled_pct < 50 ? "white" : "#00007C";

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      width={width}
      backgroundColor="blue"
    >
      <Box flexDirection="row" width="100%" backgroundColor="cyan">
        <Box
          position="absolute"
          backgroundColor="white"
          overflow="hidden"
          width="100%"
          alignItems="center"
          justifyContent="center"
        >
          <Text> </Text>
        </Box>
        <Box
          position="absolute"
          backgroundColor="#00007C"
          width={filled_pct.toString()}
        >
          <Text wrap="truncate"> </Text>
        </Box>
        <Box
          position="absolute"
          overflow="hidden"
          width="100%"
          alignItems="center"
          justifyContent="center"
        >
          <Text wrap="truncate" color={textColor} backgroundColor={bgTextColor}>
            {filled_pct}%
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
