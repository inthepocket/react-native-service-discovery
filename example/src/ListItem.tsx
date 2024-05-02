import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

interface Props {
  enabled: boolean;
  onChange: (value: boolean) => void;
  service: string;
}

export const ListItem = ({ service, enabled, onChange }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{service}</Text>
      <Switch value={enabled} onChange={() => onChange(!enabled)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  label: {
    fontSize: 16,
  },
});
