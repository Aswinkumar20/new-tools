import type {
  ThreatDataset,
  ThreatIndicator,
  ThreatObject,
  ThreatRelationship,
  ThreatSourceKind,
  ThreatStat
} from '../types/threat-intelligence-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

export function normalizeIndicatorType(raw: string): string {
  const v = raw.toLowerCase();
  if (['domain', 'domain-name', 'hostname', 'fqdn'].includes(v)) return 'domain';
  if (['ip', 'ipv4', 'ipv4-addr', 'ipv6', 'ipv6-addr', 'addr'].includes(v)) return 'ip';
  if (['url', 'uri'].includes(v)) return 'url';
  if (['email', 'email-addr', 'mail'].includes(v)) return 'email';
  if (['sha256', 'sha1', 'md5', 'hash', 'file', 'file-hash'].includes(v)) return v === 'file' || v === 'file-hash' || v === 'hash' ? 'hash' : v;
  if (['mutex', 'registry'].includes(v)) return v;
  return v || 'unknown';
}

export function parseStixPattern(pattern: string): { type: string; value: string } {
  const domain = /domain-name:value\s*=\s*'([^']+)'/i.exec(pattern);
  if (domain) return { type: 'domain', value: domain[1] };
  const ipv4 = /ipv4-addr:value\s*=\s*'([^']+)'/i.exec(pattern);
  if (ipv4) return { type: 'ip', value: ipv4[1] };
  const ipv6 = /ipv6-addr:value\s*=\s*'([^']+)'/i.exec(pattern);
  if (ipv6) return { type: 'ip', value: ipv6[1] };
  const url = /url:value\s*=\s*'([^']+)'/i.exec(pattern);
  if (url) return { type: 'url', value: url[1] };
  const email = /email-addr:value\s*=\s*'([^']+)'/i.exec(pattern);
  if (email) return { type: 'email', value: email[1] };
  const hash = /file:hashes\.(?:'SHA-256'|'SHA256'|SHA-256)\s*=\s*'([^']+)'/i.exec(pattern);
  if (hash) return { type: 'sha256', value: hash[1] };
  const md5 = /file:hashes\.(?:'MD5'|MD5)\s*=\s*'([^']+)'/i.exec(pattern);
  if (md5) return { type: 'md5', value: md5[1] };
  const generic = /\[([\w-]+):[^=]+=\s*'([^']+)'/i.exec(pattern);
  if (generic) return { type: normalizeIndicatorType(generic[1]), value: generic[2] };
  return { type: 'unknown', value: pattern.trim() };
}

function finishDataset(
  name: string,
  sourceKind: ThreatSourceKind,
  version: string,
  indicators: ThreatIndicator[],
  relationships: ThreatRelationship[],
  objects: ThreatObject[],
  warnings: string[]
): ThreatDataset {
  const typeMap = new Map<string, ThreatStat>();
  for (const ioc of indicators) {
    const rec = typeMap.get(ioc.type) ?? { name: ioc.type, count: 0 };
    rec.count += 1;
    typeMap.set(ioc.type, rec);
  }
  const relMap = new Map<string, ThreatStat>();
  for (const rel of relationships) {
    const rec = relMap.get(rel.type) ?? { name: rel.type, count: 0 };
    rec.count += 1;
    relMap.set(rel.type, rec);
  }
  const kindMap = new Map<string, ThreatStat>();
  for (const obj of objects) {
    const rec = kindMap.get(obj.kind) ?? { name: obj.kind, count: 0 };
    rec.count += 1;
    kindMap.set(obj.kind, rec);
  }
  if (!indicators.length && !relationships.length && !objects.length) {
    warnings.push('Threat intel feed contains no indicators, relationships, or objects.');
  }
  return {
    name,
    sourceKind,
    version,
    indicators,
    relationships,
    objects,
    indicatorTypes: [...typeMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    relationshipTypes: [...relMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    objectKinds: [...kindMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    warnings
  };
}

function objectKindFromStix(type: string): string | null {
  if (['threat-actor', 'intrusion-set', 'malware', 'campaign', 'identity', 'attack-pattern', 'tool', 'vulnerability'].includes(type)) {
    return type;
  }
  return null;
}

function parseStixBundle(data: Record<string, unknown>): ThreatDataset {
  const objectsRaw = Array.isArray(data.objects) ? data.objects : [];
  if (!objectsRaw.length) throw new Error('STIX bundle is missing objects');
  const nameById = new Map<string, string>();
  objectsRaw.forEach((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const id = asString(row.id);
    if (id) nameById.set(id, asString(row.name, id));
  });
  const indicators: ThreatIndicator[] = [];
  const relationships: ThreatRelationship[] = [];
  const objects: ThreatObject[] = [];
  objectsRaw.forEach((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const type = asString(row.type).toLowerCase();
    if (type === 'indicator') {
      const pattern = asString(row.pattern);
      const parsed = parseStixPattern(pattern);
      const labels = Array.isArray(row.indicator_types)
        ? row.indicator_types.map((v) => String(v)).join(', ')
        : Array.isArray(row.labels)
          ? row.labels.map((v) => String(v)).join(', ')
          : asString(row.labels);
      indicators.push({
        id: asString(row.id, `i-${indicators.length + 1}`),
        index: indicators.length,
        type: parsed.type === 'unknown' ? normalizeIndicatorType(asString(row.name)) || 'unknown' : parsed.type,
        value: parsed.value || asString(row.name),
        name: asString(row.name, parsed.value || 'Unnamed indicator'),
        labels,
        pattern,
        confidence: asNumber(row.confidence),
        validFrom: asString(row.valid_from ?? row.validFrom)
      });
      return;
    }
    if (type === 'relationship') {
      const sourceId = asString(row.source_ref ?? row.source);
      const targetId = asString(row.target_ref ?? row.target);
      relationships.push({
        id: asString(row.id, `r-${relationships.length + 1}`),
        index: relationships.length,
        type: asString(row.relationship_type ?? row.type, 'related-to'),
        sourceId,
        targetId,
        sourceName: nameById.get(sourceId) || sourceId,
        targetName: nameById.get(targetId) || targetId
      });
      return;
    }
    const kind = objectKindFromStix(type);
    if (kind) {
      const aliases = Array.isArray(row.aliases) ? row.aliases.map((v) => String(v)).join(', ') : asString(row.aliases);
      const mitre = Array.isArray(row.external_references)
        ? row.external_references
            .map((ref) => {
              const rec = (ref && typeof ref === 'object' ? ref : {}) as Record<string, unknown>;
              return asString(rec.external_id);
            })
            .filter(Boolean)
            .join(', ')
        : '';
      objects.push({
        id: asString(row.id, `o-${objects.length + 1}`),
        index: objects.length,
        kind,
        name: asString(row.name, type),
        aliases: aliases || mitre,
        description: asString(row.description)
      });
    }
  });
  if (!indicators.length && !relationships.length && !objects.length) throw new Error('STIX bundle has no usable threat objects');
  return finishDataset(
    asString(data.name, 'STIX bundle'),
    'stix',
    asString(data.spec_version ?? data.version, '2.1'),
    indicators,
    relationships,
    objects,
    []
  );
}

function parseSimpleJson(data: Record<string, unknown>): ThreatDataset {
  const iocsRaw = Array.isArray(data.indicators) ? data.indicators : Array.isArray(data.iocs) ? data.iocs : [];
  const relRaw = Array.isArray(data.relationships) ? data.relationships : [];
  const objRaw = Array.isArray(data.objects)
    ? data.objects
    : Array.isArray(data.actors)
      ? data.actors
      : [];
  const indicators: ThreatIndicator[] = iocsRaw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const pattern = asString(row.pattern);
    const parsed = pattern ? parseStixPattern(pattern) : { type: '', value: '' };
    return {
      id: asString(row.id, `i-${i + 1}`),
      index: i,
      type: normalizeIndicatorType(asString(row.type, parsed.type || 'unknown')),
      value: asString(row.value ?? row.indicator, parsed.value),
      name: asString(row.name, asString(row.value, `Indicator ${i + 1}`)),
      labels: Array.isArray(row.labels) ? row.labels.map((v) => String(v)).join(', ') : asString(row.labels),
      pattern,
      confidence: asNumber(row.confidence),
      validFrom: asString(row.validFrom ?? row.valid_from)
    };
  });
  const objects: ThreatObject[] = objRaw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(row.id, `o-${i + 1}`),
      index: i,
      kind: asString(row.kind ?? row.type, 'threat-actor'),
      name: asString(row.name, `Object ${i + 1}`),
      aliases: Array.isArray(row.aliases) ? row.aliases.map((v) => String(v)).join(', ') : asString(row.aliases),
      description: asString(row.description)
    };
  });
  const nameById = new Map<string, string>();
  indicators.forEach((i) => nameById.set(i.id, i.name || i.value));
  objects.forEach((o) => nameById.set(o.id, o.name));
  const relationships: ThreatRelationship[] = relRaw.map((item, i) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const sourceId = asString(row.sourceId ?? row.source_ref ?? row.source);
    const targetId = asString(row.targetId ?? row.target_ref ?? row.target);
    return {
      id: asString(row.id, `r-${i + 1}`),
      index: i,
      type: asString(row.type ?? row.relationship_type, 'related-to'),
      sourceId,
      targetId,
      sourceName: asString(row.sourceName, nameById.get(sourceId) || sourceId),
      targetName: asString(row.targetName, nameById.get(targetId) || targetId)
    };
  });
  if (!indicators.length && !relationships.length && !objects.length) {
    throw new Error('Threat intel JSON is missing indicators, relationships, or objects');
  }
  return finishDataset(asString(data.name ?? data.title, 'Threat intel snapshot'), 'json', asString(data.version, ''), indicators, relationships, objects, []);
}

function parseXmlThreat(text: string): ThreatDataset {
  if (!/<ThreatIntel\b/i.test(text) && !/<Indicator\b/i.test(text)) throw new Error('Not a threat intel XML feed');
  const root = attrs(/<ThreatIntel\b([^>]*)>/i.exec(text)?.[1] ?? '');
  const indicators: ThreatIndicator[] = [];
  const iocRe = /<Indicator\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = iocRe.exec(text))) {
    const a = attrs(match[1]);
    indicators.push({
      id: `i-${indicators.length + 1}`,
      index: indicators.length,
      type: normalizeIndicatorType(a.type || 'unknown'),
      value: a.value || '',
      name: a.name || a.value || `Indicator ${indicators.length + 1}`,
      labels: a.labels || '',
      pattern: a.pattern || '',
      confidence: a.confidence ? Number(a.confidence) : null,
      validFrom: a.validFrom || a.valid_from || ''
    });
  }
  const objects: ThreatObject[] = [];
  const objRe = /<Object\b([^>]*)\/?>/gi;
  while ((match = objRe.exec(text))) {
    const a = attrs(match[1]);
    objects.push({
      id: `o-${objects.length + 1}`,
      index: objects.length,
      kind: a.kind || a.type || 'threat-actor',
      name: a.name || `Object ${objects.length + 1}`,
      aliases: a.aliases || '',
      description: a.description || ''
    });
  }
  const nameByLabel = new Map<string, string>();
  indicators.forEach((i) => {
    nameByLabel.set(i.name.toLowerCase(), i.name);
    nameByLabel.set(i.value.toLowerCase(), i.name);
  });
  objects.forEach((o) => nameByLabel.set(o.name.toLowerCase(), o.name));
  const relationships: ThreatRelationship[] = [];
  const relRe = /<Relationship\b([^>]*)\/?>/gi;
  while ((match = relRe.exec(text))) {
    const a = attrs(match[1]);
    relationships.push({
      id: `r-${relationships.length + 1}`,
      index: relationships.length,
      type: a.type || 'related-to',
      sourceId: a.source || '',
      targetId: a.target || '',
      sourceName: nameByLabel.get((a.source || '').toLowerCase()) || a.source || '',
      targetName: nameByLabel.get((a.target || '').toLowerCase()) || a.target || ''
    });
  }
  if (!indicators.length && !relationships.length && !objects.length) throw new Error('Threat intel XML contains no usable objects');
  return finishDataset(root.name || 'Threat intel XML', 'xml', root.version || '', indicators, relationships, objects, []);
}

function parseCsvThreat(text: string): ThreatDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('Threat intel CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const typeI = idx('type');
  const valueI = idx('value') >= 0 ? idx('value') : idx('indicator') >= 0 ? idx('indicator') : idx('ioc');
  if (typeI < 0 || valueI < 0) throw new Error('Threat intel CSV needs type and value columns');
  const labelI = idx('labels') >= 0 ? idx('labels') : idx('label');
  const nameI = idx('name');
  const indicators: ThreatIndicator[] = rows.slice(1).map((row, i) => ({
    id: `i-${i + 1}`,
    index: i,
    type: normalizeIndicatorType(row[typeI] || 'unknown'),
    value: row[valueI] || '',
    name: nameI >= 0 ? row[nameI] || row[valueI] || `Indicator ${i + 1}` : row[valueI] || `Indicator ${i + 1}`,
    labels: labelI >= 0 ? row[labelI] || '' : '',
    pattern: '',
    confidence: null,
    validFrom: ''
  }));
  return finishDataset('Threat intel CSV', 'csv', '', indicators, [], [], []);
}

function parseTextThreat(text: string): ThreatDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const indicators: ThreatIndicator[] = [];
  for (const line of lines) {
    const typed = /^([a-z0-9_-]+)\s*[:=]\s*(.+)$/i.exec(line);
    if (typed) {
      indicators.push({
        id: `i-${indicators.length + 1}`,
        index: indicators.length,
        type: normalizeIndicatorType(typed[1]),
        value: typed[2].trim(),
        name: typed[2].trim(),
        labels: '',
        pattern: '',
        confidence: null,
        validFrom: ''
      });
      continue;
    }
    if (/^[a-f0-9]{64}$/i.test(line)) {
      indicators.push({ id: `i-${indicators.length + 1}`, index: indicators.length, type: 'sha256', value: line, name: line, labels: '', pattern: '', confidence: null, validFrom: '' });
    } else if (/^[a-f0-9]{32}$/i.test(line)) {
      indicators.push({ id: `i-${indicators.length + 1}`, index: indicators.length, type: 'md5', value: line, name: line, labels: '', pattern: '', confidence: null, validFrom: '' });
    } else if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(line)) {
      indicators.push({ id: `i-${indicators.length + 1}`, index: indicators.length, type: 'ip', value: line, name: line, labels: '', pattern: '', confidence: null, validFrom: '' });
    } else if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(line)) {
      indicators.push({ id: `i-${indicators.length + 1}`, index: indicators.length, type: 'domain', value: line, name: line, labels: '', pattern: '', confidence: null, validFrom: '' });
    }
  }
  if (!indicators.length) throw new Error('No threat indicators found — use STIX JSON/XML, CSV, or typed text');
  return finishDataset('Threat intel list', 'txt', '', indicators, [], [], ['Plain-text indicator lists are parsed with limited structure.']);
}

export function parseThreatText(text: string, fileName = ''): ThreatDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Threat intel feed is empty');
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid threat intel JSON');
    }
    if (Array.isArray(data)) {
      return parseSimpleJson({ indicators: data });
    }
    if (!data || typeof data !== 'object') throw new Error('Threat intel JSON must be an object');
    const rec = data as Record<string, unknown>;
    if (asString(rec.type).toLowerCase() === 'bundle' || Array.isArray(rec.objects)) return parseStixBundle(rec);
    return parseSimpleJson(rec);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'xml' || /^</.test(trimmed)) return parseXmlThreat(trimmed);
  if (ext === 'csv' || (trimmed.includes(',') && /type/i.test(trimmed.split('\n')[0] || '') && /value|indicator|ioc/i.test(trimmed.split('\n')[0] || ''))) {
    return parseCsvThreat(trimmed);
  }
  return parseTextThreat(trimmed);
}

export function parseThreatBytes(bytes: Uint8Array, fileName = ''): ThreatDataset {
  if (!bytes.length) throw new Error('Threat intel feed is empty');
  return parseThreatText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterThreatIndicators(indicators: ThreatIndicator[], query: string): ThreatIndicator[] {
  const q = query.trim().toLowerCase();
  if (!q) return indicators;
  const tokens = q.split(/\s+/).filter(Boolean);
  return indicators.filter((ioc) =>
    tokens.every((token) => {
      if (['domain', 'ip', 'url', 'email', 'sha256', 'md5', 'hash', 'mutex', 'registry'].includes(token)) {
        return token === 'hash' ? ['sha256', 'md5', 'sha1', 'hash'].includes(ioc.type) : ioc.type === token;
      }
      if (token.startsWith('type:')) return ioc.type === token.slice(5);
      if (token.startsWith('label:')) return ioc.labels.toLowerCase().includes(token.slice(6));
      const hay = `${ioc.type} ${ioc.value} ${ioc.name} ${ioc.labels} ${ioc.pattern} ${ioc.confidence ?? ''}`.toLowerCase();
      return hay.includes(token);
    })
  );
}

export function filterThreatRelationships(relationships: ThreatRelationship[], query: string): ThreatRelationship[] {
  const q = query.trim().toLowerCase();
  if (!q) return relationships;
  const tokens = q.split(/\s+/).filter(Boolean);
  return relationships.filter((rel) =>
    tokens.every((token) => {
      if (token.startsWith('rel:') || token.startsWith('type:')) {
        const t = token.includes(':') ? token.slice(token.indexOf(':') + 1) : token;
        return rel.type.toLowerCase().includes(t);
      }
      const hay = `${rel.type} ${rel.sourceName} ${rel.targetName} ${rel.sourceId} ${rel.targetId}`.toLowerCase();
      return hay.includes(token);
    })
  );
}

export function filterThreatObjects(objects: ThreatObject[], query: string): ThreatObject[] {
  const q = query.trim().toLowerCase();
  if (!q) return objects;
  const tokens = q.split(/\s+/).filter(Boolean);
  return objects.filter((obj) =>
    tokens.every((token) => {
      if (['threat-actor', 'malware', 'identity', 'attack-pattern', 'campaign', 'intrusion-set', 'tool', 'vulnerability'].includes(token)) {
        return obj.kind === token;
      }
      if (token.startsWith('kind:')) return obj.kind === token.slice(5);
      const hay = `${obj.kind} ${obj.name} ${obj.aliases} ${obj.description}`.toLowerCase();
      return hay.includes(token);
    })
  );
}
