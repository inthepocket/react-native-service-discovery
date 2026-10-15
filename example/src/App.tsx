import React from 'react';
import { useEffect, useState } from 'react';

import {
  Platform,
  StyleSheet,
  View,
  Text,
  ScrollView,
  Button,
} from 'react-native';
import {
  addEventListener,
  startSearch,
  stopSearch,
} from '@inthepocket/react-native-service-discovery';
import { Broadcaster } from './broadcaster';
import { ListItem } from './ListItem';

export default function App() {
  const [log, setLog] = useState('');
  const [services, setServices] = useState([
    { name: 'ssh', enabled: false },
    { name: 'http', enabled: false },
    { name: 'googlecast', enabled: false },
    { name: 'spotify-connect', enabled: false },
    { name: 'itptest', enabled: false },
  ]);
  const [broadcasts, setBroadcasts] = useState([
    { name: 'http', port: 8080, enabled: false },
    { name: 'ssh', port: 2222, enabled: false },
    { name: 'itptest', port: 9000, enabled: false },
  ]);

  useEffect(() => {
    const found = addEventListener('serviceFound', (event) => {
      setLog((prev) => `${prev}[serviceFound] ${JSON.stringify(event)}\n`);
    });
    const lost = addEventListener('serviceLost', (event) => {
      setLog((prev) => `${prev}[serviceLost] ${JSON.stringify(event)}\n`);
    });
    return () => {
      found.remove();
      lost.remove();
      Broadcaster.unregisterAll();
    };
  }, []);

  const appLog = (message: string) =>
    setLog((prev) => `${prev}[app] ${message}\n`);

  const toggleBroadcast = async (name: string, value: boolean) => {
    const broadcast = broadcasts.find((b) => b.name === name);
    if (!broadcast) {
      return;
    }
    const serviceName = `ITP-${Platform.OS}-${name}`;
    try {
      if (value) {
        await Broadcaster.register(serviceName, name, broadcast.port, {
          platform: Platform.OS,
          version: String(Platform.Version),
        });
      } else {
        await Broadcaster.unregister(serviceName);
      }
      setBroadcasts((prev) =>
        prev.map((b) => (b.name === name ? { ...b, enabled: value } : b))
      );
      appLog(
        `${value ? 'broadcasting' : 'stopped broadcasting'} ${serviceName}`
      );
    } catch (e) {
      appLog(`broadcast ${name} failed: ${(e as Error).message}`);
    }
  };

  const toggleService = async (service: string, value: boolean) => {
    setServices((prev) =>
      prev.map((s) => (s.name === service ? { ...s, enabled: value } : s))
    );
    try {
      if (value) {
        await startSearch(service);
      } else {
        await stopSearch(service);
      }
    } catch (e) {
      appLog(`search ${service} failed: ${(e as Error).message}`);
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
      <Text style={styles.subtitle}>
        Listen for services of a type on the network.
      </Text>
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
      <Text style={styles.title}>Broadcast</Text>
      <Text style={styles.subtitle}>
        Publish a service of this app for other devices to find.
      </Text>
      <View style={styles.section}>
        {broadcasts.map(({ name, enabled }) => (
          <ListItem
            key={name}
            service={name}
            onChange={(value) => toggleBroadcast(name, value)}
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
  subtitle: {
    marginHorizontal: 28,
    marginTop: 4,
    fontSize: 13,
    color: '#6C6C70',
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
