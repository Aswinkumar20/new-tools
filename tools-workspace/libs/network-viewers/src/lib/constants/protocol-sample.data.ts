/** Synthetic protocol dump (education / research). */

export function buildProtocolSampleObject(): Record<string, unknown> {
  return {
    name: 'Lab protocol mix',
    source: 'Synthetic education sample',
    dissectors: [
      {
        name: 'Ethernet',
        packets: 8,
        bytes: 980,
        ports: [],
        conversations: 1,
        firstMs: 0,
        lastMs: 84,
        sampleInfo: ['ethertype 0x0800 / ARP']
      },
      {
        name: 'IPv4',
        packets: 7,
        bytes: 938,
        ports: [],
        conversations: 3,
        firstMs: 0,
        lastMs: 72,
        sampleInfo: ['10.0.0.10 ↔ 93.184.216.34']
      },
      {
        name: 'TCP',
        packets: 5,
        bytes: 720,
        ports: [80, 51234],
        conversations: 1,
        firstMs: 0,
        lastMs: 48,
        sampleInfo: ['SYN / SYN-ACK handshake']
      },
      {
        name: 'HTTP',
        packets: 2,
        bytes: 480,
        ports: [80],
        conversations: 1,
        firstMs: 36,
        lastMs: 48,
        sampleInfo: ['GET / HTTP/1.1', 'HTTP/1.1 200 OK']
      },
      {
        name: 'UDP',
        packets: 2,
        bytes: 196,
        ports: [53, 53001],
        conversations: 1,
        firstMs: 60,
        lastMs: 72,
        sampleInfo: ['DNS over UDP']
      },
      {
        name: 'DNS',
        packets: 2,
        bytes: 196,
        ports: [53],
        conversations: 1,
        firstMs: 60,
        lastMs: 72,
        sampleInfo: ['query example.com', 'A 93.184.216.34']
      },
      {
        name: 'ARP',
        packets: 1,
        bytes: 42,
        ports: [],
        conversations: 1,
        firstMs: 84,
        lastMs: 84,
        sampleInfo: ['Who has 93.184.216.34?']
      }
    ]
  };
}

export const PROTOCOL_JSON_SAMPLE = JSON.stringify(buildProtocolSampleObject(), null, 2);
