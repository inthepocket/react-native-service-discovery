import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export interface LogEntry {
  id: number;
  kind: 'found' | 'lost' | 'app';
  title: string;
  details?: object;
}

const KIND_COLORS = {
  found: '#34C759',
  lost: '#FF3B30',
  app: '#8E8E93',
};

export const LogItem = ({ kind, title, details }: LogEntry) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      disabled={!details}
      onPress={() => setExpanded((prev) => !prev)}
      style={styles.container}
    >
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: KIND_COLORS[kind] }]}>
          <Text style={styles.badgeText}>{kind}</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {expanded && (
        <Text style={styles.details}>{JSON.stringify(details, null, 2)}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFF',
  },
  title: {
    flex: 1,
    fontSize: 14,
  },
  details: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
});
