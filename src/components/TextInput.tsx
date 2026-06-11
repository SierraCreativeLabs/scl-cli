import React from 'react';
import { Box, Text, useInput } from 'ink';

interface TextInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export const TextInput = ({
  value,
  placeholder = '',
  onChange,
  onSubmit,
}: TextInputProps) => {
  useInput((input, key) => {
    if (key.return) {
      if (onSubmit) onSubmit(value);
      return;
    }

    if (key.backspace) {
      onChange(value.slice(0, -1));
      return;
    }

    // Ignore control keys, arrows, etc.
    if (
      key.ctrl ||
      key.escape ||
      key.upArrow ||
      key.downArrow ||
      key.leftArrow ||
      key.rightArrow ||
      key.tab
    ) {
      return;
    }

    // Append printable character
    onChange(value + input);
  });

  const hasValue = value.length > 0;
  
  return (
    <Box>
      {hasValue ? (
        <Text color="cyan">{value}</Text>
      ) : (
        <Text color="gray">{placeholder}</Text>
      )}
      <Text color="violet" bold>┃</Text>
    </Box>
  );
};
