#import "ExampleBroadcaster.h"

@interface ExampleBroadcaster () <NSNetServiceDelegate>

@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNetService *> *services;
// Promise blocks of register calls that wait for the publish to finish, as @[resolve, reject]
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSArray *> *pending;

@end

@implementation ExampleBroadcaster
RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

- (instancetype)init
{
    if (self = [super init]) {
        _services = [NSMutableDictionary dictionary];
        _pending = [NSMutableDictionary dictionary];
    }
    return self;
}

RCT_EXPORT_METHOD(register:(NSString *)name
                  type:(NSString *)type
                  port:(nonnull NSNumber *)port
                  txt:(NSDictionary *)txt
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    if (self.services[name]) {
        reject(@"E_ALREADY_REGISTERED", [NSString stringWithFormat:@"'%@' is already registered", name], nil);
        return;
    }

    NSString *fullType = [NSString stringWithFormat:@"_%@._tcp.", type];
    NSNetService *service = [[NSNetService alloc] initWithDomain:@"local." type:fullType name:name port:port.intValue];
    NSMutableDictionary<NSString *, NSData *> *txtData = [NSMutableDictionary dictionary];
    [txt enumerateKeysAndObjectsUsingBlock:^(NSString *key, id value, BOOL *stop) {
        txtData[key] = [[value description] dataUsingEncoding:NSUTF8StringEncoding];
    }];
    [service setTXTRecordData:[NSNetService dataFromTXTRecordDictionary:txtData]];
    service.delegate = self;

    self.services[name] = service;
    self.pending[name] = @[[resolve copy], [reject copy]];
    [service publish];
}

RCT_EXPORT_METHOD(unregister:(NSString *)name
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    [self removeServiceNamed:name];
    resolve(nil);
}

RCT_EXPORT_METHOD(unregisterAll:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
    for (NSString *name in self.services.allKeys) {
        [self removeServiceNamed:name];
    }
    resolve(nil);
}

- (void)removeServiceNamed:(NSString *)name
{
    NSNetService *service = self.services[name];
    service.delegate = nil;
    [service stop];
    [self.services removeObjectForKey:name];
    [self.pending removeObjectForKey:name];
}

#pragma mark - NSNetServiceDelegate

- (void)netServiceDidPublish:(NSNetService *)sender
{
    NSArray *blocks = self.pending[sender.name];
    [self.pending removeObjectForKey:sender.name];
    if (blocks) {
        RCTPromiseResolveBlock resolve = blocks[0];
        resolve(nil);
    }
}

- (void)netService:(NSNetService *)sender didNotPublish:(NSDictionary<NSString *, NSNumber *> *)errorDict
{
    NSArray *blocks = self.pending[sender.name];
    [self.services removeObjectForKey:sender.name];
    [self.pending removeObjectForKey:sender.name];
    if (blocks) {
        RCTPromiseRejectBlock reject = blocks[1];
        reject(@"E_REGISTER_FAILED", [NSString stringWithFormat:@"Could not publish '%@' (error code %@)", sender.name, errorDict[NSNetServicesErrorCode]], nil);
    }
}

@end
