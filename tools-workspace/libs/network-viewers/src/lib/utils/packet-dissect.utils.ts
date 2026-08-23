import type { PcapPacket } from '../types/pcap-viewer.types';
import type { PacketAnalyzerPacket, PacketField, PacketLayer } from '../types/packet-analyzer.types';
import type { ProtocolDissector } from '../types/protocol-analyzer.types';
import { decodePcapFrame, formatHexDump, PCAP_LINK_NAMES } from './pcap-parse.utils';

function readU16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function mac(bytes: Uint8Array, offset: number): string {
  return Array.from(bytes.subarray(offset, offset + 6))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

function asciiPreview(bytes: Uint8Array, max = 80): string {
  let out = '';
  for (let i = 0; i < Math.min(bytes.length, max); i++) {
    const c = bytes[i];
    out += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return out;
}

function field(name: string, value: string, offset: number, length: number): PacketField {
  return { name, value, offset, length };
}

export function dissectPacket(packet: PcapPacket, linkType = 1): PacketLayer[] {
  const frame = packet.bytes;
  const layers: PacketLayer[] = [
    {
      id: 'frame',
      name: 'Frame',
      summary: `${frame.length} bytes captured`,
      offset: 0,
      length: frame.length,
      fields: [
        field('Captured', String(packet.inclLen), 0, 0),
        field('Original', String(packet.origLen), 0, 0),
        field('Arrival', `${packet.relMs.toFixed(3)} ms`, 0, 0),
        field('Protocol', packet.protocol, 0, 0)
      ]
    }
  ];

  let l3 = 0;
  if (linkType === 1 && frame.length >= 14) {
    const etype = readU16be(frame, 12);
    layers.push({
      id: 'eth',
      name: 'Ethernet',
      summary: `${packet.srcMac || mac(frame, 6)} → ${packet.dstMac || mac(frame, 0)}`,
      offset: 0,
      length: 14,
      fields: [
        field('Destination', packet.dstMac || mac(frame, 0), 0, 6),
        field('Source', packet.srcMac || mac(frame, 6), 6, 6),
        field('Type', `0x${etype.toString(16).padStart(4, '0')}`, 12, 2)
      ]
    });
    l3 = 14;
  } else if (linkType === 113 && frame.length >= 16) {
    l3 = 16;
  }

  if (packet.ethertype === 0x0806 && frame.length >= l3 + 28) {
    const op = readU16be(frame, l3 + 6);
    layers.push({
      id: 'arp',
      name: 'ARP',
      summary: packet.info,
      offset: l3,
      length: 28,
      fields: [
        field('Hardware type', String(readU16be(frame, l3)), l3, 2),
        field('Protocol type', `0x${readU16be(frame, l3 + 2).toString(16).padStart(4, '0')}`, l3 + 2, 2),
        field('Opcode', op === 1 ? 'request' : op === 2 ? 'reply' : String(op), l3 + 6, 2),
        field('Sender MAC', mac(frame, l3 + 8), l3 + 8, 6),
        field('Sender IP', packet.srcIp, l3 + 14, 4),
        field('Target IP', packet.dstIp, l3 + 24, 4)
      ]
    });
    return layers;
  }

  if (packet.ipVersion === 4 && frame.length >= l3 + 20) {
    const ihl = (frame[l3] & 0x0f) * 4;
    const proto = frame[l3 + 9];
    layers.push({
      id: 'ipv4',
      name: 'IPv4',
      summary: `${packet.srcIp} → ${packet.dstIp}`,
      offset: l3,
      length: ihl,
      fields: [
        field('Version', '4', l3, 1),
        field('IHL', `${ihl} bytes`, l3, 1),
        field('Total length', String(readU16be(frame, l3 + 2)), l3 + 2, 2),
        field('TTL', String(frame[l3 + 8]), l3 + 8, 1),
        field('Protocol', String(proto), l3 + 9, 1),
        field('Source', packet.srcIp, l3 + 12, 4),
        field('Destination', packet.dstIp, l3 + 16, 4)
      ]
    });
    const l4 = l3 + ihl;
    if (proto === 6 && frame.length >= l4 + 20) {
      const dataOffset = ((frame[l4 + 12] >> 4) & 0x0f) * 4;
      layers.push({
        id: 'tcp',
        name: 'TCP',
        summary: `${packet.srcPort} → ${packet.dstPort} [${packet.tcpFlags || 'NONE'}]`,
        offset: l4,
        length: dataOffset,
        fields: [
          field('Source port', String(packet.srcPort ?? ''), l4, 2),
          field('Destination port', String(packet.dstPort ?? ''), l4 + 2, 2),
          field('Seq', String(readU32be(frame, l4 + 4)), l4 + 4, 4),
          field('Ack', String(readU32be(frame, l4 + 8)), l4 + 8, 4),
          field('Flags', packet.tcpFlags || 'NONE', l4 + 13, 1),
          field('Window', String(readU16be(frame, l4 + 14)), l4 + 14, 2)
        ]
      });
      const payload = frame.subarray(l4 + dataOffset);
      if (payload.length) {
        if (packet.protocol === 'HTTP') {
          const text = new TextDecoder('latin1').decode(payload.subarray(0, 240));
          const lines = text.split(/\r?\n/).filter((l) => l.length);
          layers.push({
            id: 'http',
            name: 'HTTP',
            summary: lines[0] || `${payload.length} bytes`,
            offset: l4 + dataOffset,
            length: payload.length,
            fields: lines.slice(0, 8).map((line, i) =>
              field(i === 0 ? 'Start line' : `Header ${i}`, line, l4 + dataOffset, Math.min(payload.length, 80))
            )
          });
        } else {
          layers.push({
            id: 'payload',
            name: 'Payload',
            summary: `${payload.length} bytes`,
            offset: l4 + dataOffset,
            length: payload.length,
            fields: [field('ASCII', asciiPreview(payload), l4 + dataOffset, Math.min(payload.length, 80))]
          });
        }
      }
    } else if (proto === 17 && frame.length >= l4 + 8) {
      layers.push({
        id: 'udp',
        name: 'UDP',
        summary: `${packet.srcPort} → ${packet.dstPort}`,
        offset: l4,
        length: 8,
        fields: [
          field('Source port', String(packet.srcPort ?? ''), l4, 2),
          field('Destination port', String(packet.dstPort ?? ''), l4 + 2, 2),
          field('Length', String(readU16be(frame, l4 + 4)), l4 + 4, 2)
        ]
      });
      const dns = frame.subarray(l4 + 8);
      if (packet.protocol === 'DNS' && dns.length) {
        layers.push({
          id: 'dns',
          name: 'DNS',
          summary: packet.info,
          offset: l4 + 8,
          length: dns.length,
          fields: [
            field('Transaction ID', dns.length >= 2 ? `0x${readU16be(dns, 0).toString(16)}` : '—', l4 + 8, 2),
            field('Info', packet.info, l4 + 8, dns.length)
          ]
        });
      } else if (dns.length) {
        layers.push({
          id: 'payload',
          name: 'Payload',
          summary: `${dns.length} bytes`,
          offset: l4 + 8,
          length: dns.length,
          fields: [field('ASCII', asciiPreview(dns), l4 + 8, Math.min(dns.length, 80))]
        });
      }
    } else if (proto === 1 && frame.length >= l4 + 4) {
      layers.push({
        id: 'icmp',
        name: 'ICMP',
        summary: packet.info,
        offset: l4,
        length: Math.max(8, frame.length - l4),
        fields: [field('Type', String(frame[l4]), l4, 1), field('Code', String(frame[l4 + 1]), l4 + 1, 1)]
      });
    }
  } else if (packet.ipVersion === 6 && frame.length >= l3 + 40) {
    layers.push({
      id: 'ipv6',
      name: 'IPv6',
      summary: `${packet.srcIp} → ${packet.dstIp}`,
      offset: l3,
      length: 40,
      fields: [
        field('Version', '6', l3, 1),
        field('Next header', String(frame[l3 + 6]), l3 + 6, 1),
        field('Hop limit', String(frame[l3 + 7]), l3 + 7, 1),
        field('Source', packet.srcIp, l3 + 8, 16),
        field('Destination', packet.dstIp, l3 + 24, 16)
      ]
    });
  }

  return layers;
}

export function enrichPackets(packets: PcapPacket[], linkType: number): PacketAnalyzerPacket[] {
  return packets.map((pkt) => ({ ...pkt, layers: dissectPacket(pkt, linkType) }));
}

export function parseHexDumpText(text: string): Uint8Array {
  const hex = text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return '';
      const withoutOffset = trimmed.replace(/^(?:0x)?[\da-fA-F]{2,8}(?::|\s)\s*/, '');
      return withoutOffset.split(/\s{2,}/)[0] ?? '';
    })
    .join(' ')
    .replace(/[^0-9a-fA-F]/g, '');
  if (hex.length < 28) throw new Error('Hex dump is too short to be a frame');
  if (hex.length % 2) throw new Error('Hex dump has an odd number of digits');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function hexDumpToPacket(bytes: Uint8Array): PacketAnalyzerPacket {
  const pkt = decodePcapFrame(0, 0, 0, 0, bytes, bytes.length, 1);
  return { ...pkt, layers: dissectPacket(pkt, 1) };
}

export function linkTypeName(linkType: number): string {
  return PCAP_LINK_NAMES[linkType] ?? `DLT ${linkType}`;
}

export function hexForLayer(packet: PacketAnalyzerPacket | null, layer: PacketLayer | null): string {
  if (!packet) return '';
  if (!layer || layer.length <= 0) return formatHexDump(packet.bytes);
  const start = Math.max(0, layer.offset);
  const end = Math.min(packet.bytes.length, layer.offset + layer.length);
  return formatHexDump(packet.bytes.subarray(start, end), Math.max(16, end - start));
}

export function buildDissectors(packets: PcapPacket[]): ProtocolDissector[] {
  const map = new Map<string, ProtocolDissector & { conv: Set<string> }>();

  const bump = (name: string, pkt: PcapPacket): void => {
    let rec = map.get(name);
    if (!rec) {
      rec = {
        name,
        packets: 0,
        bytes: 0,
        ports: [],
        conversations: 0,
        firstMs: pkt.relMs,
        lastMs: pkt.relMs,
        sampleInfo: [],
        conv: new Set()
      };
      map.set(name, rec);
    }
    rec.packets += 1;
    rec.bytes += pkt.inclLen;
    rec.firstMs = Math.min(rec.firstMs, pkt.relMs);
    rec.lastMs = Math.max(rec.lastMs, pkt.relMs);
    for (const port of [pkt.srcPort, pkt.dstPort]) {
      if (port != null && port > 0 && !rec.ports.includes(port)) rec.ports.push(port);
    }
    if (pkt.info && rec.sampleInfo.length < 4 && !rec.sampleInfo.includes(pkt.info)) rec.sampleInfo.push(pkt.info);
    const a = `${pkt.srcIp || pkt.srcMac}:${pkt.srcPort ?? ''}`;
    const b = `${pkt.dstIp || pkt.dstMac}:${pkt.dstPort ?? ''}`;
    rec.conv.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  };

  for (const pkt of packets) {
    if (pkt.srcMac || pkt.dstMac || pkt.ethertype) bump('Ethernet', pkt);
    if (pkt.ipVersion === 4) bump('IPv4', pkt);
    if (pkt.ipVersion === 6) bump('IPv6', pkt);
    if (pkt.protocol === 'TCP' || pkt.protocol === 'HTTP') bump('TCP', pkt);
    if (pkt.protocol === 'HTTP') bump('HTTP', pkt);
    if (pkt.protocol === 'UDP' || pkt.protocol === 'DNS') bump('UDP', pkt);
    if (pkt.protocol === 'DNS') bump('DNS', pkt);
    if (pkt.protocol === 'ARP') bump('ARP', pkt);
    if (pkt.protocol === 'ICMP') bump('ICMP', pkt);
  }

  return [...map.values()]
    .map(({ conv, ...rest }) => ({ ...rest, conversations: conv.size }))
    .sort((a, b) => b.bytes - a.bytes);
}
