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

/**
 * A service that is found or lost on the network.
 */
export interface Service {
  /**
   * Service name.
   */
  readonly name: string;
  /**
   * Service type, e.g. `_http._tcp.`.
   */
  readonly type: string;
  /**
   * Domain, can be `local.` or any other domain.
   */
  readonly domain: string;
  /**
   * The domain name of the IP advertising the service.
   * On local networks this is usually the host name.
   */
  readonly hostName: string;
  /**
   * The IP addresses of the service.
   * This is an array of IPv4 and IPv6 addresses.
   */
  readonly addresses: string[];
  /**
   * The port number where the service can be reached.
   */
  readonly port: number;
  /**
   * The TXT record of the service. The TXT record gives additional information
   * about the service.
   */
  readonly txt: Record<string, string>;
}

export type ServiceEvent = 'serviceFound' | 'serviceLost';

export type ServiceCallback = (service: Service) => void;

export interface Subscription {
  remove: () => void;
}

const EventEmitter = new NativeEventEmitter(ServiceDiscovery);

/**
 *
 * @example
 * ```ts
 * import * as ServiceDiscovery from '@inthepocket/react-native-service-discovery';
 *
 * ServiceDiscovery.addEventListener('serviceFound', (service) => console.log('Service found:', service));
 *
 * // Start searching for _http._tcp. services
 * await ServiceDiscovery.startSearch('http');
 * ```
 */
export const addEventListener = (
  event: ServiceEvent,
  listener: ServiceCallback
): Subscription => EventEmitter.addListener(event, listener);

/**
 * Start searching for services of a specific type. Searching for
 * multiple services can be done in parallel.
 *
 * @param serviceType The service type to search for, e.g. 'http'. The device
 * will search for services of type `_serviceType._tcp.`.
 *
 * @example
 * ```ts
 * import * as ServiceDiscovery from '@inthepocket/react-native-service-discovery';
 *
 * ServiceDiscovery.addEventListener('serviceFound', (service) => console.log('Service found:', service));
 *
 * // Start searching for _http._tcp. services
 * await ServiceDiscovery.startSearch('http');
 * ```
 */
export const startSearch = (serviceType: string): Promise<void> =>
  ServiceDiscovery.startSearch(serviceType);

/**
 * Stop searching for a specific service. This will not stop searching for any
 * other services that are being searched for.
 *
 * @returns A promise that resolves when the search has been stopped, and
 * rejects if the search cannot be stopped. Does not reject if the search has
 * already been stopped.
 */
export const stopSearch = (serviceType: string): Promise<void> =>
  ServiceDiscovery.stopSearch(serviceType);
