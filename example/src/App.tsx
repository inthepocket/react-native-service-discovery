import React from 'react';
import { useEffect, useState } from 'react';

import { StyleSheet, View, Text, ScrollView, Button } from 'react-native';
import {
  addEventListener,
  startSearch,
  stopSearch,
} from '@inthepocket/react-native-service-discovery';
import { ListItem } from './ListItem';

export default function App() {
  const [log, setLog] = useState('');
  const [services, setServices] = useState([
    { name: 'ssh', enabled: false },
    { name: 'http', enabled: false },
    { name: 'googlecast', enabled: false },
    { name: 'spotify-connect', enabled: false },
  ]);

  useEffect(() => {
    addEventListener('serviceFound', (event) => {
      setLog((prev) => `${prev}[serviceFound] ${JSON.stringify(event)}\n`);
    });
  }, []);

  const toggleService = async (service: string, value: boolean) => {
    setServices((prev) =>
      prev.map((s) => (s.name === service ? { ...s, enabled: value } : s))
    );
    if (value) {
      await startSearch(service);
    } else {
      await stopSearch(service);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="always"
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Services</Text>
      <View style={styles.section}>
        {services.map(({ name, enabled }) => (
          <ListItem
            key={name}
            service={name}
            onChange={(value) => toggleService(name, value)}
            enabled={enabled}
          />
        ))}
      </View>
      <Text style={styles.title}>Logs</Text>
      <View style={styles.button}>
        <Button title="Clear logs" onPress={() => setLog('')} />
      </View>
      <ScrollView horizontal style={styles.logs}>
        <Text>{log}</Text>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  contentContainer: {
    flexGrow: 1,
  },
  title: {
    marginHorizontal: 28,
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    margin: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  button: {
    margin: 16,
  },
  logs: {
    flex: 1,
    backgroundColor: '#FFF',
  },
});
