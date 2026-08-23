import { PCAPNG_MAX_PACKETS } from '../constants/pcapng-viewer.constants';
import type {
  PcapngDataset,
  PcapngInterface,
  PcapngPacket,
  PcapngSectionInfo
} from '../types/pcapng-viewer.types';
import { decodePcapFrame, isPcapngMagic, PCAP_LINK_NAMES } from './pcap-parse.utils';

function readU16(bytes: Uint8Array, offset: number, le: boolean): number {
  return le ? bytes[offset] | (bytes[offset + 1] << 8) : (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes: Uint8Array, offset: number, le: boolean): number {
  return le
    ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
    : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readU64(bytes: Uint8Array, offset: number, le: boolean): number {
  const a = readU32(bytes, offset, le);
  const b = readU32(bytes, offset + 4, le);
  return le ? a + b * 0x100000000 : b + a * 0x100000000;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '').trim();
}

function macString(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, 6))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

interface NgOption {
  code: number;
  value: Uint8Array;
}

function parseOptions(bytes: Uint8Array, offset: number, end: number, le: boolean): NgOption[] {
  const options: NgOption[] = [];
  let pos = offset;
  while (pos + 4 <= end) {
    const code = readU16(bytes, pos, le);
    const len = readU16(bytes, pos + 2, le);
    pos += 4;
    if (code === 0) break;
    if (pos + len > end) break;
    options.push({ code, value: bytes.slice(pos, pos + len) });
    pos += Math.ceil(len / 4) * 4;
  }
  return options;
}

function optionText(options: NgOption[], code: number): string {
  const opt = options.find((o) => o.code === code);
  return opt ? decodeUtf8(opt.value) : '';
}

export function parsePcapngBytes(bytes: Uint8Array): PcapngDataset {
  if (!bytes.length) throw new Error('PCAPNG file is empty');
  if (!isPcapngMagic(bytes)) throw new Error('Not a PCAPNG file (expected 0A 0D 0D 0A section header)');
  const bomLe = readU32(bytes, 8, true);
  const bomBe = readU32(bytes, 8, false);
  const le = bomLe === 0x1a2b3c4d || bomBe !== 0x1a2b3c4d;
  const warnings: string[] = [];
  const section: PcapngSectionInfo = { hardware: '', os: '', application: '' };
  const interfaces: PcapngInterface[] = [];
  const packets: PcapngPacket[] = [];
  let pos = 0;
  let firstTs: number | null = null;

  while (pos + 12 <= bytes.length && packets.length < PCAPNG_MAX_PACKETS) {
    const type = readU32(bytes, pos, le);
    const total = readU32(bytes, pos + 4, le);
    if (total < 12 || pos + total > bytes.length) {
      warnings.push('PCAPNG block length is invalid or truncated.');
      break;
    }
    const bodyStart = pos + 8;
    const bodyEnd = pos + total - 4;
    if (type === 0x0a0d0d0a) {
      const opts = parseOptions(bytes, bodyStart + 16, bodyEnd, le);
      section.hardware = optionText(opts, 2) || section.hardware;
      section.os = optionText(opts, 3) || section.os;
      section.application = optionText(opts, 4) || section.application;
    } else if (type === 1 && bodyEnd - bodyStart >= 8) {
      const linkType = readU16(bytes, bodyStart, le);
      const snaplen = readU32(bytes, bodyStart + 4, le);
      const opts = parseOptions(bytes, bodyStart + 8, bodyEnd, le);
      const macOpt = opts.find((o) => o.code === 6);
      const speedOpt = opts.find((o) => o.code === 8);
      const tsOpt = opts.find((o) => o.code === 9);
      interfaces.push({
        id: interfaces.length,
        name: optionText(opts, 2) || `if${interfaces.length}`,
        description: optionText(opts, 3),
        linkType,
        linkTypeName: PCAP_LINK_NAMES[linkType] ?? `DLT ${linkType}`,
        snaplen,
        mac: macOpt && macOpt.value.length >= 6 ? macString(macOpt.value) : '',
        speedBps: speedOpt && speedOpt.value.length >= 8 ? readU64(speedOpt.value, 0, le) : 0,
        tsresol: tsOpt && tsOpt.value.length ? tsOpt.value[0] & 0x7f : 6,
        packets: 0,
        bytes: 0,
        received: 0,
        dropped: 0
      });
    } else if (type === 6 && bodyEnd - bodyStart >= 20) {
      const iface = readU32(bytes, bodyStart, le);
      const tsHigh = readU32(bytes, bodyStart + 4, le);
      const tsLow = readU32(bytes, bodyStart + 8, le);
      const caplen = readU32(bytes, bodyStart + 12, le);
      const origLen = readU32(bytes, bodyStart + 16, le);
      const frame = bytes.slice(bodyStart + 20, bodyStart + 20 + caplen);
      const ts = (BigInt(tsHigh) << 32n) + BigInt(tsLow);
      const absMs = Number(ts) / 1000;
      if (firstTs == null) firstTs = absMs;
      const rec = interfaces[iface] ?? interfaces[0];
      const linkType = rec?.linkType ?? 1;
      const decoded = decodePcapFrame(
        packets.length,
        Number(ts / 1_000_000n),
        Number(ts % 1_000_000n),
        absMs - (firstTs ?? absMs),
        frame,
        origLen,
        linkType
      );
      packets.push({
        ...decoded,
        interfaceId: iface,
        interfaceName: rec?.name ?? `if${iface}`
      });
      if (rec) {
        rec.packets += 1;
        rec.bytes += caplen;
      }
    } else if (type === 3 && bodyEnd - bodyStart >= 4) {
      const caplen = readU32(bytes, bodyStart, le);
      const frame = bytes.slice(bodyStart + 4, bodyStart + 4 + caplen);
      const rec = interfaces[0];
      const decoded = decodePcapFrame(packets.length, 0, 0, 0, frame, caplen, rec?.linkType ?? 1);
      packets.push({ ...decoded, interfaceId: 0, interfaceName: rec?.name ?? 'if0' });
      if (rec) {
        rec.packets += 1;
        rec.bytes += caplen;
      }
    } else if (type === 5 && bodyEnd - bodyStart >= 12) {
      const iface = readU32(bytes, bodyStart, le);
      const opts = parseOptions(bytes, bodyStart + 12, bodyEnd, le);
      const rec = interfaces[iface];
      if (rec) {
        const recv = opts.find((o) => o.code === 4);
        const drop = opts.find((o) => o.code === 5);
        if (recv && recv.value.length >= 8) rec.received = readU64(recv.value, 0, le);
        if (drop && drop.value.length >= 8) rec.dropped = readU64(drop.value, 0, le);
      }
    } else if (type !== 4 && type !== 9 && type !== 0x0000000a) {
      warnings.push(`Unsupported PCAPNG block type 0x${type.toString(16)} skipped.`);
    }
    pos += total;
  }

  if (!interfaces.length) warnings.push('PCAPNG has no interface description blocks.');
  if (!packets.length) warnings.push('PCAPNG contains no packet blocks.');
  if (pos < bytes.length && packets.length >= PCAPNG_MAX_PACKETS) {
    warnings.push(`Only the first ${PCAPNG_MAX_PACKETS} packets are shown.`);
  }
  return { section, littleEndian: le, interfaces, packets, warnings: [...new Set(warnings)] };
}

export function filterPcapngPackets(
  packets: PcapngPacket[],
  query: string,
  interfaceId: number | null
): PcapngPacket[] {
  let list = interfaceId == null ? packets : packets.filter((p) => p.interfaceId === interfaceId);
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((pkt) =>
    tokens.every((token) => {
      if (token === 'tcp') return pkt.protocol === 'TCP' || pkt.protocol === 'HTTP';
      if (token === 'udp') return pkt.protocol === 'UDP' || pkt.protocol === 'DNS';
      if (token === 'dns') return pkt.protocol === 'DNS';
      if (token === 'http') return pkt.protocol === 'HTTP';
      if (token === 'arp') return pkt.protocol === 'ARP';
      if (token === 'icmp') return pkt.protocol === 'ICMP';
      if (token === 'iface' || token === 'if' || token === 'host' || token === 'port') return true;
      if (token.startsWith('iface:')) return pkt.interfaceName.toLowerCase() === token.slice(6) || String(pkt.interfaceId) === token.slice(6);
      if (token.startsWith('host:')) {
        const host = token.slice(5);
        return pkt.srcIp.includes(host) || pkt.dstIp.includes(host);
      }
      if (token.startsWith('port:')) {
        const port = Number(token.slice(5));
        return pkt.srcPort === port || pkt.dstPort === port;
      }
      const hay = `${pkt.protocol} ${pkt.srcIp} ${pkt.dstIp} ${pkt.srcPort ?? ''} ${pkt.dstPort ?? ''} ${pkt.interfaceName} ${pkt.info}`.toLowerCase();
      return hay.includes(token);
    })
  );
}
