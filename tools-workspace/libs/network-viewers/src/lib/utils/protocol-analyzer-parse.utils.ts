import type { PcapPacket } from '../types/pcap-viewer.types';
import type {
  ProtocolAnalyzerDataset,
  ProtocolDissector,
  ProtocolSourceKind
} from '../types/protocol-analyzer.types';
import { buildDissectors } from './packet-dissect.utils';
import { filterPcapPackets, isPcapngMagic, parsePcapBytes } from './pcap-parse.utils';

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean).slice(0, 8);
}

function asNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((n) => Number.isFinite(n));
}

function finishDataset(
  name: string,
  sourceKind: ProtocolSourceKind,
  dissectors: ProtocolDissector[],
  packets: PcapPacket[],
  warnings: string[]
): ProtocolAnalyzerDataset {
  const totalPackets = packets.length ? packets.length : dissectors.reduce((sum, d) => Math.max(sum, d.packets), 0);
  const totalBytes = packets.length
    ? packets.reduce((sum, p) => sum + p.inclLen, 0)
    : dissectors.reduce((sum, d) => sum + d.bytes, 0);
  const durationMs = packets.length
    ? packets.reduce((max, p) => Math.max(max, p.relMs), 0)
    : dissectors.reduce((max, d) => Math.max(max, d.lastMs), 0);
  return { name, sourceKind, dissectors, packets, totalPackets, totalBytes, durationMs, warnings };
}

export function parseProtocolJson(text: string): ProtocolAnalyzerDataset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid protocol JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('Protocol JSON must be an object');
  const rec = data as Record<string, unknown>;
  const raw = Array.isArray(rec.dissectors) ? rec.dissectors : Array.isArray(rec.protocols) ? rec.protocols : null;
  if (!raw?.length) throw new Error('Protocol JSON is missing dissectors');
  const warnings: string[] = [];
  const dissectors: ProtocolDissector[] = raw.map((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      name: asString(row.name ?? row.protocol, 'Unknown'),
      packets: Math.max(0, Math.round(asNumber(row.packets, 1))),
      bytes: Math.max(0, Math.round(asNumber(row.bytes))),
      ports: asNumberList(row.ports),
      conversations: Math.max(0, Math.round(asNumber(row.conversations))),
      firstMs: asNumber(row.firstMs ?? row.first_ms),
      lastMs: asNumber(row.lastMs ?? row.last_ms),
      sampleInfo: asStringList(row.sampleInfo ?? row.info)
    };
  });
  if (!dissectors.length) warnings.push('Protocol JSON contains no dissectors.');
  return finishDataset(asString(rec.name ?? rec.title, 'Protocol snapshot'), 'json', dissectors, [], warnings);
}

export function parseProtocolAnalyzerBytes(bytes: Uint8Array, fileName = ''): ProtocolAnalyzerDataset {
  if (!bytes.length) throw new Error('Protocol file is empty');
  if (isPcapngMagic(bytes) || /\.(pcapng)$/i.test(fileName)) {
    const parsed = parsePcapBytes(bytes);
    return finishDataset(fileName || 'PCAPNG capture', 'pcapng', buildDissectors(parsed.packets), parsed.packets, parsed.warnings);
  }
  const magicLe = bytes.length >= 4 && bytes[0] === 0xd4 && bytes[1] === 0xc3 && bytes[2] === 0xb2 && bytes[3] === 0xa1;
  const magicBe = bytes.length >= 4 && bytes[0] === 0xa1 && bytes[1] === 0xb2 && bytes[2] === 0xc3 && bytes[3] === 0xd4;
  if (magicLe || magicBe || /\.(pcap|cap)$/i.test(fileName)) {
    const parsed = parsePcapBytes(bytes);
    return finishDataset(fileName || 'PCAP capture', 'pcap', buildDissectors(parsed.packets), parsed.packets, parsed.warnings);
  }
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '').trim();
  if (text.startsWith('{')) return parseProtocolJson(text);
  throw new Error('Unrecognized protocol trace — use PCAP/PCAPNG or JSON dissectors');
}

export function filterProtocolDissectors(dissectors: ProtocolDissector[], query: string): ProtocolDissector[] {
  const q = query.trim().toLowerCase();
  if (!q) return dissectors;
  const tokens = q.split(/\s+/).filter(Boolean);
  return dissectors.filter((d) =>
    tokens.every((token) => {
      if (token === 'host' || token === 'port') return true;
      if (token.startsWith('port:')) return d.ports.includes(Number(token.slice(5)));
      const hay = `${d.name} ${d.ports.join(' ')} ${d.sampleInfo.join(' ')}`.toLowerCase();
      return hay.includes(token);
    })
  );
}

export function filterProtocolPackets(packets: PcapPacket[], query: string, protocol: string | null): PcapPacket[] {
  const byProto = !protocol
    ? packets
    : packets.filter((p) => {
        if (protocol === 'Ethernet') return true;
        if (protocol === 'IPv4') return p.ipVersion === 4;
        if (protocol === 'IPv6') return p.ipVersion === 6;
        if (protocol === 'TCP') return p.protocol === 'TCP' || p.protocol === 'HTTP';
        if (protocol === 'UDP') return p.protocol === 'UDP' || p.protocol === 'DNS';
        return p.protocol === protocol;
      });
  return filterPcapPackets(byProto, query);
}
