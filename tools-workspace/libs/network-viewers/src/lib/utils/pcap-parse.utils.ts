import { PCAP_MAX_PACKETS } from '../constants/pcap-viewer.constants';
import type { PcapDataset, PcapPacket, PcapStream } from '../types/pcap-viewer.types';

export const PCAP_LINK_NAMES: Record<number, string> = {
  0: 'NULL',
  1: 'Ethernet',
  101: 'Raw IP',
  113: 'Linux SLL',
  276: 'Linux SLL2'
};

function mac(bytes: Uint8Array, offset: number): string {
  return Array.from(bytes.subarray(offset, offset + 6))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

function ipv4(bytes: Uint8Array, offset: number): string {
  return `${bytes[offset]}.${bytes[offset + 1]}.${bytes[offset + 2]}.${bytes[offset + 3]}`;
}

function ipv6(bytes: Uint8Array, offset: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    parts.push(((bytes[offset + i] << 8) | bytes[offset + i + 1]).toString(16));
  }
  return parts.join(':').replace(/(^|:)0(:0)+(:|$)/, '::').replace(/::+/, '::');
}

function readU16(bytes: Uint8Array, offset: number, le: boolean): number {
  return le ? bytes[offset] | (bytes[offset + 1] << 8) : (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes: Uint8Array, offset: number, le: boolean): number {
  return le
    ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
    : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function tcpFlags(value: number): string {
  const names = [
    [0x01, 'FIN'],
    [0x02, 'SYN'],
    [0x04, 'RST'],
    [0x08, 'PSH'],
    [0x10, 'ACK'],
    [0x20, 'URG']
  ] as const;
  return names.filter(([bit]) => value & bit).map(([, name]) => name).join(',') || 'NONE';
}

function decodeDnsName(bytes: Uint8Array, offset: number, depth = 0): { name: string; next: number } {
  if (depth > 8 || offset >= bytes.length) return { name: '', next: offset };
  const labels: string[] = [];
  let pos = offset;
  while (pos < bytes.length) {
    const len = bytes[pos];
    if (len === 0) return { name: labels.join('.'), next: pos + 1 };
    if ((len & 0xc0) === 0xc0) {
      const ptr = ((len & 0x3f) << 8) | bytes[pos + 1];
      const jumped = decodeDnsName(bytes, ptr, depth + 1);
      labels.push(...jumped.name.split('.').filter(Boolean));
      return { name: labels.join('.'), next: pos + 2 };
    }
    labels.push(new TextDecoder('latin1').decode(bytes.subarray(pos + 1, pos + 1 + len)));
    pos += 1 + len;
  }
  return { name: labels.join('.'), next: pos };
}

function asciiPreview(bytes: Uint8Array, max = 80): string {
  let out = '';
  for (let i = 0; i < Math.min(bytes.length, max); i++) {
    const c = bytes[i];
    out += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return out;
}

function decodeL3(frame: Uint8Array, linkType: number): {
  srcMac: string;
  dstMac: string;
  ethertype: number;
  l3Offset: number;
} {
  if (linkType === 1 && frame.length >= 14) {
    return {
      dstMac: mac(frame, 0),
      srcMac: mac(frame, 6),
      ethertype: readU16(frame, 12, false),
      l3Offset: 14
    };
  }
  if (linkType === 113 && frame.length >= 16) {
    return { dstMac: '', srcMac: '', ethertype: readU16(frame, 14, false), l3Offset: 16 };
  }
  if (linkType === 0 && frame.length >= 4) {
    const family = readU32(frame, 0, true);
    const ethertype = family === 2 || family === 24 ? 0x0800 : family === 28 || family === 30 ? 0x86dd : 0;
    return { dstMac: '', srcMac: '', ethertype, l3Offset: 4 };
  }
  if (linkType === 101) {
    const version = frame[0] >> 4;
    return { dstMac: '', srcMac: '', ethertype: version === 6 ? 0x86dd : 0x0800, l3Offset: 0 };
  }
  return { dstMac: '', srcMac: '', ethertype: 0, l3Offset: 0 };
}

export function decodePcapFrame(index: number, tsSec: number, tsUsec: number, relMs: number, frame: Uint8Array, origLen: number, linkType: number): PcapPacket {
  const { srcMac, dstMac, ethertype, l3Offset } = decodeL3(frame, linkType);
  let ipVersion: 0 | 4 | 6 = 0;
  let srcIp = '';
  let dstIp = '';
  let protocol = ethertype === 0x0806 ? 'ARP' : 'ETH';
  let srcPort: number | null = null;
  let dstPort: number | null = null;
  let tcpFlagText = '';
  let info = '';
  let payload: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let tcpSeq = 0;

  if (ethertype === 0x0806 && frame.length >= l3Offset + 28) {
    const op = readU16(frame, l3Offset + 6, false);
    srcIp = ipv4(frame, l3Offset + 14);
    dstIp = ipv4(frame, l3Offset + 24);
    protocol = 'ARP';
    info = op === 1 ? `Who has ${dstIp}? Tell ${srcIp}` : `ARP reply ${srcIp} is at ${mac(frame, l3Offset + 8)}`;
  } else if (ethertype === 0x0800 && frame.length >= l3Offset + 20) {
    ipVersion = 4;
    const ihl = (frame[l3Offset] & 0x0f) * 4;
    const proto = frame[l3Offset + 9];
    srcIp = ipv4(frame, l3Offset + 12);
    dstIp = ipv4(frame, l3Offset + 16);
    const l4 = l3Offset + ihl;
    if (proto === 6 && frame.length >= l4 + 20) {
      protocol = 'TCP';
      srcPort = readU16(frame, l4, false);
      dstPort = readU16(frame, l4 + 2, false);
      tcpSeq = readU32(frame, l4 + 4, false);
      const dataOffset = ((frame[l4 + 12] >> 4) & 0x0f) * 4;
      tcpFlagText = tcpFlags(frame[l4 + 13]);
      payload = frame.subarray(l4 + dataOffset);
      info = `${srcPort} → ${dstPort} [${tcpFlagText}] seq=${tcpSeq} ${asciiPreview(payload)}`.trim();
      if (/^(GET|POST|PUT|DELETE|HEAD|PATCH|HTTP\/)/i.test(asciiPreview(payload, 12))) protocol = 'HTTP';
    } else if (proto === 17 && frame.length >= l4 + 8) {
      protocol = 'UDP';
      srcPort = readU16(frame, l4, false);
      dstPort = readU16(frame, l4 + 2, false);
      payload = frame.subarray(l4 + 8);
      info = `${srcPort} → ${dstPort} len=${payload.length}`;
      if (srcPort === 53 || dstPort === 53) {
        protocol = 'DNS';
        const q = decodeDnsName(payload, 12);
        const flags = payload.length >= 4 ? readU16(payload, 2, false) : 0;
        info = `${(flags & 0x8000) ? 'response' : 'query'} ${q.name || ''}`.trim();
      }
    } else if (proto === 1 && frame.length >= l4 + 4) {
      protocol = 'ICMP';
      const type = frame[l4];
      info = type === 8 ? 'Echo request' : type === 0 ? 'Echo reply' : `type ${type}`;
      payload = frame.subarray(l4 + 8);
    } else {
      protocol = proto === 1 ? 'ICMP' : proto === 6 ? 'TCP' : proto === 17 ? 'UDP' : `IP/${proto}`;
      info = `proto ${proto}`;
    }
  } else if (ethertype === 0x86dd && frame.length >= l3Offset + 40) {
    ipVersion = 6;
    const next = frame[l3Offset + 6];
    srcIp = ipv6(frame, l3Offset + 8);
    dstIp = ipv6(frame, l3Offset + 24);
    const l4 = l3Offset + 40;
    if (next === 6 && frame.length >= l4 + 20) {
      protocol = 'TCP';
      srcPort = readU16(frame, l4, false);
      dstPort = readU16(frame, l4 + 2, false);
      tcpFlagText = tcpFlags(frame[l4 + 13]);
      const dataOffset = ((frame[l4 + 12] >> 4) & 0x0f) * 4;
      payload = frame.subarray(l4 + dataOffset);
      info = `${srcPort} → ${dstPort} [${tcpFlagText}]`;
    } else if (next === 17 && frame.length >= l4 + 8) {
      protocol = 'UDP';
      srcPort = readU16(frame, l4, false);
      dstPort = readU16(frame, l4 + 2, false);
      payload = frame.subarray(l4 + 8);
      info = `${srcPort} → ${dstPort}`;
    } else {
      protocol = `IPv6/${next}`;
      info = `next ${next}`;
    }
  } else {
    info = `ethertype 0x${ethertype.toString(16).padStart(4, '0')}`;
  }

  return {
    index,
    tsSec,
    tsUsec,
    relMs,
    inclLen: frame.length,
    origLen,
    bytes: frame,
    srcMac,
    dstMac,
    ethertype,
    ipVersion,
    srcIp,
    dstIp,
    protocol,
    srcPort,
    dstPort,
    tcpFlags: tcpFlagText,
    info,
    payload
  };
}

function buildStreams(packets: PcapPacket[]): PcapStream[] {
  const map = new Map<string, { protocol: string; src: string; dst: string; indexes: number[]; chunks: Array<{ seq: number; data: Uint8Array }> }>();
  for (const pkt of packets) {
    if ((pkt.protocol !== 'TCP' && pkt.protocol !== 'HTTP') || pkt.srcPort == null || pkt.dstPort == null) continue;
    const a = `${pkt.srcIp}:${pkt.srcPort}`;
    const b = `${pkt.dstIp}:${pkt.dstPort}`;
    const forward = a < b;
    const id = `${forward ? a : b}|${forward ? b : a}`;
    let rec = map.get(id);
    if (!rec) {
      rec = { protocol: pkt.protocol, src: forward ? a : b, dst: forward ? b : a, indexes: [], chunks: [] };
      map.set(id, rec);
    }
    if (pkt.protocol === 'HTTP') rec.protocol = 'HTTP';
    rec.indexes.push(pkt.index);
    if (pkt.payload.length) rec.chunks.push({ seq: pkt.index, data: pkt.payload });
  }
  return [...map.values()].map((rec, i) => {
    const text = rec.chunks
      .map((c) => asciiPreview(c.data, Math.min(400, c.data.length)))
      .join('\n');
    return {
      id: `s-${i + 1}`,
      protocol: rec.protocol,
      src: rec.src,
      dst: rec.dst,
      packetIndexes: rec.indexes,
      bytes: rec.chunks.reduce((sum, c) => sum + c.data.length, 0),
      text: text || '(no payload)'
    };
  });
}

function detectClassicPcap(bytes: Uint8Array): { le: boolean; nano: boolean } | null {
  if (bytes.length < 24) return null;
  const le = readU32(bytes, 0, true);
  const be = readU32(bytes, 0, false);
  if (le === 0xa1b2c3d4) return { le: true, nano: false };
  if (le === 0xa1b23c4d) return { le: true, nano: true };
  if (be === 0xa1b2c3d4) return { le: false, nano: false };
  if (be === 0xa1b23c4d) return { le: false, nano: true };
  return null;
}

function parseClassicPcap(bytes: Uint8Array): PcapDataset {
  const endian = detectClassicPcap(bytes);
  if (!endian) throw new Error('Not a classic PCAP file');
  const warnings: string[] = [];
  const le = endian.le;
  const versionMajor = le ? bytes[4] | (bytes[5] << 8) : (bytes[4] << 8) | bytes[5];
  const versionMinor = le ? bytes[6] | (bytes[7] << 8) : (bytes[6] << 8) | bytes[7];
  if (versionMajor !== 2) warnings.push(`Unexpected PCAP version ${versionMajor}.${versionMinor}.`);
  const snaplen = readU32(bytes, 16, le);
  const linkType = readU32(bytes, 20, le);
  const packets: PcapPacket[] = [];
  let pos = 24;
  let firstTs: number | null = null;
  while (pos + 16 <= bytes.length && packets.length < PCAP_MAX_PACKETS) {
    const tsSec = readU32(bytes, pos, le);
    const tsFrac = readU32(bytes, pos + 4, le);
    const inclLen = readU32(bytes, pos + 8, le);
    const origLen = readU32(bytes, pos + 12, le);
    pos += 16;
    if (pos + inclLen > bytes.length) {
      warnings.push('Capture is truncated before the last packet.');
      break;
    }
    const tsUsec = endian.nano ? Math.floor(tsFrac / 1000) : tsFrac;
    const absMs = tsSec * 1000 + tsUsec / 1000;
    if (firstTs == null) firstTs = absMs;
    const frame = bytes.slice(pos, pos + inclLen);
    packets.push(decodePcapFrame(packets.length, tsSec, tsUsec, absMs - (firstTs ?? absMs), frame, origLen, linkType));
    pos += inclLen;
  }
  if (pos < bytes.length && packets.length >= PCAP_MAX_PACKETS) {
    warnings.push(`Only the first ${PCAP_MAX_PACKETS} packets are shown.`);
  }
  if (!packets.length) warnings.push('PCAP contains no packets.');
  return {
    format: 'pcap',
    linkType,
    linkTypeName: PCAP_LINK_NAMES[linkType] ?? `DLT ${linkType}`,
    snaplen,
    littleEndian: le,
    nanosecond: endian.nano,
    packets,
    streams: buildStreams(packets),
    warnings
  };
}

function parsePcapng(bytes: Uint8Array): PcapDataset {
  if (bytes.length < 28 || readU32(bytes, 0, false) !== 0x0a0d0d0a && readU32(bytes, 0, true) !== 0x0a0d0d0a) {
    throw new Error('Not a PCAPNG file');
  }
  const bomLe = readU32(bytes, 8, true);
  const bomBe = readU32(bytes, 8, false);
  const le = bomLe === 0x1a2b3c4d || bomBe !== 0x1a2b3c4d;
  const warnings: string[] = [];
  const packets: PcapPacket[] = [];
  const linkTypes: number[] = [];
  let pos = 0;
  let firstTs: number | null = null;
  while (pos + 12 <= bytes.length && packets.length < PCAP_MAX_PACKETS) {
    const type = readU32(bytes, pos, le);
    const total = readU32(bytes, pos + 4, le);
    if (total < 12 || pos + total > bytes.length) {
      warnings.push('PCAPNG block length is invalid or truncated.');
      break;
    }
    const body = bytes.subarray(pos + 8, pos + total - 4);
    if (type === 1 && body.length >= 8) {
      linkTypes.push(readU16(bytes, pos + 8, le));
    } else if ((type === 6 || type === 3) && body.length >= (type === 6 ? 20 : 4)) {
      let caplen: number;
      let origLen: number;
      let tsHigh = 0;
      let tsLow = 0;
      let iface = 0;
      let dataOff: number;
      if (type === 6) {
        iface = readU32(body, 0, le);
        tsHigh = readU32(body, 4, le);
        tsLow = readU32(body, 8, le);
        caplen = readU32(body, 12, le);
        origLen = readU32(body, 16, le);
        dataOff = 20;
      } else {
        caplen = readU32(body, 0, le);
        origLen = caplen;
        dataOff = 4;
      }
      const frame = body.slice(dataOff, dataOff + caplen);
      const ts = (BigInt(tsHigh) << 32n) + BigInt(tsLow);
      const absMs = Number(ts) / 1000;
      if (firstTs == null) firstTs = absMs;
      const linkType = linkTypes[iface] ?? linkTypes[0] ?? 1;
      packets.push(
        decodePcapFrame(
          packets.length,
          Number(ts / 1_000_000n),
          Number(ts % 1_000_000n),
          absMs - (firstTs ?? absMs),
          frame,
          origLen,
          linkType
        )
      );
    } else if (type !== 0x0a0d0d0a && type !== 1 && type !== 6 && type !== 3 && type !== 4 && type !== 5 && type !== 9) {
      warnings.push(`Unsupported PCAPNG block type 0x${type.toString(16)} skipped.`);
    }
    pos += total;
  }
  if (!packets.length) warnings.push('PCAPNG contains no enhanced/simple packet blocks.');
  const linkType = linkTypes[0] ?? 1;
  return {
    format: 'pcapng',
    linkType,
    linkTypeName: PCAP_LINK_NAMES[linkType] ?? `DLT ${linkType}`,
    snaplen: 65535,
    littleEndian: le,
    nanosecond: false,
    packets,
    streams: buildStreams(packets),
    warnings: [...new Set(warnings)]
  };
}

export function isPcapngMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x0a && bytes[1] === 0x0d && bytes[2] === 0x0d && bytes[3] === 0x0a;
}

export function parsePcapBytes(bytes: Uint8Array): PcapDataset {
  if (!bytes.length) throw new Error('Capture file is empty');
  if (isPcapngMagic(bytes)) return parsePcapng(bytes);
  if (detectClassicPcap(bytes)) return parseClassicPcap(bytes);
  throw new Error('Unrecognized capture — use classic PCAP or PCAPNG');
}

export function filterPcapPackets(packets: PcapPacket[], query: string): PcapPacket[] {
  const q = query.trim().toLowerCase();
  if (!q) return packets;
  const tokens = q.split(/\s+/).filter(Boolean);
  return packets.filter((pkt) =>
    tokens.every((token) => {
      if (token === 'tcp') return pkt.protocol === 'TCP' || pkt.protocol === 'HTTP';
      if (token === 'udp') return pkt.protocol === 'UDP' || pkt.protocol === 'DNS';
      if (token === 'dns') return pkt.protocol === 'DNS';
      if (token === 'http') return pkt.protocol === 'HTTP';
      if (token === 'arp') return pkt.protocol === 'ARP';
      if (token === 'icmp') return pkt.protocol === 'ICMP';
      if (token === 'ip') return pkt.ipVersion === 4 || pkt.ipVersion === 6;
      if (token === 'host' || token === 'port') return true;
      if (token.startsWith('host:')) {
        const host = token.slice(5);
        return pkt.srcIp.includes(host) || pkt.dstIp.includes(host);
      }
      if (token.startsWith('port:')) {
        const port = Number(token.slice(5));
        return pkt.srcPort === port || pkt.dstPort === port;
      }
      const hay = `${pkt.protocol} ${pkt.srcIp} ${pkt.dstIp} ${pkt.srcPort ?? ''} ${pkt.dstPort ?? ''} ${pkt.info} ${pkt.tcpFlags}`.toLowerCase();
      return hay.includes(token);
    })
  );
}

export function formatHexDump(bytes: Uint8Array, maxBytes = 512): string {
  const slice = bytes.subarray(0, maxBytes);
  const lines: string[] = [];
  for (let i = 0; i < slice.length; i += 16) {
    const chunk = slice.subarray(i, i + 16);
    const hex = Array.from(chunk)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(47, ' ');
    const ascii = Array.from(chunk)
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
      .join('');
    lines.push(`${i.toString(16).padStart(4, '0')}  ${hex}  ${ascii}`);
  }
  if (bytes.length > maxBytes) lines.push(`… ${bytes.length - maxBytes} more bytes`);
  return lines.join('\n');
}
