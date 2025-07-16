import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import React from "react";
import { useState } from "react";

interface InputProps {
  focus?: boolean;
  secret?: boolean;
  color?: string;
  backgroundColor?: string;
  width?: number | string;
  onSubmit?: (value: string) => void;
}
export const Input: React.FC<InputProps> = ({
  focus,
  secret,
  onSubmit,
  color,
  backgroundColor,
  width,
}: InputProps) => {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitted, setSubmit] = useState(false);
  const handleSubmit = (value: string) => {
    setSubmit(true);
    onSubmit?.(value);
  };
  const handleChange = (value: string) => {
    if (isSubmitted) {
      return;
    }
    setInputValue(value);
  };
  return (
    <Box
      backgroundColor={backgroundColor}
      width={width}
      height={1}
      overflow="hidden"
    >
      <Text color={color}>
        <TextInput
          value={inputValue}
          onChange={handleChange}
          onSubmit={handleSubmit}
          mask={secret ? "*" : undefined}
          focus={focus}
          showCursor={true}
        />
      </Text>
    </Box>
  );
};
