import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

interface Props {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

export const ToggleChip = ({ label, enabled, onChange }: Props) => {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={() => onChange(!enabled)}
      style={[styles.chip, enabled && styles.chipEnabled]}
    >
      <Text style={[styles.label, enabled && styles.labelEnabled]}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
  },
  chipEnabled: {
    backgroundColor: '#007AFF',
  },
  label: {
    fontSize: 14,
    color: '#000',
  },
  labelEnabled: {
    color: '#FFF',
  },
});
