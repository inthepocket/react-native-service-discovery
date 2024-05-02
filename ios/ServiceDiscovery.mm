#import "ServiceDiscovery.h"
#import "NSNetService+JSON.h"

@interface ServiceDiscovery () <NSNetServiceBrowserDelegate, NSNetServiceDelegate>

@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNetServiceBrowser *> *browsers;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableDictionary *> *servicesByType;
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
    }
    return self;
}

- (void)dealloc
{
    for (NSNetServiceBrowser *browser in self.browsers.allValues) {
        [browser stop];
        browser.delegate = nil;
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
    NSNetServiceBrowser *browser = self.browsers[type];

    if (!browser) {
        // Create a new NSNetServiceBrowser instance if not exists
        browser = [[NSNetServiceBrowser alloc] init];
        browser.delegate = self;

        // Store the browser and associated services in dictionaries
        self.browsers[type] = browser;
        self.servicesByType[type] = [NSMutableDictionary dictionary];
    }

    // Start searching for services based on type
    NSString *serviceType = [NSString stringWithFormat:@"_%@._tcp.", type];
    [browser searchForServicesOfType:serviceType inDomain:@""]; // Intentionally left blank (instead of limiting to "local.")
    resolve(nil);
}

RCT_EXPORT_METHOD(stopSearch:(NSString *)type
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    NSNetServiceBrowser *browser = self.browsers[type];

    if (browser) {
        // Stop the browser and associated services when requested
        [browser stop];

        NSMutableDictionary *services = self.servicesByType[type];

        for (NSNetService *service in services.allValues) {
            [service stop];
        }

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
}

#pragma mark - Helpers

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
