
#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNServiceDiscoverySpec.h"

@interface ServiceDiscovery : RCTEventEmitter <NativeServiceDiscoverySpec>
#else
#import <React/RCTBridgeModule.h>

@interface ServiceDiscovery : RCTEventEmitter <RCTBridgeModule>
#endif

@end
