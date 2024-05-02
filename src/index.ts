import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package '@inthepocket/react-native-service-discovery' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

// @ts-expect-error
const isTurboModuleEnabled = global.__turboModuleProxy != null;

const ServiceDiscoveryModule = isTurboModuleEnabled
  ? require('./NativeServiceDiscovery').default
  : NativeModules.ServiceDiscovery;

const ServiceDiscovery = ServiceDiscoveryModule
  ? ServiceDiscoveryModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export interface Service {
  readonly name: string;
  readonly type: string;
  readonly domain: string;
  readonly hostName: string;
  readonly addresses: string[];
  readonly port: number;
  readonly txt: Record<string, string>;
}

export type ServiceEvent = 'serviceFound' | 'serviceLost' | 'error';

export type ServiceCallback = (service: Service) => void;

export interface Subscription {
  remove: () => void;
}

const EventEmitter = new NativeEventEmitter(ServiceDiscovery);

export const addEventListener = (
  event: ServiceEvent,
  listener: ServiceCallback
): Subscription => EventEmitter.addListener(event, listener);

export const startSearch = (serviceType: string): Promise<void> =>
  ServiceDiscovery.startSearch(serviceType);

export const stopSearch = (serviceType: string): Promise<void> =>
  ServiceDiscovery.stopSearch(serviceType);
