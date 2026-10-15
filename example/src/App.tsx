import React from 'react';
import { useEffect, useRef, useState } from 'react';

import {
  Platform,
  StyleSheet,
  SafeAreaView,
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
import { ToggleChip } from './ToggleChip';

export default function App() {
  const [log, setLog] = useState('');
  const logRef = useRef<ScrollView>(null);
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
    <SafeAreaView style={styles.container}>
      <View style={styles.controls}>
        <Text style={styles.title}>Services</Text>
        <Text style={styles.subtitle}>
          Listen for services of a type on the network.
        </Text>
        <View style={styles.chips}>
          {services.map(({ name, enabled }) => (
            <ToggleChip
              key={name}
              label={name}
              onChange={(value) => toggleService(name, value)}
              enabled={enabled}
            />
          ))}
        </View>
        <Text style={styles.title}>Broadcast</Text>
        <Text style={styles.subtitle}>
          Publish a service of this app for other devices to find.
        </Text>
        <View style={styles.chips}>
          {broadcasts.map(({ name, enabled }) => (
            <ToggleChip
              key={name}
              label={name}
              onChange={(value) => toggleBroadcast(name, value)}
              enabled={enabled}
            />
          ))}
        </View>
        <View style={styles.logsHeader}>
          <Text style={styles.title}>Logs</Text>
          <Button title="Clear logs" onPress={() => setLog('')} />
        </View>
      </View>
      <ScrollView
        ref={logRef}
        style={styles.logs}
        onContentSizeChange={() => logRef.current?.scrollToEnd()}
      >
        <Text style={styles.logText}>{log}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  controls: {
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#6C6C70',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logs: {
    flex: 1,
    padding: 8,
    backgroundColor: '#FFF',
  },
  logText: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
});
