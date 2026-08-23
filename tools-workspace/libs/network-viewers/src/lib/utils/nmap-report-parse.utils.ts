import type {
  NmapDataset,
  NmapHost,
  NmapPort,
  NmapSourceKind,
  NmapStat
} from '../types/nmap-report-viewer.types';

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

function normalizeState(raw: string): string {
  const v = raw.toLowerCase();
  if (v.includes('open')) return 'open';
  if (v.includes('closed')) return 'closed';
  if (v.includes('filter')) return 'filtered';
  return v || 'unknown';
}

function finishDataset(name: string, sourceKind: NmapSourceKind, hosts: NmapHost[], args: string, warnings: string[]): NmapDataset {
  const ports = hosts.flatMap((h) => h.ports);
  const serviceMap = new Map<string, NmapStat>();
  const stateMap = new Map<string, NmapStat>();
  for (const p of ports) {
    const svc = p.service || 'unknown';
    const s = serviceMap.get(svc) ?? { name: svc, count: 0 };
    s.count += 1;
    serviceMap.set(svc, s);
    const st = stateMap.get(p.state) ?? { name: p.state, count: 0 };
    st.count += 1;
    stateMap.set(p.state, st);
  }
  if (!hosts.length) warnings.push('Nmap report contains no hosts.');
  return {
    name,
    sourceKind,
    args,
    hosts,
    ports,
    services: [...serviceMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    states: [...stateMap.values()].sort((a, b) => b.count - a.count),
    warnings
  };
}

function parseXmlNmap(text: string): NmapDataset {
  if (!/<nmaprun[\s>]/i.test(text)) throw new Error('Not an Nmap XML report');
  const runTag = /<nmaprun\b([^>]*)>/i.exec(text)?.[1] ?? '';
  const run = attrs(runTag);
  const name = asString(run.args, 'Nmap scan');
  const hosts: NmapHost[] = [];
  const hostBlocks = text.match(/<host\b[\s\S]*?<\/host>/gi) ?? [];
  hostBlocks.forEach((block, i) => {
    const status = attrs(/<status\b([^>]*)\/?>/i.exec(block)?.[1] ?? '').state || 'unknown';
    const addr = attrs(/<address\b([^>]*)\/?>/i.exec(block)?.[1] ?? '');
    const hostname = attrs(/<hostname\b([^>]*)\/?>/i.exec(block)?.[1] ?? '').name || '';
    const os = attrs(/<osmatch\b([^>]*)\/?>/i.exec(block)?.[1] ?? '').name || '';
    const ip = addr.addr || hostname || `host-${i + 1}`;
    const hostId = `h-${i + 1}`;
    const ports: NmapPort[] = [];
    const portBlocks = block.match(/<port\b[\s\S]*?<\/port>/gi) ?? [];
    portBlocks.forEach((pBlock, pi) => {
      const pOpen = /<port\b([^>]*)>/i.exec(pBlock)?.[1] ?? '';
      const pAttrs = attrs(pOpen);
      const state = normalizeState(attrs(/<state\b([^>]*)\/?>/i.exec(pBlock)?.[1] ?? '').state || '');
      const svc = attrs(/<service\b([^>]*)\/?>/i.exec(pBlock)?.[1] ?? '');
      ports.push({
        id: `${hostId}-p-${pi + 1}`,
        hostId,
        ip,
        hostname,
        protocol: (pAttrs.protocol || 'tcp').toLowerCase(),
        port: Math.round(asNumber(pAttrs.portid)),
        state,
        service: svc.name || '',
        product: svc.product || '',
        version: svc.version || ''
      });
    });
    hosts.push({
      id: hostId,
      index: i,
      ip,
      hostname,
      status: status.toLowerCase(),
      os,
      ports,
      openCount: ports.filter((p) => p.state === 'open').length
    });
  });
  if (!hosts.length) throw new Error('Nmap XML contains no hosts');
  return finishDataset(name, 'xml', hosts, asString(run.args), []);
}

function parseGnmap(text: string): NmapDataset {
  const hostMap = new Map<string, NmapHost>();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const line of lines) {
    const statusMatch = /^Host:\s+(\S+)(?:\s+\(([^)]*)\))?\s+Status:\s+(\S+)/i.exec(line);
    if (statusMatch) {
      const ip = statusMatch[1];
      const existing = hostMap.get(ip);
      if (existing) {
        existing.status = statusMatch[3].toLowerCase();
        if (statusMatch[2] && !existing.hostname) existing.hostname = statusMatch[2];
      } else {
        hostMap.set(ip, {
          id: `h-${hostMap.size + 1}`,
          index: hostMap.size,
          ip,
          hostname: statusMatch[2] || '',
          status: statusMatch[3].toLowerCase(),
          os: '',
          ports: [],
          openCount: 0
        });
      }
      continue;
    }
    const portsMatch = /^Host:\s+(\S+)(?:\s+\(([^)]*)\))?\s+Ports:\s+(.+)$/i.exec(line);
    if (!portsMatch) continue;
    const ip = portsMatch[1];
    let host = hostMap.get(ip);
    if (!host) {
      host = {
        id: `h-${hostMap.size + 1}`,
        index: hostMap.size,
        ip,
        hostname: portsMatch[2] || '',
        status: 'up',
        os: '',
        ports: [],
        openCount: 0
      };
      hostMap.set(ip, host);
    } else if (portsMatch[2] && !host.hostname) host.hostname = portsMatch[2];
    const parts = portsMatch[3].split(',').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const bits = part.split('/');
      if (bits.length < 3) continue;
      const port = Number(bits[0]);
      if (!Number.isFinite(port)) continue;
      host.ports.push({
        id: `${host.id}-p-${host.ports.length + 1}`,
        hostId: host.id,
        ip: host.ip,
        hostname: host.hostname,
        protocol: (bits[2] || 'tcp').toLowerCase(),
        port,
        state: normalizeState(bits[1] || ''),
        service: bits[4] || '',
        product: bits[6] || '',
        version: ''
      });
    }
    host.openCount = host.ports.filter((p) => p.state === 'open').length;
  }
  const hosts = [...hostMap.values()];
  if (!hosts.length) throw new Error('No gnmap hosts found');
  return finishDataset('Nmap gnmap', 'gnmap', hosts, '', []);
}

function parseJsonNmap(text: string): NmapDataset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid Nmap JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('Nmap JSON must be an object');
  const rec = data as Record<string, unknown>;
  const raw = Array.isArray(rec.hosts) ? rec.hosts : null;
  if (!raw) throw new Error('Nmap JSON is missing hosts');
  const hosts: NmapHost[] = raw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const hostId = asString(row.id, `h-${i + 1}`);
    const ip = asString(row.ip ?? row.addr, `host-${i + 1}`);
    const hostname = asString(row.hostname ?? row.name);
    const portRows = Array.isArray(row.ports) ? row.ports : [];
    const ports: NmapPort[] = portRows.map((pItem, pi) => {
      const p = (pItem && typeof pItem === 'object' ? pItem : {}) as Record<string, unknown>;
      return {
        id: `${hostId}-p-${pi + 1}`,
        hostId,
        ip,
        hostname,
        protocol: asString(p.protocol, 'tcp').toLowerCase(),
        port: Math.round(asNumber(p.port ?? p.portid)),
        state: normalizeState(asString(p.state, 'open')),
        service: asString(p.service ?? p.name),
        product: asString(p.product),
        version: asString(p.version)
      };
    });
    return {
      id: hostId,
      index: i,
      ip,
      hostname,
      status: asString(row.status, 'up').toLowerCase(),
      os: asString(row.os),
      ports,
      openCount: ports.filter((p) => p.state === 'open').length
    };
  });
  return finishDataset(asString(rec.name ?? rec.args, 'Nmap snapshot'), 'json', hosts, asString(rec.args), []);
}

function parseCsvNmap(text: string): NmapDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('Nmap CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const ipI = idx('ip') >= 0 ? idx('ip') : idx('addr');
  const portI = idx('port');
  if (ipI < 0 || portI < 0) throw new Error('Nmap CSV needs ip and port columns');
  const hostI = idx('hostname') >= 0 ? idx('hostname') : idx('host');
  const protoI = idx('protocol') >= 0 ? idx('protocol') : idx('proto');
  const stateI = idx('state');
  const svcI = idx('service');
  const hostMap = new Map<string, NmapHost>();
  rows.slice(1).forEach((row) => {
    const ip = row[ipI] || '';
    if (!ip) return;
    let host = hostMap.get(ip);
    if (!host) {
      host = {
        id: `h-${hostMap.size + 1}`,
        index: hostMap.size,
        ip,
        hostname: hostI >= 0 ? row[hostI] || '' : '',
        status: 'up',
        os: '',
        ports: [],
        openCount: 0
      };
      hostMap.set(ip, host);
    }
    host.ports.push({
      id: `${host.id}-p-${host.ports.length + 1}`,
      hostId: host.id,
      ip,
      hostname: host.hostname,
      protocol: (protoI >= 0 ? row[protoI] || 'tcp' : 'tcp').toLowerCase(),
      port: Number(row[portI]) || 0,
      state: normalizeState(stateI >= 0 ? row[stateI] || 'open' : 'open'),
      service: svcI >= 0 ? row[svcI] || '' : '',
      product: '',
      version: ''
    });
    host.openCount = host.ports.filter((p) => p.state === 'open').length;
  });
  const hosts = [...hostMap.values()];
  if (!hosts.length) throw new Error('Nmap CSV contains no hosts');
  return finishDataset('Nmap CSV', 'csv', hosts, '', []);
}

export function parseNmapText(text: string, fileName = ''): NmapDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Nmap report is empty');
  if (trimmed.startsWith('{')) return parseJsonNmap(trimmed);
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'gnmap' || /^Host:\s+\S+/m.test(trimmed)) return parseGnmap(trimmed);
  if (ext === 'csv' || (!trimmed.startsWith('<') && trimmed.includes(',') && /ip/i.test(trimmed.split('\n')[0] || '') && /port/i.test(trimmed.split('\n')[0] || ''))) {
    return parseCsvNmap(trimmed);
  }
  if (/<nmaprun/i.test(trimmed) || ext === 'xml' || ext === 'nmap') return parseXmlNmap(trimmed);
  throw new Error('No Nmap hosts found — use Nmap XML, gnmap, CSV, or JSON');
}

export function parseNmapBytes(bytes: Uint8Array, fileName = ''): NmapDataset {
  if (!bytes.length) throw new Error('Nmap report is empty');
  return parseNmapText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterNmapHosts(hosts: NmapHost[], query: string): NmapHost[] {
  const q = query.trim().toLowerCase();
  if (!q) return hosts;
  return hosts.filter((h) => {
    const hay = `${h.ip} ${h.hostname} ${h.status} ${h.os} ${h.ports.map((p) => `${p.port} ${p.state} ${p.service} ${p.protocol}`).join(' ')}`.toLowerCase();
    return filterTokens(q, (token) => matchHostToken(h, token, hay));
  });
}

export function filterNmapPorts(ports: NmapPort[], query: string): NmapPort[] {
  const q = query.trim().toLowerCase();
  if (!q) return ports;
  return ports.filter((p) => filterTokens(q, (token) => matchPortToken(p, token)));
}

function filterTokens(q: string, pred: (token: string) => boolean): boolean {
  return q.split(/\s+/).filter(Boolean).every(pred);
}

function matchPortToken(p: NmapPort, token: string): boolean {
  if (['open', 'closed', 'filtered'].includes(token)) return p.state === token;
  if (['tcp', 'udp'].includes(token)) return p.protocol === token;
  if (token === 'port' || token === 'host' || token === 'service') return true;
  if (token.startsWith('port:')) return p.port === Number(token.slice(5));
  if (token.startsWith('host:')) return p.ip.includes(token.slice(5)) || p.hostname.toLowerCase().includes(token.slice(5));
  if (token.startsWith('service:')) return p.service.toLowerCase() === token.slice(8);
  const hay = `${p.ip} ${p.hostname} ${p.port} ${p.protocol} ${p.state} ${p.service} ${p.product} ${p.version}`.toLowerCase();
  return hay.includes(token);
}

function matchHostToken(h: NmapHost, token: string, hay: string): boolean {
  if (['open', 'closed', 'filtered'].includes(token)) return h.ports.some((p) => p.state === token);
  if (['tcp', 'udp'].includes(token)) return h.ports.some((p) => p.protocol === token);
  if (token === 'up' || token === 'down') return h.status === token;
  if (token === 'port' || token === 'host' || token === 'service') return true;
  if (token.startsWith('port:')) return h.ports.some((p) => p.port === Number(token.slice(5)));
  if (token.startsWith('host:')) return h.ip.includes(token.slice(5)) || h.hostname.toLowerCase().includes(token.slice(5));
  return hay.includes(token);
}
