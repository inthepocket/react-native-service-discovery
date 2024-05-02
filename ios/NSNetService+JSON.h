// NSNetService+JSON.h

#import <Foundation/Foundation.h>

@interface NSNetService (JSON)

- (NSDictionary<NSString *, id> *)toJson;

@end
