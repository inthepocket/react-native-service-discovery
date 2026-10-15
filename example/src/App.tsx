import React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Platform,
  StyleSheet,
  SafeAreaView,
  View,
  Text,
  FlatList,
  Button,
} from 'react-native';
import {
  addEventListener,
  startSearch,
  stopSearch,
} from '@inthepocket/react-native-service-discovery';
import { Broadcaster } from './broadcaster';
import { LogItem, type LogEntry } from './LogItem';
import { ToggleChip } from './ToggleChip';

export default function App() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const logRef = useRef<FlatList<LogEntry>>(null);
  const nextLogId = useRef(0);
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

  const addLog = useCallback(
    (entry: Omit<LogEntry, 'id'>) =>
      setLog((prev) => [...prev, { ...entry, id: nextLogId.current++ }]),
    []
  );

  useEffect(() => {
    const found = addEventListener('serviceFound', (service) =>
      addLog({
        kind: 'found',
        title: `${service.name} ${service.type}`,
        details: service,
      })
    );
    const lost = addEventListener('serviceLost', (service) =>
      addLog({
        kind: 'lost',
        title: `${service.name} ${service.type}`,
        details: service,
      })
    );
    return () => {
      found.remove();
      lost.remove();
      Broadcaster.unregisterAll();
    };
  }, [addLog]);

  const appLog = (message: string) => addLog({ kind: 'app', title: message });

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
          <Button title="Clear logs" onPress={() => setLog([])} />
        </View>
      </View>
      <FlatList
        ref={logRef}
        data={log}
        keyExtractor={(entry) => String(entry.id)}
        renderItem={({ item }) => <LogItem {...item} />}
        style={styles.logs}
        onContentSizeChange={() => logRef.current?.scrollToEnd()}
      />
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
    backgroundColor: '#FFF',
  },
});
