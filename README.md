<img src="./banner.png" alt="react-native-service-discovery by In The Pocket" width="100%">

### 🌍 mDNS Network Service Discovery in React Native

[![npm](https://img.shields.io/npm/v/@inthepocket/react-native-service-discovery)](https://www.npmjs.com/package/@inthepocket/react-native-service-discovery)
![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)

This library allows you to discover services on your local network using mDNS (DNS-SD, Bonjour, Zeroconf, Avahi, ...). Devices that support service discovery include printers, webcams, HTTPS servers, and other mobile devices. The library uses [NSNetServiceBrowser](https://developer.apple.com/documentation/foundation/nsnetservicebrowser) on iOS and [NsdManager](https://developer.android.com/develop/connectivity/wifi/use-nsd) on Android.

## Installation

```sh
npm install @inthepocket/react-native-service-discovery
```

Add the services you want to search for in `Info.plist`:

```xml
<key>NSBonjourServices</key>
<array>
  <!-- Change to your services -->
  <string>_ssh._tcp</string> 
  <string>_http._tcp</string>
</array>
```

Add a custom Local Network prompt message in `Info.plist`:

```xml
<key>NSLocalNetworkUsageDescription</key>
<string>${PRODUCT_NAME} uses the local network to discover and connect to devices on your Wi-Fi network.</string>
```

## Usage

```ts
import * as ServiceDiscovery from '@inthepocket/react-native-service-discovery';

const foundListener = ServiceDiscovery.addEventListener('serviceFound', (service) => {
  console.log('Service found:', service);
});

const lostListener = ServiceDiscovery.addEventListener('serviceLost', (service) => {
  console.log('Service lost:', service);
});

// Start searching for _http._tcp. services
await ServiceDiscovery.startSearch('http');

// ...
await ServiceDiscovery.stopSearch('http');
foundListener.remove();
lostListener.remove();
```

### startSearch

Start searching for services of a specific type. Searching for multiple services can be done in parallel.

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| type      | string | The service type to search for, e.g. 'http'. The device will search for services of type `_serviceType._tcp.`. |

#### Returns

`Promise<void>` - Resolves when the search has started. Rejects when the search could not be started.

### stopSearch

Stop searching for a specific service. This will not stop searching for any other services that are being searched for.

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| type      | string | The service type to stop searching for, e.g. 'http'. |

#### Returns

`Promise<void>` - Resolves when the search has stopped. Rejects when the search could not be stopped. Does not reject when the search was already stopped or was not started in the first place.

### addEventListener

| Parameter | Type   | Description |
| --------- | ------ | ----------- |
| event      | `'serviceFound' \| 'serviceLost'` | Start listening for found or lost services. |
| listener   | `(service: Service) => void` | The listener that will be called when a service is found or lost. |

#### Returns

An `EmitterSubscription` that can be used to remove the listener, by calling `remove()`.

### Service

| Attribute | Type   | Description |
| --------- | ------ | ----------- |
| name      | `string` | Service name. |
| type      | `string` | Service type, e.g. `_http._tcp.`. |
| domain    | `string` | Domain, can be `local.` or any other domain. |
| hostName  | `string` | The domain name of the IP advertising the service. On local networks this is usually the host name. |
| addresses | `string[]` | The IP addresses of the service. This is an array of IPv4 and IPv6 addresses. |
| port      | `number` | The port number where the service can be reached. |
| txt       | `Record<string, string>` | The TXT record of the service. The TXT record gives additional information about the service. |


### Listening for multiple service types

You can listen for multiple service types with the same listener:

```ts
import * as ServiceDiscovery from '@inthepocket/react-native-service-discovery';

ServiceDiscovery.addEventListener('serviceFound', (service) => {
  if(service.type === '_http._tcp.') {
    console.log('HTTP service found:', service);
  } else if(service.type === '_ssh._tcp.') {
    console.log('SSH service found:', service);
  }
});

await ServiceDiscovery.startSearch('http');
await ServiceDiscovery.startSearch('ssh');
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---
Many thanks to

- [react-native-dnssd](https://github.com/kopera/react-native-dnssd)
- [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
