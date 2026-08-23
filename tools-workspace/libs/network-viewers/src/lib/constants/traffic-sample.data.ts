/** Synthetic flow dump (education / research). */

export function buildTrafficSampleObject(): Record<string, unknown> {
  return {
    name: 'Office LAN snapshot',
    source: 'Synthetic education sample',
    flows: [
      { src: '10.0.0.10', dst: '93.184.216.34', srcPort: 51234, dstPort: 80, protocol: 'HTTP', packets: 5, bytes: 1480, startMs: 0, endMs: 48 },
      { src: '10.0.0.10', dst: '10.0.0.53', srcPort: 53001, dstPort: 53, protocol: 'DNS', packets: 2, bytes: 196, startMs: 60, endMs: 72 },
      { src: '10.0.0.10', dst: '93.184.216.34', srcPort: 0, dstPort: 0, protocol: 'ARP', packets: 1, bytes: 42, startMs: 84, endMs: 84 },
      { src: '10.0.0.21', dst: '10.0.0.1', srcPort: 44312, dstPort: 443, protocol: 'TCP', packets: 18, bytes: 9216, startMs: 12, endMs: 220 },
      { src: '10.0.0.21', dst: '8.8.8.8', srcPort: 53110, dstPort: 53, protocol: 'DNS', packets: 4, bytes: 412, startMs: 20, endMs: 40 },
      { src: '10.0.0.34', dst: '10.0.0.10', srcPort: 22, dstPort: 51200, protocol: 'TCP', packets: 9, bytes: 2400, startMs: 90, endMs: 180 },
      { src: '10.0.0.34', dst: '224.0.0.251', srcPort: 5353, dstPort: 5353, protocol: 'UDP', packets: 3, bytes: 360, startMs: 100, endMs: 140 }
    ]
  };
}

export const TRAFFIC_JSON_SAMPLE = JSON.stringify(buildTrafficSampleObject(), null, 2);

export const TRAFFIC_CSV_SAMPLE = [
  'src,dst,src_port,dst_port,protocol,packets,bytes,start_ms,end_ms',
  '10.0.0.10,93.184.216.34,51234,80,HTTP,5,1480,0,48',
  '10.0.0.10,10.0.0.53,53001,53,DNS,2,196,60,72',
  '10.0.0.21,10.0.0.1,44312,443,TCP,18,9216,12,220'
].join('\n');

export const TRAFFIC_FLOW_SAMPLE = `# FLOW Office LAN
FLOW 10.0.0.10 93.184.216.34 51234 80 HTTP 5 1480 0 48
FLOW 10.0.0.10 10.0.0.53 53001 53 DNS 2 196 60 72
FLOW 10.0.0.21 8.8.8.8 53110 53 DNS 4 412 20 40
`;
