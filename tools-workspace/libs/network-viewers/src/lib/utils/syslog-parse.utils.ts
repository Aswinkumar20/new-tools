import type {
  SyslogDataset,
  SyslogMessage,
  SyslogSourceKind,
  SyslogStat
} from '../types/syslog-viewer.types';

export const SYSLOG_FACILITIES = [
  'kern',
  'user',
  'mail',
  'daemon',
  'auth',
  'syslog',
  'lpr',
  'news',
  'uucp',
  'cron',
  'authpriv',
  'ftp',
  'ntp',
  'audit',
  'alert',
  'clock',
  'local0',
  'local1',
  'local2',
  'local3',
  'local4',
  'local5',
  'local6',
  'local7'
] as const;

export const SYSLOG_SEVERITIES = [
  'emerg',
  'alert',
  'crit',
  'err',
  'warning',
  'notice',
  'info',
  'debug'
] as const;

const SEV_RANK: Record<string, number> = {
  emerg: 7,
  alert: 6,
  crit: 5,
  err: 4,
  warning: 3,
  notice: 2,
  info: 1,
  debug: 0
};

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function decodePri(pri: number): { facility: string; severity: string } {
  const facilityIdx = Math.floor(pri / 8);
  const severityIdx = pri % 8;
  return {
    facility: SYSLOG_FACILITIES[facilityIdx] ?? `facility-${facilityIdx}`,
    severity: SYSLOG_SEVERITIES[severityIdx] ?? `severity-${severityIdx}`
  };
}

function normalizeFacility(raw: string): string {
  const v = raw.toLowerCase();
  if ((SYSLOG_FACILITIES as readonly string[]).includes(v)) return v;
  const idx = SYSLOG_FACILITIES.findIndex((f) => f === v || f.startsWith(v));
  return idx >= 0 ? SYSLOG_FACILITIES[idx] : v || 'user';
}

function normalizeSeverity(raw: string): string {
  const v = raw.toLowerCase();
  if (v === 'error' || v === 'err') return 'err';
  if (v === 'warn' || v === 'warning') return 'warning';
  if (v === 'emergency' || v === 'panic') return 'emerg';
  if (v === 'critical') return 'crit';
  if (v === 'informational') return 'info';
  if ((SYSLOG_SEVERITIES as readonly string[]).includes(v)) return v;
  return v || 'info';
}

function parseTimeAbs(value: string, index: number): number {
  const iso = Date.parse(value);
  if (Number.isFinite(iso)) return iso;
  const syslog = /(?:[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/.exec(value);
  if (syslog) {
    const parsed = Date.parse(`2026 ${syslog[0]} UTC`);
    if (Number.isFinite(parsed)) return parsed;
  }
  const bind = /(\d{1,2}-[A-Z][a-z]{2}-\d{4}\s+\d{2}:\d{2}:\d{2})/.exec(value);
  if (bind) {
    const parsed = Date.parse(bind[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return index * 1000;
}

function finishDataset(
  name: string,
  sourceKind: SyslogSourceKind,
  messages: SyslogMessage[],
  warnings: string[]
): SyslogDataset {
  let minAbs = Infinity;
  const abs = messages.map((m, i) => {
    const value = parseTimeAbs(m.time, i);
    if (value < minAbs) minAbs = value;
    return value;
  });
  if (!Number.isFinite(minAbs)) minAbs = 0;
  messages.forEach((m, i) => {
    m.relMs = Math.max(0, abs[i] - minAbs);
  });
  const facMap = new Map<string, SyslogStat>();
  const sevMap = new Map<string, SyslogStat>();
  for (const m of messages) {
    const fac = facMap.get(m.facility) ?? { name: m.facility, count: 0 };
    fac.count += 1;
    facMap.set(m.facility, fac);
    const sev = sevMap.get(m.severity) ?? { name: m.severity, count: 0 };
    sev.count += 1;
    sevMap.set(m.severity, sev);
  }
  if (!messages.length) warnings.push('Syslog dump contains no messages.');
  return {
    name,
    sourceKind,
    messages,
    facilities: [...facMap.values()].sort((a, b) => b.count - a.count),
    severities: [...sevMap.values()].sort((a, b) => (SEV_RANK[b.name] ?? 0) - (SEV_RANK[a.name] ?? 0)),
    durationMs: messages.reduce((max, m) => Math.max(max, m.relMs), 0),
    warnings
  };
}

function parseRfc5424(line: string, index: number): SyslogMessage | null {
  const match = /^<(\d+)>(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/.exec(line);
  if (!match) return null;
  const pri = Number(match[1]);
  const decoded = Number.isFinite(pri) ? decodePri(pri) : { facility: 'user', severity: 'info' };
  return {
    id: `sys-${index + 1}`,
    index,
    time: match[3],
    relMs: 0,
    pri: Number.isFinite(pri) ? pri : null,
    facility: decoded.facility,
    severity: decoded.severity,
    host: match[4] === '-' ? '' : match[4],
    app: match[5] === '-' ? '' : match[5],
    pid: match[6] === '-' ? '' : match[6],
    message: match[8].replace(/^-+\s*/, '').trim()
  };
}

function parseRfc3164(line: string, index: number): SyslogMessage | null {
  const withPri = /^<(\d+)>([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.+)$/.exec(line);
  if (withPri) {
    const pri = Number(withPri[1]);
    const decoded = Number.isFinite(pri) ? decodePri(pri) : { facility: 'user', severity: 'info' };
    const rest = withPri[4];
    const tag = /^([^:\s]+?)(?:\[(\d+)\])?:\s*(.*)$/.exec(rest);
    return {
      id: `sys-${index + 1}`,
      index,
      time: withPri[2],
      relMs: 0,
      pri: Number.isFinite(pri) ? pri : null,
      facility: decoded.facility,
      severity: decoded.severity,
      host: withPri[3],
      app: tag?.[1] || '',
      pid: tag?.[2] || '',
      message: tag?.[3] ?? rest
    };
  }
  const plain = /^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.+)$/.exec(line);
  if (!plain) return null;
  const rest = plain[3];
  const tag = /^([^:\s]+?)(?:\[(\d+)\])?:\s*(.*)$/.exec(rest);
  return {
    id: `sys-${index + 1}`,
    index,
    time: plain[1],
    relMs: 0,
    pri: null,
    facility: 'user',
    severity: /fail|error|crit|oom|kill/i.test(rest) ? 'err' : /warn/i.test(rest) ? 'warning' : 'info',
    host: plain[2],
    app: tag?.[1] || '',
    pid: tag?.[2] || '',
    message: tag?.[3] ?? rest
  };
}

function parseJsonSyslog(text: string): SyslogDataset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid syslog JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('Syslog JSON must be an object');
  const rec = data as Record<string, unknown>;
  const raw = Array.isArray(rec.messages) ? rec.messages : Array.isArray(rec.events) ? rec.events : null;
  if (!raw) throw new Error('Syslog JSON is missing messages');
  const messages: SyslogMessage[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const pri = row.pri == null ? null : Number(row.pri);
    const decoded = pri != null && Number.isFinite(pri) ? decodePri(pri) : null;
    return {
      id: asString(row.id, `sys-${i + 1}`),
      index: i,
      time: asString(row.time ?? row.timestamp ?? row.ts, `t+${i}`),
      relMs: 0,
      pri: pri != null && Number.isFinite(pri) ? pri : null,
      facility: normalizeFacility(asString(row.facility ?? decoded?.facility, 'user')),
      severity: normalizeSeverity(asString(row.severity ?? row.level ?? decoded?.severity, 'info')),
      host: asString(row.host ?? row.hostname),
      app: asString(row.app ?? row.program ?? row.tag),
      pid: asString(row.pid ?? row.procid),
      message: asString(row.message ?? row.msg)
    };
  });
  return finishDataset(asString(rec.name ?? rec.title, 'Syslog snapshot'), 'json', messages, []);
}

function parseCsvSyslog(text: string): SyslogDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('Syslog CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const msgI = idx('message') >= 0 ? idx('message') : idx('msg');
  const hostI = idx('host') >= 0 ? idx('host') : idx('hostname');
  if (msgI < 0 || hostI < 0) throw new Error('Syslog CSV needs host and message columns');
  const timeI = idx('time') >= 0 ? idx('time') : idx('timestamp');
  const facI = idx('facility');
  const sevI = idx('severity') >= 0 ? idx('severity') : idx('level');
  const appI = idx('app') >= 0 ? idx('app') : idx('program');
  const messages: SyslogMessage[] = rows.slice(1).map((row, i) => ({
    id: `sys-${i + 1}`,
    index: i,
    time: timeI >= 0 ? row[timeI] || `t+${i}` : `t+${i}`,
    relMs: 0,
    pri: null,
    facility: normalizeFacility(facI >= 0 ? row[facI] || 'user' : 'user'),
    severity: normalizeSeverity(sevI >= 0 ? row[sevI] || 'info' : 'info'),
    host: row[hostI] || '',
    app: appI >= 0 ? row[appI] || '' : '',
    pid: '',
    message: row[msgI] || ''
  }));
  return finishDataset('Syslog CSV', 'csv', messages, []);
}

function parseTextSyslog(text: string): SyslogDataset {
  const nameMatch = /^#\s*SYSLOG\s+(.+)$/im.exec(text);
  const name = nameMatch?.[1]?.trim() || 'Syslog dump';
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const messages: SyslogMessage[] = [];
  let rfc5424 = 0;
  for (const line of lines) {
    const parsed = parseRfc5424(line, messages.length) ?? parseRfc3164(line, messages.length);
    if (!parsed) continue;
    if (/^\<\d+\>\d+\s/.test(line)) rfc5424 += 1;
    parsed.index = messages.length;
    parsed.id = `sys-${messages.length + 1}`;
    messages.push(parsed);
  }
  if (!messages.length) throw new Error('No syslog messages found — use RFC 3164/5424 logs, CSV, or JSON');
  return finishDataset(name, rfc5424 > 0 && rfc5424 >= messages.length / 2 ? 'rfc5424' : 'log', messages, []);
}

export function parseSyslogText(text: string, fileName = ''): SyslogDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Syslog dump is empty');
  if (trimmed.startsWith('{')) return parseJsonSyslog(trimmed);
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (!trimmed.startsWith('#') && trimmed.includes(',') && /host/i.test(trimmed.split('\n')[0] || '') && /message|msg/i.test(trimmed.split('\n')[0] || ''))) {
    return parseCsvSyslog(trimmed);
  }
  return parseTextSyslog(trimmed);
}

export function parseSyslogBytes(bytes: Uint8Array, fileName = ''): SyslogDataset {
  if (!bytes.length) throw new Error('Syslog dump is empty');
  return parseSyslogText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterSyslogMessages(messages: SyslogMessage[], query: string): SyslogMessage[] {
  const q = query.trim().toLowerCase();
  if (!q) return messages;
  const tokens = q.split(/\s+/).filter(Boolean);
  return messages.filter((m) =>
    tokens.every((token) => {
      if ((SYSLOG_SEVERITIES as readonly string[]).includes(token) || token === 'error' || token === 'warn') {
        const sev = token === 'error' ? 'err' : token === 'warn' ? 'warning' : token;
        return m.severity === sev;
      }
      if ((SYSLOG_FACILITIES as readonly string[]).includes(token)) return m.facility === token;
      if (token === 'host' || token === 'app' || token === 'facility' || token === 'severity') return true;
      if (token.startsWith('host:')) return m.host.toLowerCase().includes(token.slice(5));
      if (token.startsWith('app:')) return m.app.toLowerCase().includes(token.slice(4));
      if (token.startsWith('facility:')) return m.facility === token.slice(9);
      if (token.startsWith('sev:') || token.startsWith('severity:')) {
        const sev = token.includes('severity:') ? token.slice(9) : token.slice(4);
        return m.severity === (sev === 'error' ? 'err' : sev);
      }
      const hay = `${m.facility} ${m.severity} ${m.host} ${m.app} ${m.pid} ${m.message} ${m.pri ?? ''}`.toLowerCase();
      return hay.includes(token);
    })
  );
}
