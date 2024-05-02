import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  startSearch(serviceType: string): Promise<void>;
  stopSearch(serviceType: string): Promise<void>;
  addListener: (eventType: string) => void;
  removeListeners: (count: number) => void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ServiceDiscovery');
