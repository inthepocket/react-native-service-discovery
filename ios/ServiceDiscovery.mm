#import "ServiceDiscovery.h"
#import "NSNetService+JSON.h"

@interface ServiceDiscovery () <NSNetServiceBrowserDelegate, NSNetServiceDelegate>

@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNetServiceBrowser *> *browsers;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableDictionary *> *servicesByType;
// Promise blocks of startSearch calls that are waiting for the browser to start, as @[resolve, reject]
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSArray *> *pendingStarts;
@property (nonatomic, assign) BOOL hasListeners;

@end

@implementation ServiceDiscovery
RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

#pragma mark - Lifecycle

- (instancetype)init
{
    self = [super init];
    if (self) {
        // Initialize dictionaries to store browsers and services
        _browsers = [NSMutableDictionary dictionary];
        _servicesByType = [NSMutableDictionary dictionary];
        _pendingStarts = [NSMutableDictionary dictionary];
    }
    return self;
}

- (void)dealloc
{
    for (NSNetServiceBrowser *browser in self.browsers.allValues) {
        [browser stop];
        browser.delegate = nil;
    }
    for (NSDictionary *services in self.servicesByType.allValues) {
        for (NSNetService *service in services.allValues) {
            [service stop];
            service.delegate = nil;
        }
    }
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[@"serviceFound", @"serviceLost"];
}

- (dispatch_queue_t) methodQueue
{
  return dispatch_get_main_queue();
}

- (void)startObserving
{
    self.hasListeners = YES;
}

- (void)stopObserving
{
    self.hasListeners = NO;
}

#pragma mark - Public API

RCT_EXPORT_METHOD(startSearch:(NSString *)type   
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    if (self.browsers[type]) {
        // Already searching for this type
        resolve(nil);
        return;
    }

    // Create a new NSNetServiceBrowser instance
    NSNetServiceBrowser *browser = [[NSNetServiceBrowser alloc] init];
    browser.delegate = self;

    // Store the browser and associated services in dictionaries
    self.browsers[type] = browser;
    self.servicesByType[type] = [NSMutableDictionary dictionary];
    // Settled in netServiceBrowserWillSearch: or netServiceBrowser:didNotSearch:
    self.pendingStarts[type] = @[[resolve copy], [reject copy]];

    // Start searching for services based on type
    NSString *serviceType = [NSString stringWithFormat:@"_%@._tcp.", type];
    [browser searchForServicesOfType:serviceType inDomain:@""]; // Intentionally left blank (instead of limiting to "local.")
}

RCT_EXPORT_METHOD(stopSearch:(NSString *)type
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    NSNetServiceBrowser *browser = self.browsers[type];
    [self settlePendingStartForType:type error:nil];

    if (browser) {
        // Stop the browser and associated services when requested
        [browser stop];

        NSMutableDictionary *services = self.servicesByType[type];

        for (NSNetService *service in services.allValues) {
            [service stop];
            service.delegate = nil;
        }

        browser.delegate = nil;

        // Remove the browser and associated services from dictionaries
        [services removeAllObjects];
        [self.browsers removeObjectForKey:type];
        [self.servicesByType removeObjectForKey:type];
    }
    resolve(nil);
}

#pragma mark - Private methods

// Send a React Native event with the service details
- (void)sendServiceEventWithName:(NSString *)eventName service:(NSNetService *)service
{
    if (self.hasListeners) {
        [self sendEventWithName:eventName body:[service toJson]];
    }
}

#pragma mark - NSNetServiceBrowserDelegate

- (void)netServiceBrowserWillSearch:(NSNetServiceBrowser *)browser
{
    [self settlePendingStartForType:[self searchTypeForBrowser:browser] error:nil];
}

- (void)netServiceBrowser:(NSNetServiceBrowser *)browser didNotSearch:(NSDictionary<NSString *, NSNumber *> *)errorDict
{
    NSString *type = [self searchTypeForBrowser:browser];
    if (!type) {
        return;
    }

    browser.delegate = nil;
    [self.browsers removeObjectForKey:type];
    [self.servicesByType removeObjectForKey:type];

    NSInteger code = [errorDict[NSNetServicesErrorCode] integerValue];
    NSString *message = [NSString stringWithFormat:@"Failed to start searching for %@ (error code %ld)", type, (long)code];
    [self settlePendingStartForType:type error:[NSError errorWithDomain:NSNetServicesErrorDomain code:code userInfo:@{NSLocalizedDescriptionKey: message}]];
}

// Called when a service is found during the search
- (void)netServiceBrowser:(NSNetServiceBrowser *)browser didFindService:(NSNetService *)service moreComing:(BOOL)moreComing
{
    if (service == nil) {
        return;
    }

    // Use the modified lookup key without the underscore and protocol
    NSString *type = [self typeWithoutUnderscoreAndProtocol:service.type];
    
    // Retrieve the services dictionary based on the service type
    NSMutableDictionary *services = self.servicesByType[type];

    if (services) {
        // Add the service to the dictionary and start resolving its details
        services[service.name] = service;
        service.delegate = self;
        [service resolveWithTimeout:0.0];
    }
}

// Called when a service is removed during the search
- (void)netServiceBrowser:(NSNetServiceBrowser *)browser didRemoveService:(NSNetService *)service moreComing:(BOOL)moreComing
{
    if (service == nil) {
        return;
    }

    // Stop resolving
    [service stop];
    
    // Use the modified lookup key without the underscore and protocol
    NSString *type = [self typeWithoutUnderscoreAndProtocol:service.type];

    // Retrieve the services dictionary based on the modified service type
    NSMutableDictionary *services = self.servicesByType[type];

    NSNetService* cachedService = services[service.name];
    if (cachedService) {
        // Send a serviceLost event to React Native
        [self sendServiceEventWithName:@"serviceLost" service:cachedService];
        // Remove the service from the dictionary 
        [services removeObjectForKey:cachedService.name];
    } else {
        // Send unresolved service in case it was lost before it was resolved
        [self sendServiceEventWithName:@"serviceLost" service:service];
    }
}

#pragma mark - NSNetServiceDelegate

// Called when the details of a service are resolved
- (void)netServiceDidResolveAddress:(NSNetService *)service
{
    // Use the modified lookup key without the underscore and protocol
    NSString *type = [self typeWithoutUnderscoreAndProtocol:service.type];
    
    // Retrieve the services dictionary based on the service type
    NSMutableDictionary *services = self.servicesByType[type];

    NSNetService* cachedService = services[service.name];
    if (cachedService) {
        // Send a serviceFound event to React Native
        [self sendServiceEventWithName:@"serviceFound" service:cachedService];
    }

    // Resolving without a timeout never ends by itself and can report the
    // same service again, so stop once the addresses are known.
    [service stop];
}

// Called when a service could not be resolved
- (void)netService:(NSNetService *)service didNotResolve:(NSDictionary<NSString *, NSNumber *> *)errorDict
{
    NSLog(@"[ServiceDiscovery] Could not resolve %@ (error code %@)", service.name, errorDict[NSNetServicesErrorCode]);
    [service stop];
}

#pragma mark - Helpers

// Reverse lookup in self.browsers, nil when the browser is no longer tracked
- (NSString *)searchTypeForBrowser:(NSNetServiceBrowser *)browser
{
    return [[self.browsers allKeysForObject:browser] firstObject];
}

// Resolves the pending startSearch promise of a type, or rejects it when an error is given
- (void)settlePendingStartForType:(NSString *)type error:(NSError *)error
{
    NSArray *blocks = type ? self.pendingStarts[type] : nil;
    if (!blocks) {
        return;
    }

    [self.pendingStarts removeObjectForKey:type];
    if (error) {
        RCTPromiseRejectBlock reject = blocks[1];
        reject(@"E_START_FAILED", error.localizedDescription, error);
    } else {
        RCTPromiseResolveBlock resolve = blocks[0];
        resolve(nil);
    }
}

- (NSString *)typeWithoutUnderscoreAndProtocol:(NSString *)fullType
{
    // Define a regular expression pattern with hardcoded "tcp" protocol
    NSString *pattern = @"^_(.*?)\\._tcp\\.$";

    // Create a regular expression object with the defined pattern
    NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:pattern options:0 error:nil];

    // Find the first match in the fullType using the regular expression
    NSTextCheckingResult *match = [regex firstMatchInString:fullType options:0 range:NSMakeRange(0, fullType.length)];

    // Check if a match is found and if there are captured groups
    if (match && [match numberOfRanges] > 1) {
        // Extract the captured part of the type without the underscore and protocol
        NSString *typeWithoutUnderscoreAndProtocol = [fullType substringWithRange:[match rangeAtIndex:1]];

        // Return the modified type
        return typeWithoutUnderscoreAndProtocol;
    }

    // Return the original type if no match or capture is found
    return fullType;
}

#pragma mark - New arch

// Don't compile this code when we build for the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeServiceDiscoverySpecJSI>(params);
}
#endif

@end
