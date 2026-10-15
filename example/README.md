# Example app

Example app for `@inthepocket/react-native-service-discovery`.
It searches for mDNS services, lists the events in a log and broadcasts test services.

## Run

Run from the repository root.

```sh
yarn install
cd example/ios && bundle install && bundle exec pod install && cd ../..
yarn example start
yarn example ios
yarn example android
```

Start Metro first, then run the platform you need in a second terminal.

## Testing discovery

The Broadcast section publishes `ITP-<platform>-<type>` services of type `http`, `ssh` and `itptest`.
Publishing is done by the example-only native module in `example/modules/broadcaster`.
It uses `NSNetService` on iOS and `NsdManager` on Android.

Install the app on two devices on the same Wi-Fi.
Broadcast on one device and search on the other.
Services from a laptop work as well:

```sh
dns-sd -R "svc-a" _http._tcp local 8080 k=v
```

## Constraints

- iOS only finds the types listed under `NSBonjourServices` in `example/ios/ServiceDiscoveryExample/Info.plist`.
- The broadcaster registers a service without a socket, so the port only advertises a number.
