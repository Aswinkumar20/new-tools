import type { PcapPacket } from '../types/pcap-viewer.types';
import type {
  TrafficDataset,
  TrafficFlow,
  TrafficProtocolStat,
  TrafficSourceKind,
  TrafficTalker
} from '../types/network-traffic-viewer.types';
import { isPcapngMagic, parsePcapBytes } from './pcap-parse.utils';
import { parsePcapngBytes } from './pcapng-parse.utils';

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function finishDataset(
  partial: Omit<TrafficDataset, 'protocols' | 'talkers' | 'totalPackets' | 'totalBytes' | 'durationMs'> & {
    protocols?: TrafficProtocolStat[];
    talkers?: TrafficTalker[];
    totalPackets?: number;
    totalBytes?: number;
    durationMs?: number;
  }
): TrafficDataset {
  const protoMap = new Map<string, TrafficProtocolStat>();
  const talkerMap = new Map<string, TrafficTalker>();
  for (const flow of partial.flows) {
    const proto = protoMap.get(flow.protocol) ?? { name: flow.protocol, packets: 0, bytes: 0 };
    proto.packets += flow.packets;
    proto.bytes += flow.bytes;
    protoMap.set(flow.protocol, proto);
    for (const host of [flow.src, flow.dst]) {
      if (!host) continue;
      const talker = talkerMap.get(host) ?? { host, packets: 0, bytes: 0 };
      talker.packets += flow.packets;
      talker.bytes += flow.bytes;
      talkerMap.set(host, talker);
    }
  }
  const totalPackets = partial.flows.reduce((sum, f) => sum + f.packets, 0);
  const totalBytes = partial.flows.reduce((sum, f) => sum + f.bytes, 0);
  const durationMs = partial.flows.reduce((max, f) => Math.max(max, f.endMs), 0);
  return {
    name: partial.name,
    sourceKind: partial.sourceKind,
    flows: partial.flows,
    warnings: partial.warnings,
    protocols: [...protoMap.values()].sort((a, b) => b.bytes - a.bytes),
    talkers: [...talkerMap.values()].sort((a, b) => b.bytes - a.bytes),
    totalPackets,
    totalBytes,
    durationMs
  };
}

export function flowsFromPackets(packets: PcapPacket[], name: string, sourceKind: TrafficSourceKind, warnings: string[] = []): TrafficDataset {
  const map = new Map<string, TrafficFlow>();
  packets.forEach((pkt) => {
    const src = pkt.srcIp || pkt.srcMac || 'unknown';
    const dst = pkt.dstIp || pkt.dstMac || 'unknown';
    const a = `${pkt.protocol}|${src}|${pkt.srcPort ?? ''}`;
    const b = `${pkt.protocol}|${dst}|${pkt.dstPort ?? ''}`;
    const forward = a <= b;
    const id = forward ? `${a}|${b}` : `${b}|${a}`;
    let flow = map.get(id);
    if (!flow) {
      flow = {
        id: `f-${map.size + 1}`,
        protocol: pkt.protocol,
        src: forward ? src : dst,
        dst: forward ? dst : src,
        srcPort: forward ? pkt.srcPort : pkt.dstPort,
        dstPort: forward ? pkt.dstPort : pkt.srcPort,
        packets: 0,
        bytes: 0,
        startMs: pkt.relMs,
        endMs: pkt.relMs
      };
      map.set(id, flow);
    }
    if (pkt.protocol === 'HTTP') flow.protocol = 'HTTP';
    flow.packets += 1;
    flow.bytes += pkt.inclLen;
    flow.startMs = Math.min(flow.startMs, pkt.relMs);
    flow.endMs = Math.max(flow.endMs, pkt.relMs);
  });
  const flows = [...map.values()].map((flow, i) => ({ ...flow, id: `f-${i + 1}` }));
  return finishDataset({ name, sourceKind, flows, warnings });
}

function parseJsonTraffic(text: string): TrafficDataset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid traffic JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('Traffic JSON must be an object');
  const rec = data as Record<string, unknown>;
  const raw = Array.isArray(rec.flows) ? rec.flows : Array.isArray(rec.conversations) ? rec.conversations : null;
  if (!raw) throw new Error('Traffic JSON is missing flows');
  const warnings: string[] = [];
  const flows: TrafficFlow[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(row.id, `f-${i + 1}`),
      protocol: asString(row.protocol ?? row.proto, 'IP').toUpperCase(),
      src: asString(row.src ?? row.source),
      dst: asString(row.dst ?? row.destination),
      srcPort: row.srcPort == null && row.sport == null ? null : Math.round(asNumber(row.srcPort ?? row.sport)),
      dstPort: row.dstPort == null && row.dport == null ? null : Math.round(asNumber(row.dstPort ?? row.dport)),
      packets: Math.max(0, Math.round(asNumber(row.packets, 1))),
      bytes: Math.max(0, Math.round(asNumber(row.bytes ?? row.octets))),
      startMs: asNumber(row.startMs ?? row.start_ms),
      endMs: asNumber(row.endMs ?? row.end_ms)
    };
  });
  if (!flows.length) warnings.push('Traffic JSON contains no flows.');
  return finishDataset({
    name: asString(rec.name ?? rec.title, 'Traffic snapshot'),
    sourceKind: 'json',
    flows,
    warnings
  });
}

function parseCsvTraffic(text: string): TrafficDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('Traffic CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const srcI = idx('src') >= 0 ? idx('src') : idx('source');
  const dstI = idx('dst') >= 0 ? idx('dst') : idx('destination');
  const protoI = idx('protocol') >= 0 ? idx('protocol') : idx('proto');
  const pktI = idx('packets') >= 0 ? idx('packets') : idx('pkts');
  const byteI = idx('bytes') >= 0 ? idx('bytes') : idx('octets');
  if (srcI < 0 || dstI < 0 || protoI < 0) throw new Error('Traffic CSV needs src, dst, and protocol columns');
  const spI = idx('src_port') >= 0 ? idx('src_port') : idx('sport');
  const dpI = idx('dst_port') >= 0 ? idx('dst_port') : idx('dport');
  const startI = idx('start_ms') >= 0 ? idx('start_ms') : idx('start');
  const endI = idx('end_ms') >= 0 ? idx('end_ms') : idx('end');
  const flows: TrafficFlow[] = rows.slice(1).map((row, i) => ({
    id: `f-${i + 1}`,
    protocol: (row[protoI] || 'IP').toUpperCase(),
    src: row[srcI] || '',
    dst: row[dstI] || '',
    srcPort: spI >= 0 && row[spI] !== '' ? Number(row[spI]) : null,
    dstPort: dpI >= 0 && row[dpI] !== '' ? Number(row[dpI]) : null,
    packets: pktI >= 0 ? asNumber(row[pktI], 1) : 1,
    bytes: byteI >= 0 ? asNumber(row[byteI]) : 0,
    startMs: startI >= 0 ? asNumber(row[startI]) : 0,
    endMs: endI >= 0 ? asNumber(row[endI]) : 0
  }));
  return finishDataset({ name: 'Traffic CSV', sourceKind: 'csv', flows, warnings: [] });
}

function parseFlowText(text: string): TrafficDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let name = 'Flow dump';
  const flows: TrafficFlow[] = [];
  for (const line of lines) {
    if (line.startsWith('# FLOW')) {
      name = line.replace(/^#\s*FLOW\s*/i, '').trim() || name;
      continue;
    }
    if (line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0]?.toUpperCase() !== 'FLOW' || parts.length < 8) continue;
    flows.push({
      id: `f-${flows.length + 1}`,
      src: parts[1],
      dst: parts[2],
      srcPort: Number(parts[3]),
      dstPort: Number(parts[4]),
      protocol: parts[5].toUpperCase(),
      packets: asNumber(parts[6], 1),
      bytes: asNumber(parts[7]),
      startMs: asNumber(parts[8]),
      endMs: asNumber(parts[9], asNumber(parts[8]))
    });
  }
  if (!flows.length) throw new Error('.flow file has no FLOW rows');
  return finishDataset({ name, sourceKind: 'flow', flows, warnings: [] });
}

export function parseTrafficText(text: string, hint: TrafficSourceKind = 'json'): TrafficDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Traffic file is empty');
  if (trimmed.startsWith('{')) return parseJsonTraffic(trimmed);
  if (/^#\s*FLOW/i.test(trimmed) || hint === 'flow') return parseFlowText(trimmed);
  if (trimmed.includes(',') || hint === 'csv') return parseCsvTraffic(trimmed);
  throw new Error('Unrecognized traffic format — use PCAP/PCAPNG, JSON, CSV, or .flow');
}

export function parseTrafficBytes(bytes: Uint8Array, fileName: string): TrafficDataset {
  if (!bytes.length) throw new Error('Traffic file is empty');
  if (isPcapngMagic(bytes) || /\.(pcapng|ntar)$/i.test(fileName)) {
    const parsed = parsePcapngBytes(bytes);
    return flowsFromPackets(parsed.packets, fileName, 'pcapng', parsed.warnings);
  }
  const magicLe = bytes.length >= 4 && bytes[0] === 0xd4 && bytes[1] === 0xc3 && bytes[2] === 0xb2 && bytes[3] === 0xa1;
  const magicBe = bytes.length >= 4 && bytes[0] === 0xa1 && bytes[1] === 0xb2 && bytes[2] === 0xc3 && bytes[3] === 0xd4;
  if (magicLe || magicBe || /\.(pcap|cap)$/i.test(fileName)) {
    const parsed = parsePcapBytes(bytes);
    return flowsFromPackets(parsed.packets, fileName, 'pcap', parsed.warnings);
  }
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  const hint: TrafficSourceKind = ext === 'csv' ? 'csv' : ext === 'flow' ? 'flow' : 'json';
  return parseTrafficText(text, hint);
}

export function filterTrafficFlows(flows: TrafficFlow[], query: string): TrafficFlow[] {
  const q = query.trim().toLowerCase();
  if (!q) return flows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return flows.filter((f) =>
    tokens.every((token) => {
      if (token === 'tcp') return f.protocol === 'TCP' || f.protocol === 'HTTP';
      if (token === 'udp') return f.protocol === 'UDP' || f.protocol === 'DNS';
      if (token === 'dns') return f.protocol === 'DNS';
      if (token === 'http') return f.protocol === 'HTTP';
      if (token === 'arp') return f.protocol === 'ARP';
      if (token === 'host' || token === 'port') return true;
      if (token.startsWith('host:')) {
        const host = token.slice(5);
        return f.src.includes(host) || f.dst.includes(host);
      }
      if (token.startsWith('port:')) {
        const port = Number(token.slice(5));
        return f.srcPort === port || f.dstPort === port;
      }
      const hay = `${f.protocol} ${f.src} ${f.dst} ${f.srcPort ?? ''} ${f.dstPort ?? ''}`.toLowerCase();
      return hay.includes(token);
    })
  );
}
