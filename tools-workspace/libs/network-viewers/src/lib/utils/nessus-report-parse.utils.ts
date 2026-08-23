import type {
  NessusDataset,
  NessusFinding,
  NessusHostStat,
  NessusSeverityStat,
  NessusSourceKind
} from '../types/nessus-report-viewer.types';

const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

function childText(block: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  return match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() ?? '';
}

export function normalizeNessusSeverity(raw: string | number): string {
  if (typeof raw === 'number') {
    if (raw >= 4) return 'critical';
    if (raw >= 3) return 'high';
    if (raw >= 2) return 'medium';
    if (raw >= 1) return 'low';
    return 'info';
  }
  const v = String(raw).toLowerCase();
  if (['4', 'critical', 'crit'].includes(v)) return 'critical';
  if (['3', 'high'].includes(v)) return 'high';
  if (['2', 'medium', 'med'].includes(v)) return 'medium';
  if (['1', 'low'].includes(v)) return 'low';
  if (['0', 'info', 'informational', 'none'].includes(v)) return 'info';
  return v || 'info';
}

function finishDataset(name: string, sourceKind: NessusSourceKind, findings: NessusFinding[], warnings: string[]): NessusDataset {
  const hostMap = new Map<string, NessusHostStat>();
  const sevMap = new Map<string, NessusSeverityStat>();
  for (const f of findings) {
    const key = f.host || f.ip || 'unknown';
    const rec =
      hostMap.get(key) ??
      { name: f.host || f.ip || 'unknown', ip: f.ip, count: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    rec.count += 1;
    if (f.severity === 'critical') rec.critical += 1;
    else if (f.severity === 'high') rec.high += 1;
    else if (f.severity === 'medium') rec.medium += 1;
    else if (f.severity === 'low') rec.low += 1;
    else rec.info += 1;
    if (!rec.ip && f.ip) rec.ip = f.ip;
    hostMap.set(key, rec);
    const sev = sevMap.get(f.severity) ?? { name: f.severity, count: 0 };
    sev.count += 1;
    sevMap.set(f.severity, sev);
  }
  if (!findings.length) warnings.push('Nessus report contains no findings.');
  return {
    name,
    sourceKind,
    findings,
    hosts: [...hostMap.values()].sort((a, b) => b.critical - a.critical || b.high - a.high || b.count - a.count),
    severities: [...sevMap.values()].sort((a, b) => (SEV_RANK[b.name] ?? 0) - (SEV_RANK[a.name] ?? 0)),
    warnings
  };
}

function parseNessusXml(text: string): NessusDataset {
  if (!/<NessusClientData/i.test(text) && !/<ReportHost\b/i.test(text)) throw new Error('Not a Nessus XML report');
  const reportName = attrs(/<Report\b([^>]*)>/i.exec(text)?.[1] ?? '').name || 'Nessus report';
  const findings: NessusFinding[] = [];
  const hostBlocks = text.match(/<ReportHost\b[\s\S]*?<\/ReportHost>/gi) ?? [];
  hostBlocks.forEach((block) => {
    const hostName = attrs(/<ReportHost\b([^>]*)>/i.exec(block)?.[1] ?? '').name || '';
    const tags: Record<string, string> = {};
    const tagRe = /<tag\s+name="([^"]+)">([^<]*)<\/tag>/gi;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRe.exec(block))) tags[tagMatch[1]] = tagMatch[2].trim();
    const ip = tags['host-ip'] || hostName;
    const itemBlocks = block.match(/<ReportItem\b[\s\S]*?<\/ReportItem>/gi) ?? [];
    itemBlocks.forEach((item) => {
      const open = /<ReportItem\b([^>]*)>/i.exec(item)?.[1] ?? '';
      const a = attrs(open);
      const severity = normalizeNessusSeverity(a.severity ?? childText(item, 'risk_factor'));
      findings.push({
        id: `n-${findings.length + 1}`,
        index: findings.length,
        host: hostName,
        ip,
        port: Math.round(asNumber(a.port)),
        protocol: (a.protocol || a.svc_name || 'tcp').toLowerCase(),
        severity,
        pluginId: a.pluginID || a.pluginId || '',
        pluginName: a.pluginName || childText(item, 'plugin_name') || 'Untitled plugin',
        synopsis: childText(item, 'synopsis') || childText(item, 'description'),
        solution: childText(item, 'solution'),
        cvss: (() => {
          const score = childText(item, 'cvss_base_score') || childText(item, 'cvss3_base_score');
          if (!score) return null;
          const n = Number(score);
          return Number.isFinite(n) ? n : null;
        })(),
        cve: childText(item, 'cve')
      });
    });
  });
  if (!findings.length) throw new Error('Nessus XML contains no findings');
  return finishDataset(reportName, 'nessus', findings, []);
}

function parseJsonNessus(text: string): NessusDataset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid Nessus JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('Nessus JSON must be an object');
  const rec = data as Record<string, unknown>;
  const raw = Array.isArray(rec.findings) ? rec.findings : Array.isArray(rec.vulnerabilities) ? rec.vulnerabilities : null;
  if (!raw) throw new Error('Nessus JSON is missing findings');
  const findings: NessusFinding[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(row.id, `n-${i + 1}`),
      index: i,
      host: asString(row.host ?? row.hostname ?? row.name),
      ip: asString(row.ip ?? row.hostIp),
      port: Math.round(asNumber(row.port)),
      protocol: asString(row.protocol, 'tcp').toLowerCase(),
      severity: normalizeNessusSeverity(asString(row.severity ?? row.risk, 'info')),
      pluginId: asString(row.pluginId ?? row.pluginID ?? row.plugin),
      pluginName: asString(row.pluginName ?? row.title, 'Untitled plugin'),
      synopsis: asString(row.synopsis ?? row.description ?? row.summary),
      solution: asString(row.solution ?? row.remediation),
      cvss: row.cvss == null && row.cvss3 == null ? null : asNumber(row.cvss ?? row.cvss3, NaN) || null,
      cve: asString(row.cve)
    };
  });
  return finishDataset(asString(rec.name ?? rec.title, 'Nessus snapshot'), 'json', findings, []);
}

function parseCsvNessus(text: string): NessusDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('Nessus CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const pluginI = idx('plugin_name') >= 0 ? idx('plugin_name') : idx('plugin') >= 0 ? idx('plugin') : idx('title');
  if (pluginI < 0) throw new Error('Nessus CSV needs a plugin_name column');
  const hostI = idx('host') >= 0 ? idx('host') : idx('hostname');
  const ipI = idx('ip');
  const portI = idx('port');
  const protoI = idx('protocol');
  const sevI = idx('severity') >= 0 ? idx('severity') : idx('risk');
  const idI = idx('plugin_id') >= 0 ? idx('plugin_id') : idx('pluginid');
  const cvssI = idx('cvss');
  const cveI = idx('cve');
  const synI = idx('synopsis') >= 0 ? idx('synopsis') : idx('description');
  const findings: NessusFinding[] = rows.slice(1).map((row, i) => ({
    id: `n-${i + 1}`,
    index: i,
    host: hostI >= 0 ? row[hostI] || '' : '',
    ip: ipI >= 0 ? row[ipI] || '' : '',
    port: portI >= 0 ? Number(row[portI]) || 0 : 0,
    protocol: (protoI >= 0 ? row[protoI] || 'tcp' : 'tcp').toLowerCase(),
    severity: normalizeNessusSeverity(sevI >= 0 ? row[sevI] || 'info' : 'info'),
    pluginId: idI >= 0 ? row[idI] || '' : '',
    pluginName: row[pluginI] || 'Untitled plugin',
    synopsis: synI >= 0 ? row[synI] || '' : '',
    solution: '',
    cvss: cvssI >= 0 && row[cvssI] ? Number(row[cvssI]) : null,
    cve: cveI >= 0 ? row[cveI] || '' : ''
  }));
  return finishDataset('Nessus CSV', 'csv', findings, []);
}

export function parseNessusText(text: string, fileName = ''): NessusDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Nessus report is empty');
  if (trimmed.startsWith('{')) return parseJsonNessus(trimmed);
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (!trimmed.startsWith('<') && trimmed.includes(',') && /plugin/i.test(trimmed.split('\n')[0] || ''))) {
    return parseCsvNessus(trimmed);
  }
  if (/<NessusClientData/i.test(trimmed) || /<ReportHost\b/i.test(trimmed) || ext === 'nessus' || ext === 'xml') {
    return parseNessusXml(trimmed);
  }
  throw new Error('No Nessus findings found — use .nessus XML, CSV, or JSON');
}

export function parseNessusBytes(bytes: Uint8Array, fileName = ''): NessusDataset {
  if (!bytes.length) throw new Error('Nessus report is empty');
  return parseNessusText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterNessusFindings(findings: NessusFinding[], query: string): NessusFinding[] {
  const q = query.trim().toLowerCase();
  if (!q) return findings;
  const tokens = q.split(/\s+/).filter(Boolean);
  return findings.filter((f) =>
    tokens.every((token) => {
      if (['critical', 'high', 'medium', 'low', 'info'].includes(token)) return f.severity === token;
      if (token === 'host' || token === 'plugin' || token === 'cve' || token === 'port') return true;
      if (token.startsWith('host:')) return f.host.toLowerCase().includes(token.slice(5)) || f.ip.includes(token.slice(5));
      if (token.startsWith('plugin:')) return f.pluginId.includes(token.slice(7)) || f.pluginName.toLowerCase().includes(token.slice(7));
      if (token.startsWith('cve:')) return f.cve.toLowerCase().includes(token.slice(4));
      if (token.startsWith('port:')) return f.port === Number(token.slice(5));
      const hay = `${f.host} ${f.ip} ${f.port} ${f.protocol} ${f.severity} ${f.pluginId} ${f.pluginName} ${f.synopsis} ${f.cve}`.toLowerCase();
      return hay.includes(token);
    })
  );
}

export function filterNessusHosts(hosts: NessusHostStat[], query: string): NessusHostStat[] {
  const q = query.trim().toLowerCase();
  if (!q) return hosts;
  return hosts.filter((h) => `${h.name} ${h.ip}`.toLowerCase().includes(q) || ['critical', 'high', 'medium', 'low', 'info'].includes(q) && (h as unknown as Record<string, number>)[q] > 0);
}
