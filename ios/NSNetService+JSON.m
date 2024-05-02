// NSNetService+JSON.m

#import "NSNetService+JSON.h"
#import "NSNetService+TXT.h"
#import "NSNetService+IPAddress.h"

@implementation NSNetService (JSON)

- (NSDictionary<NSString *, id> *)toJson
{
    return @{
        @"name": self.name,
        @"type": self.type,
        @"domain": self.domain,
        @"hostName": self.hostName ?: [NSNull null],
        @"port": @(self.port),
        @"txt": [self txtRecord],
        @"addresses": [self ipAddresses],
    };
}

@end
