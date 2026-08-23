import type {
  FirewallActionStat,
  FirewallDataset,
  FirewallEvent,
  FirewallSourceKind
} from '../types/firewall-log-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAction(raw: string): string {
  const v = raw.toLowerCase();
  if (v.includes('allow') || v.includes('accept') || v === 'pass') return 'allow';
  if (v.includes('block') || v.includes('deny')) return 'deny';
  if (v.includes('drop')) return 'drop';
  if (v.includes('reject')) return 'reject';
  if (v.includes('nat') || v.includes('masq')) return 'nat';
  return raw || 'unknown';
}

function kv(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /\b([A-Z]{1,12})=(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line))) out[match[1]] = match[2];
  return out;
}

function parseTimeToMs(value: string, index: number): { time: string; relMs: number; abs: number } {
  const iso = Date.parse(value);
  if (Number.isFinite(iso)) return { time: new Date(iso).toISOString(), relMs: 0, abs: iso };
  const syslog = /^(?:[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/.exec(value);
  if (syslog) {
    const parsed = Date.parse(`2026 ${syslog[0]} UTC`);
    if (Number.isFinite(parsed)) return { time: syslog[0], relMs: 0, abs: parsed };
  }
  return { time: value || `t+${index}`, relMs: index * 1000, abs: index * 1000 };
}

function finishDataset(
  name: string,
  sourceKind: FirewallSourceKind,
  events: FirewallEvent[],
  warnings: string[]
): FirewallDataset {
  let minAbs = Infinity;
  const abs = events.map((e, i) => {
    const parsed = Date.parse(e.time);
    const value = Number.isFinite(parsed) ? parsed : i * 1000;
    if (value < minAbs) minAbs = value;
    return value;
  });
  if (!Number.isFinite(minAbs)) minAbs = 0;
  events.forEach((e, i) => {
    e.relMs = Math.max(0, abs[i] - minAbs);
  });
  const durationMs = events.reduce((max, e) => Math.max(max, e.relMs), 0);
  const actionMap = new Map<string, FirewallActionStat>();
  for (const e of events) {
    const rec = actionMap.get(e.action) ?? { name: e.action, count: 0, bytesHint: 0 };
    rec.count += 1;
    rec.bytesHint += 64;
    actionMap.set(e.action, rec);
  }
  if (!events.length) warnings.push('Firewall log contains no events.');
  return {
    name,
    sourceKind,
    events,
    actions: [...actionMap.values()].sort((a, b) => b.count - a.count),
    durationMs,
    warnings
  };
}

function parseJsonFirewall(text: string): FirewallDataset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid firewall JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('Firewall JSON must be an object');
  const rec = data as Record<string, unknown>;
  const raw = Array.isArray(rec.events) ? rec.events : Array.isArray(rec.records) ? rec.records : null;
  if (!raw) throw new Error('Firewall JSON is missing events');
  const events: FirewallEvent[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const stamp = parseTimeToMs(asString(row.time ?? row.timestamp ?? row.ts), i);
    return {
      id: asString(row.id, `fw-${i + 1}`),
      index: i,
      time: stamp.time,
      relMs: stamp.relMs,
      action: normalizeAction(asString(row.action ?? row.disposition, 'unknown')),
      src: asString(row.src ?? row.source ?? row.srcIp),
      dst: asString(row.dst ?? row.destination ?? row.dstIp),
      srcPort: row.srcPort == null && row.spt == null ? null : Math.round(asNumber(row.srcPort ?? row.spt)),
      dstPort: row.dstPort == null && row.dpt == null ? null : Math.round(asNumber(row.dstPort ?? row.dpt)),
      protocol: asString(row.protocol ?? row.proto, 'IP').toUpperCase(),
      rule: asString(row.rule ?? row.policy, '—'),
      iface: asString(row.iface ?? row.interface ?? row.in),
      message: asString(row.message ?? row.msg)
    };
  });
  return finishDataset(asString(rec.name ?? rec.title, 'Firewall snapshot'), 'json', events, []);
}

function parseCsvFirewall(text: string): FirewallDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('Firewall CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const actionI = idx('action') >= 0 ? idx('action') : idx('disposition');
  const srcI = idx('src') >= 0 ? idx('src') : idx('source');
  const dstI = idx('dst') >= 0 ? idx('dst') : idx('destination');
  if (actionI < 0 || srcI < 0 || dstI < 0) throw new Error('Firewall CSV needs action, src, and dst columns');
  const timeI = idx('time') >= 0 ? idx('time') : idx('timestamp');
  const protoI = idx('protocol') >= 0 ? idx('protocol') : idx('proto');
  const spI = idx('src_port') >= 0 ? idx('src_port') : idx('spt');
  const dpI = idx('dst_port') >= 0 ? idx('dst_port') : idx('dpt');
  const ruleI = idx('rule');
  const ifI = idx('iface') >= 0 ? idx('iface') : idx('interface');
  const events: FirewallEvent[] = rows.slice(1).map((row, i) => {
    const stamp = parseTimeToMs(timeI >= 0 ? row[timeI] || '' : '', i);
    return {
      id: `fw-${i + 1}`,
      index: i,
      time: stamp.time,
      relMs: stamp.relMs,
      action: normalizeAction(row[actionI] || 'unknown'),
      src: row[srcI] || '',
      dst: row[dstI] || '',
      srcPort: spI >= 0 && row[spI] ? Number(row[spI]) : null,
      dstPort: dpI >= 0 && row[dpI] ? Number(row[dpI]) : null,
      protocol: (protoI >= 0 ? row[protoI] : 'IP').toUpperCase(),
      rule: ruleI >= 0 ? row[ruleI] || '—' : '—',
      iface: ifI >= 0 ? row[ifI] || '' : '',
      message: ''
    };
  });
  return finishDataset('Firewall CSV', 'csv', events, []);
}

function parseTextFirewall(text: string): FirewallDataset {
  const nameMatch = /^#\s*FIREWALL\s+(.+)$/im.exec(text);
  const name = nameMatch?.[1]?.trim() || 'Firewall log';
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const events: FirewallEvent[] = [];
  for (const line of lines) {
    const actionMatch = /\[(?:UFW\s+)?(ALLOW|BLOCK|DROP|REJECT|DENY|ACCEPT)\]/i.exec(line);
    if (!actionMatch && !/\bSRC=/.test(line) && !/\bDST=/.test(line)) continue;
    const fields = kv(line);
    const stamp = parseTimeToMs(line, events.length);
    const action = normalizeAction(actionMatch?.[1] || fields.ACTION || 'unknown');
    events.push({
      id: `fw-${events.length + 1}`,
      index: events.length,
      time: stamp.time,
      relMs: stamp.relMs,
      action,
      src: fields.SRC || '',
      dst: fields.DST || '',
      srcPort: fields.SPT ? Number(fields.SPT) : null,
      dstPort: fields.DPT ? Number(fields.DPT) : null,
      protocol: (fields.PROTO || 'IP').toUpperCase(),
      rule: actionMatch?.[0]?.replace(/[\[\]]/g, '') || '—',
      iface: fields.IN || fields.OUT || '',
      message: line.slice(0, 240)
    });
  }
  if (!events.length) throw new Error('No firewall events found — use iptables/UFW logs, CSV, or JSON');
  return finishDataset(name, 'log', events, []);
}

export function parseFirewallText(text: string, fileName = ''): FirewallDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Firewall log is empty');
  if (trimmed.startsWith('{')) return parseJsonFirewall(trimmed);
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (!trimmed.startsWith('#') && trimmed.includes(',') && /action/i.test(trimmed.split('\n')[0] || ''))) {
    return parseCsvFirewall(trimmed);
  }
  return parseTextFirewall(trimmed);
}

export function parseFirewallBytes(bytes: Uint8Array, fileName = ''): FirewallDataset {
  if (!bytes.length) throw new Error('Firewall log is empty');
  return parseFirewallText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterFirewallEvents(events: FirewallEvent[], query: string): FirewallEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return events;
  const tokens = q.split(/\s+/).filter(Boolean);
  return events.filter((e) =>
    tokens.every((token) => {
      if (['allow', 'deny', 'drop', 'reject', 'block', 'nat'].includes(token)) {
        return token === 'block' ? e.action === 'deny' : e.action === token;
      }
      if (['tcp', 'udp', 'icmp'].includes(token)) return e.protocol.toLowerCase() === token;
      if (token === 'host' || token === 'port') return true;
      if (token.startsWith('host:')) return e.src.includes(token.slice(5)) || e.dst.includes(token.slice(5));
      if (token.startsWith('port:')) {
        const port = Number(token.slice(5));
        return e.srcPort === port || e.dstPort === port;
      }
      const hay = `${e.action} ${e.src} ${e.dst} ${e.srcPort ?? ''} ${e.dstPort ?? ''} ${e.protocol} ${e.rule} ${e.iface} ${e.message}`.toLowerCase();
      return hay.includes(token);
    })
  );
}
