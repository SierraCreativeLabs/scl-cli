import React from 'react';

import { Box, Text, useInput } from 'ink';

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  onSubmit: () => void;
}

export const Toggle = ({ value, onChange, onSubmit }: ToggleProps) => {
  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow || input === ' ') {
      onChange(!value);
    }
    if (key.return) {
      onSubmit();
    }
  });

  return (
    <Box marginY={1}>
      <Text color={value ? 'violet' : 'gray'} bold={value}>
        {value ? '✔ Yes' : '  Yes'}
      </Text>
      <Text color="gray"> / </Text>
      <Text color={!value ? 'violet' : 'gray'} bold={!value}>
        {!value ? '✔ No' : '  No'}
      </Text>
    </Box>
  );
};
