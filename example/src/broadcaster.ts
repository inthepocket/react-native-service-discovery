import { NativeModules } from 'react-native';

interface ExampleBroadcaster {
  register(
    name: string,
    type: string,
    port: number,
    txt: Record<string, string>
  ): Promise<void>;
  unregister(name: string): Promise<void>;
  unregisterAll(): Promise<void>;
}

/**
 * Publishes mDNS services so that a second device running this app can
 * discover them. Only exists in the example app.
 */
export const Broadcaster: ExampleBroadcaster = NativeModules.ExampleBroadcaster;
