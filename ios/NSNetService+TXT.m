// NSNetService+TXT.m

#import "NSNetService+TXT.h"

@implementation NSNetService (TXT)

- (NSDictionary<NSString *, id> *)txtRecord
{
    // Retrieve the TXT record data associated with the service
    NSDictionary<NSString *, NSData *> *txtDict = [NSNetService dictionaryFromTXTRecordData:self.TXTRecordData];

    // Dictionary to hold the converted TXT record
    NSMutableDictionary<NSString *, id> *txtRecord = [NSMutableDictionary dictionary];

    // Loop through the TXT record dictionary
    for (NSString *key in txtDict) {
        // Extract each key-value pair from the TXT record
        NSData *dataValue = txtDict[key];
        // We need to explitly check for NSData because unlike what the iOS
        // documentation says, the value *can* be an NSNull object
        if ([dataValue isKindOfClass:[NSData class]]) {
            // Add the key-value pair to the converted TXT record dictionary
            NSString *stringValue = [[NSString alloc] initWithData:dataValue encoding:NSUTF8StringEncoding];
            txtRecord[key] = stringValue;
        } else if ([dataValue isKindOfClass:[NSNull class]]) {
            // Skip
        }
    }

    // Convert the mutable dictionary to an immutable NSDictionary
    return [NSDictionary dictionaryWithDictionary:txtRecord];
}

@end
