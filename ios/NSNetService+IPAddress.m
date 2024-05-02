// NSNetService+IPAddress.m

#include <arpa/inet.h>

#import "NSNetService+IPAddress.h"

@implementation NSNetService (IPAddress)

- (NSArray *)ipAddresses
{
    NSMutableArray *addresses = [NSMutableArray array];

    // Loop through the addresses associated with the service
    for (NSData *data in self.addresses) {
        // Buffer to hold the address string
        char addressBuffer[INET6_ADDRSTRLEN];

        // Define a union to handle both IPv4 and IPv6 addresses
        typedef union {
            struct sockaddr sa;
            struct sockaddr_in ipv4;
            struct sockaddr_in6 ipv6;
        } ip_socket_address;

        ip_socket_address *socketAddress = (ip_socket_address *)[data bytes];

        // Check if the socket address is valid and is either IPv4 or IPv6
        if (socketAddress && (socketAddress->sa.sa_family == AF_INET || socketAddress->sa.sa_family == AF_INET6)) {
            // Convert the binary address to a human-readable string
            const char *addressStr = inet_ntop(
                socketAddress->sa.sa_family,
                (socketAddress->sa.sa_family == AF_INET ? (void *)&(socketAddress->ipv4.sin_addr) : (void *)&(socketAddress->ipv6.sin6_addr)),
                addressBuffer,
                sizeof(addressBuffer)
            );

            // If the conversion was successful, add the address to the array
            if (addressStr) {
                [addresses addObject:[NSString stringWithFormat:@"%s", addressStr]];
            }
        }
    }

    return addresses;
}

@end
