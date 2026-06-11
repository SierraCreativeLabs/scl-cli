import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface SelectItem {
  label: string;
  value: string;
}

interface SelectProps {
  items: SelectItem[];
  onSelect: (item: SelectItem) => void;
}

export const Select = ({ items, onSelect }: SelectProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev: number) => (prev > 0 ? prev - 1 : items.length - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev: number) => (prev < items.length - 1 ? prev + 1 : 0));
    }
    if (key.return) {
      const selectedItem = items[selectedIndex];
      if (selectedItem) {
        onSelect(selectedItem);
      }
    }
  });

  return (
    <Box flexDirection="column" marginY={1}>
      {items.map((item: SelectItem, index: number) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={item.value}>
            <Text color={isSelected ? 'violet' : 'gray'}>
              {isSelected ? ' › ' : '   '}
            </Text>
            <Text color={isSelected ? 'violet' : 'white'} bold={isSelected}>
              {item.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
