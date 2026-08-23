import type {
  DnsLogDataset,
  DnsLogSourceKind,
  DnsQuery,
  DnsTypeStat
} from '../types/dns-log-viewer.types';

const QTYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'SOA', 'SRV', 'ANY'];

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function normalizeQtype(raw: string): string {
  const v = raw.toUpperCase();
  return v || 'A';
}

function normalizeRcode(raw: string): string {
  const v = raw.toUpperCase();
  if (!v || v === '-' || v === 'OK' || v === 'SUCCESS') return 'NOERROR';
  if (v === 'NX' || v === 'NXDOMAIN') return 'NXDOMAIN';
  if (v === 'SERVFAIL' || v === 'FAIL') return 'SERVFAIL';
  if (v === 'REFUSED') return 'REFUSED';
  if (v === 'NODATA' || v === 'NOERROR') return v === 'NODATA' ? 'NOERROR' : 'NOERROR';
  return v;
}

function parseTimeAbs(value: string, index: number): number {
  const iso = Date.parse(value);
  if (Number.isFinite(iso)) return iso;
  const syslog = /(?:[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/.exec(value);
  if (syslog) {
    const parsed = Date.parse(`2026 ${syslog[0]} UTC`);
    if (Number.isFinite(parsed)) return parsed;
  }
  const bind = /(\d{1,2}-[A-Z][a-z]{2}-\d{4}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)/.exec(value);
  if (bind) {
    const parsed = Date.parse(bind[1].replace(/(\.\d+)$/, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return index * 1000;
}

function finishDataset(
  name: string,
  sourceKind: DnsLogSourceKind,
  queries: DnsQuery[],
  warnings: string[]
): DnsLogDataset {
  let minAbs = Infinity;
  const abs = queries.map((q, i) => {
    const value = parseTimeAbs(q.time, i);
    if (value < minAbs) minAbs = value;
    return value;
  });
  if (!Number.isFinite(minAbs)) minAbs = 0;
  queries.forEach((q, i) => {
    q.relMs = Math.max(0, abs[i] - minAbs);
  });
  const typeMap = new Map<string, DnsTypeStat>();
  const rcodeMap = new Map<string, DnsTypeStat>();
  for (const q of queries) {
    const t = typeMap.get(q.qtype) ?? { name: q.qtype, count: 0 };
    t.count += 1;
    typeMap.set(q.qtype, t);
    const code = q.rcode || '—';
    const r = rcodeMap.get(code) ?? { name: code, count: 0 };
    r.count += 1;
    rcodeMap.set(code, r);
  }
  if (!queries.length) warnings.push('DNS log contains no queries.');
  return {
    name,
    sourceKind,
    queries,
    types: [...typeMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    rcodes: [...rcodeMap.values()].sort((a, b) => b.count - a.count),
    durationMs: queries.reduce((max, q) => Math.max(max, q.relMs), 0),
    warnings
  };
}

function extractTime(line: string, index: number): string {
  const bind = /(\d{1,2}-[A-Z][a-z]{2}-\d{4}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)/.exec(line);
  if (bind) return bind[1];
  const syslog = /([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/.exec(line);
  if (syslog) return syslog[1];
  const iso = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/.exec(line);
  if (iso) return iso[1];
  return `t+${index}`;
}

function parseBindQuery(line: string, index: number): DnsQuery | null {
  const match =
    /client\s+(?:@\S+\s+)?(\d+\.\d+\.\d+\.\d+|\[?[0-9a-fA-F:]+\]?)(?:#(\d+))?\s*(?:\(([^)]+)\))?\s*:\s*query:\s+(\S+)\s+(?:IN\s+)?(\S+)/i.exec(
      line
    );
  if (!match) return null;
  return {
    id: `dns-${index + 1}`,
    index,
    time: extractTime(line, index),
    relMs: 0,
    client: match[1],
    clientPort: match[2] ? Number(match[2]) : null,
    qname: match[4] || match[3] || '',
    qtype: normalizeQtype(match[5]),
    qclass: 'IN',
    rcode: '',
    answer: '',
    flags: /\+[A-Z]*/.exec(line)?.[0] || '',
    direction: 'query'
  };
}

function parseDnsmasqQuery(line: string, index: number): DnsQuery | null {
  const match = /query\[(\w+)\]\s+(\S+)\s+from\s+(\S+)/i.exec(line);
  if (!match) return null;
  return {
    id: `dns-${index + 1}`,
    index,
    time: extractTime(line, index),
    relMs: 0,
    client: match[3],
    clientPort: null,
    qname: match[2],
    qtype: normalizeQtype(match[1]),
    qclass: 'IN',
    rcode: '',
    answer: '',
    flags: '',
    direction: 'query'
  };
}

function parseDnsmasqReply(line: string): { qname: string; answer: string; rcode: string } | null {
  const nx = /(?:reply|config)\s+(\S+)\s+is\s+(NXDOMAIN|NODATA|REFUSED|SERVFAIL)/i.exec(line);
  if (nx) return { qname: nx[1], answer: '', rcode: normalizeRcode(nx[2]) };
  const reply = /reply\s+(\S+)\s+is\s+(.+)$/i.exec(line);
  if (!reply) return null;
  return { qname: reply[1], answer: reply[2].trim().replace(/^"|"$/g, ''), rcode: 'NOERROR' };
}

function parseJsonDns(text: string): DnsLogDataset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid DNS JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('DNS JSON must be an object');
  const rec = data as Record<string, unknown>;
  const raw = Array.isArray(rec.queries) ? rec.queries : Array.isArray(rec.records) ? rec.records : null;
  if (!raw) throw new Error('DNS JSON is missing queries');
  const queries: DnsQuery[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(row.id, `dns-${i + 1}`),
      index: i,
      time: asString(row.time ?? row.timestamp ?? row.ts, `t+${i}`),
      relMs: 0,
      client: asString(row.client ?? row.src ?? row.source),
      clientPort: row.clientPort == null && row.port == null ? null : Math.round(Number(row.clientPort ?? row.port)),
      qname: asString(row.qname ?? row.name ?? row.domain),
      qtype: normalizeQtype(asString(row.qtype ?? row.type, 'A')),
      qclass: asString(row.qclass, 'IN') || 'IN',
      rcode: normalizeRcode(asString(row.rcode ?? row.status)),
      answer: asString(row.answer ?? row.rdata ?? row.response),
      flags: asString(row.flags),
      direction: asString(row.direction, 'query') === 'response' ? 'response' : 'query'
    };
  });
  return finishDataset(asString(rec.name ?? rec.title, 'DNS snapshot'), 'json', queries, []);
}

function parseCsvDns(text: string): DnsLogDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));
  if (rows.length < 2) throw new Error('DNS CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const nameI = idx('qname') >= 0 ? idx('qname') : idx('name') >= 0 ? idx('name') : idx('domain');
  const typeI = idx('qtype') >= 0 ? idx('qtype') : idx('type');
  if (nameI < 0 || typeI < 0) throw new Error('DNS CSV needs qname and qtype columns');
  const timeI = idx('time') >= 0 ? idx('time') : idx('timestamp');
  const clientI = idx('client') >= 0 ? idx('client') : idx('src');
  const rcodeI = idx('rcode') >= 0 ? idx('rcode') : idx('status');
  const answerI = idx('answer') >= 0 ? idx('answer') : idx('rdata');
  const queries: DnsQuery[] = rows.slice(1).map((row, i) => ({
    id: `dns-${i + 1}`,
    index: i,
    time: timeI >= 0 ? row[timeI] || `t+${i}` : `t+${i}`,
    relMs: 0,
    client: clientI >= 0 ? row[clientI] || '' : '',
    clientPort: null,
    qname: row[nameI] || '',
    qtype: normalizeQtype(row[typeI] || 'A'),
    qclass: 'IN',
    rcode: normalizeRcode(rcodeI >= 0 ? row[rcodeI] || '' : ''),
    answer: answerI >= 0 ? row[answerI] || '' : '',
    flags: '',
    direction: 'query'
  }));
  return finishDataset('DNS CSV', 'csv', queries, []);
}

function parseTextDns(text: string): DnsLogDataset {
  const nameMatch = /^#\s*DNS\s+(.+)$/im.exec(text);
  const name = nameMatch?.[1]?.trim() || 'DNS log';
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const queries: DnsQuery[] = [];
  for (const line of lines) {
    const query = parseBindQuery(line, queries.length) ?? parseDnsmasqQuery(line, queries.length);
    if (query) {
      query.index = queries.length;
      query.id = `dns-${queries.length + 1}`;
      queries.push(query);
      continue;
    }
    const reply = parseDnsmasqReply(line);
    if (!reply) continue;
    const prior = [...queries].reverse().find((q) => q.qname.toLowerCase() === reply.qname.toLowerCase() && !q.rcode);
    if (prior) {
      prior.rcode = reply.rcode;
      prior.answer = reply.answer;
      if (reply.rcode && reply.rcode !== 'NOERROR') prior.direction = 'query';
    } else {
      queries.push({
        id: `dns-${queries.length + 1}`,
        index: queries.length,
        time: extractTime(line, queries.length),
        relMs: 0,
        client: '',
        clientPort: null,
        qname: reply.qname,
        qtype: 'A',
        qclass: 'IN',
        rcode: reply.rcode,
        answer: reply.answer,
        flags: '',
        direction: 'response'
      });
    }
  }
  if (!queries.length) throw new Error('No DNS queries found — use BIND/dnsmasq logs, CSV, or JSON');
  return finishDataset(name, 'log', queries, []);
}

export function parseDnsLogText(text: string, fileName = ''): DnsLogDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('DNS log is empty');
  if (trimmed.startsWith('{')) return parseJsonDns(trimmed);
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  const header = trimmed.split('\n')[0] || '';
  if (ext === 'csv' || (!trimmed.startsWith('#') && trimmed.includes(',') && /qname|domain|name/i.test(header) && /qtype|type/i.test(header))) {
    return parseCsvDns(trimmed);
  }
  return parseTextDns(trimmed);
}

export function parseDnsLogBytes(bytes: Uint8Array, fileName = ''): DnsLogDataset {
  if (!bytes.length) throw new Error('DNS log is empty');
  return parseDnsLogText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterDnsQueries(queries: DnsQuery[], query: string): DnsQuery[] {
  const q = query.trim().toLowerCase();
  if (!q) return queries;
  const tokens = q.split(/\s+/).filter(Boolean);
  return queries.filter((item) =>
    tokens.every((token) => {
      if (QTYPES.map((t) => t.toLowerCase()).includes(token)) return item.qtype.toLowerCase() === token;
      if (['nxdomain', 'noerror', 'servfail', 'refused', 'nodata'].includes(token)) {
        return item.rcode.toLowerCase() === (token === 'nodata' ? 'noerror' : token);
      }
      if (token === 'client' || token === 'name' || token === 'type') return true;
      if (token.startsWith('client:')) return item.client.includes(token.slice(7));
      if (token.startsWith('name:')) return item.qname.toLowerCase().includes(token.slice(5));
      if (token.startsWith('type:')) return item.qtype.toLowerCase() === token.slice(5);
      const hay = `${item.client} ${item.qname} ${item.qtype} ${item.rcode} ${item.answer} ${item.flags}`.toLowerCase();
      return hay.includes(token);
    })
  );
}
