import type {
  SiemCorrelation,
  SiemDataset,
  SiemEvent,
  SiemSeverityStat,
  SiemSourceKind
} from '../types/siem-log-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSeverity(raw: string | number): string {
  if (typeof raw === 'number') {
    if (raw >= 9) return 'critical';
    if (raw >= 7) return 'high';
    if (raw >= 4) return 'medium';
    if (raw >= 2) return 'low';
    return 'info';
  }
  const v = String(raw).toLowerCase();
  if (['critical', 'crit', '10', '9'].includes(v)) return 'critical';
  if (['high', '8', '7'].includes(v)) return 'high';
  if (['medium', 'med', '6', '5', '4'].includes(v)) return 'medium';
  if (['low', '3', '2'].includes(v)) return 'low';
  if (['info', 'informational', '1', '0'].includes(v)) return 'info';
  return v || 'info';
}

const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function higherSeverity(a: string, b: string): string {
  return (SEV_RANK[a] ?? 0) >= (SEV_RANK[b] ?? 0) ? a : b;
}

function parseTimeAbs(value: string, index: number): number {
  const iso = Date.parse(value);
  if (Number.isFinite(iso)) return iso;
  return index * 1000;
}

function buildCorrelations(events: SiemEvent[]): SiemCorrelation[] {
  const map = new Map<string, SiemCorrelation>();
  events.forEach((e) => {
    const key = `${e.ruleId || e.rule}|${e.src || e.host}`;
    let rec = map.get(key);
    if (!rec) {
      rec = {
        id: `c-${map.size + 1}`,
        key,
        label: `${e.rule} · ${e.src || e.host || 'unknown'}`,
        events: 0,
        severity: e.severity,
        firstMs: e.relMs,
        lastMs: e.relMs,
        hosts: [],
        srcs: [],
        rules: []
      };
      map.set(key, rec);
    }
    rec.events += Math.max(1, e.count || 1);
    rec.severity = higherSeverity(rec.severity, e.severity);
    rec.firstMs = Math.min(rec.firstMs, e.relMs);
    rec.lastMs = Math.max(rec.lastMs, e.relMs);
    if (e.host && !rec.hosts.includes(e.host)) rec.hosts.push(e.host);
    if (e.src && !rec.srcs.includes(e.src)) rec.srcs.push(e.src);
    if (e.rule && !rec.rules.includes(e.rule)) rec.rules.push(e.rule);
  });
  return [...map.values()].sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0) || b.events - a.events);
}

function finishDataset(
  name: string,
  sourceKind: SiemSourceKind,
  events: SiemEvent[],
  warnings: string[]
): SiemDataset {
  let minAbs = Infinity;
  const abs = events.map((e, i) => {
    const value = parseTimeAbs(e.time, i);
    if (value < minAbs) minAbs = value;
    return value;
  });
  if (!Number.isFinite(minAbs)) minAbs = 0;
  events.forEach((e, i) => {
    e.relMs = Math.max(0, abs[i] - minAbs);
  });
  const sevMap = new Map<string, SiemSeverityStat>();
  for (const e of events) {
    const rec = sevMap.get(e.severity) ?? { name: e.severity, count: 0 };
    rec.count += 1;
    sevMap.set(e.severity, rec);
  }
  if (!events.length) warnings.push('SIEM export contains no events.');
  return {
    name,
    sourceKind,
    events,
    correlations: buildCorrelations(events),
    severities: [...sevMap.values()].sort((a, b) => (SEV_RANK[b.name] ?? 0) - (SEV_RANK[a.name] ?? 0)),
    durationMs: events.reduce((max, e) => Math.max(max, e.relMs), 0),
    warnings
  };
}

function parseJsonSiem(text: string): SiemDataset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid SIEM JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('SIEM JSON must be an object');
  const rec = data as Record<string, unknown>;
  const raw = Array.isArray(rec.events) ? rec.events : Array.isArray(rec.alerts) ? rec.alerts : Array.isArray(rec.hits) ? rec.hits : null;
  if (!raw) throw new Error('SIEM JSON is missing events');
  const events: SiemEvent[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const source = row._source && typeof row._source === 'object' ? (row._source as Record<string, unknown>) : row;
    return {
      id: asString(row.id ?? source.id, `s-${i + 1}`),
      index: i,
      time: asString(source.time ?? source['@timestamp'] ?? source.timestamp, `t+${i}`),
      relMs: 0,
      severity: normalizeSeverity(asString(source.severity ?? source.level, 'info')),
      rule: asString(source.rule ?? source.ruleName ?? source.signature, 'Untitled rule'),
      ruleId: asString(source.ruleId ?? source.rule_id ?? source.sid),
      host: asString(source.host ?? source.hostname ?? source.dhost),
      user: asString(source.user ?? source.suser ?? source.username, '-'),
      src: asString(source.src ?? source.srcIp ?? source.source),
      dst: asString(source.dst ?? source.dstIp ?? source.destination),
      tactic: asString(source.tactic ?? source.mitreTactic),
      technique: asString(source.technique ?? source.mitreTechnique),
      message: asString(source.message ?? source.msg ?? source.description),
      count: Math.max(1, Math.round(asNumber(source.count, 1)))
    };
  });
  return finishDataset(asString(rec.name ?? rec.title, 'SIEM snapshot'), 'json', events, []);
}

function parseCsvSiem(text: string): SiemDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('SIEM CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const ruleI = idx('rule') >= 0 ? idx('rule') : idx('signature');
  if (ruleI < 0) throw new Error('SIEM CSV needs a rule column');
  const timeI = idx('time') >= 0 ? idx('time') : idx('timestamp');
  const sevI = idx('severity') >= 0 ? idx('severity') : idx('level');
  const hostI = idx('host') >= 0 ? idx('host') : idx('hostname');
  const userI = idx('user');
  const srcI = idx('src') >= 0 ? idx('src') : idx('source');
  const dstI = idx('dst') >= 0 ? idx('dst') : idx('destination');
  const msgI = idx('message') >= 0 ? idx('message') : idx('msg');
  const events: SiemEvent[] = rows.slice(1).map((row, i) => ({
    id: `s-${i + 1}`,
    index: i,
    time: timeI >= 0 ? row[timeI] || `t+${i}` : `t+${i}`,
    relMs: 0,
    severity: normalizeSeverity(sevI >= 0 ? row[sevI] || 'info' : 'info'),
    rule: row[ruleI] || 'Untitled rule',
    ruleId: idx('rule_id') >= 0 ? row[idx('rule_id')] || '' : '',
    host: hostI >= 0 ? row[hostI] || '' : '',
    user: userI >= 0 ? row[userI] || '-' : '-',
    src: srcI >= 0 ? row[srcI] || '' : '',
    dst: dstI >= 0 ? row[dstI] || '' : '',
    tactic: idx('tactic') >= 0 ? row[idx('tactic')] || '' : '',
    technique: idx('technique') >= 0 ? row[idx('technique')] || '' : '',
    message: msgI >= 0 ? row[msgI] || '' : '',
    count: 1
  }));
  return finishDataset('SIEM CSV', 'csv', events, []);
}

function parseCefLine(line: string, index: number): SiemEvent | null {
  if (!/^CEF:/i.test(line)) return null;
  const parts = line.split('|');
  if (parts.length < 7) return null;
  const ext = parts.slice(7).join('|');
  const fields: Record<string, string> = {};
  for (const token of ext.split(/\s+/)) {
    const eq = token.indexOf('=');
    if (eq <= 0) continue;
    fields[token.slice(0, eq)] = token.slice(eq + 1);
  }
  return {
    id: `s-${index + 1}`,
    index,
    time: fields.rt || fields.end || `t+${index}`,
    relMs: 0,
    severity: normalizeSeverity(parts[6] || fields.severity || 'info'),
    rule: parts[5] || 'CEF event',
    ruleId: parts[4] || '',
    host: fields.dhost || fields.dstHost || '',
    user: fields.suser || fields.duser || '-',
    src: fields.src || '',
    dst: fields.dst || '',
    tactic: fields.tactic || '',
    technique: fields.technique || '',
    message: fields.msg || parts[5] || '',
    count: Math.max(1, Number(fields.cnt || 1) || 1)
  };
}

export function parseSiemText(text: string, fileName = ''): SiemDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('SIEM export is empty');
  if (trimmed.startsWith('{')) return parseJsonSiem(trimmed);
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (/^[a-z0-9_,\s]+$/i.test(trimmed.split('\n')[0] || '') && /rule/i.test(trimmed.split('\n')[0] || ''))) {
    return parseCsvSiem(trimmed);
  }
  if (ext === 'cef' || /^CEF:/im.test(trimmed)) {
    const events = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line, i) => parseCefLine(line, i))
      .filter((e): e is SiemEvent => !!e);
    if (!events.length) throw new Error('No CEF events found');
    return finishDataset('SIEM CEF', 'cef', events, []);
  }
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const events: SiemEvent[] = lines.map((line, i) => ({
    id: `s-${i + 1}`,
    index: i,
    time: `t+${i}`,
    relMs: i * 1000,
    severity: /crit|high|fail/i.test(line) ? 'high' : /warn/i.test(line) ? 'medium' : 'info',
    rule: line.slice(0, 80),
    ruleId: '',
    host: '',
    user: '-',
    src: '',
    dst: '',
    tactic: '',
    technique: '',
    message: line.slice(0, 240),
    count: 1
  }));
  if (!events.length) throw new Error('No SIEM events found — use JSON, CSV, or CEF');
  return finishDataset('SIEM log', 'log', events, ['Plain-text SIEM logs are parsed with limited structure.']);
}

export function parseSiemBytes(bytes: Uint8Array, fileName = ''): SiemDataset {
  if (!bytes.length) throw new Error('SIEM export is empty');
  return parseSiemText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterSiemEvents(events: SiemEvent[], query: string): SiemEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return events;
  const tokens = q.split(/\s+/).filter(Boolean);
  return events.filter((e) =>
    tokens.every((token) => {
      if (['critical', 'high', 'medium', 'low', 'info'].includes(token)) return e.severity === token;
      if (token === 'host' || token === 'user' || token === 'port') return true;
      if (token.startsWith('host:')) return e.host.toLowerCase().includes(token.slice(5));
      if (token.startsWith('user:')) return e.user.toLowerCase().includes(token.slice(5));
      const hay = `${e.severity} ${e.rule} ${e.ruleId} ${e.host} ${e.user} ${e.src} ${e.dst} ${e.tactic} ${e.technique} ${e.message}`.toLowerCase();
      return hay.includes(token);
    })
  );
}

export function filterSiemCorrelations(correlations: SiemCorrelation[], query: string): SiemCorrelation[] {
  const q = query.trim().toLowerCase();
  if (!q) return correlations;
  return correlations.filter((c) => `${c.label} ${c.severity} ${c.hosts.join(' ')} ${c.srcs.join(' ')}`.toLowerCase().includes(q));
}
