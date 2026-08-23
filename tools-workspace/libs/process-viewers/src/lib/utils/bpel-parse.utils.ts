import type {
  BpelActivity,
  BpelDataset,
  BpelPartner,
  BpelSourceKind,
  BpelStat,
  BpelVariable
} from '../types/bpel-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

export function normalizeBpelKind(raw: string): string {
  const v = raw.trim().toLowerCase().replace(/[\s_]+/g, '');
  if (['elseif', 'else-if'].includes(v)) return 'elseif';
  if (['repeatuntil', 'repeat-until'].includes(v)) return 'repeatUntil';
  if (['foreach', 'for-each'].includes(v)) return 'forEach';
  if (['onmessage', 'on-message'].includes(v)) return 'onMessage';
  if (['createinstance', 'receive'].includes(v) && v === 'createinstance') return 'receive';
  return v || 'invoke';
}

function finishDataset(
  name: string,
  sourceKind: BpelSourceKind,
  namespace: string,
  partners: BpelPartner[],
  variables: BpelVariable[],
  activities: BpelActivity[],
  warnings: string[]
): BpelDataset {
  const counts = new Map<string, number>();
  for (const a of activities) {
    if (!a.partner) continue;
    counts.set(a.partner, (counts.get(a.partner) ?? 0) + 1);
  }
  partners.forEach((p) => {
    p.activityCount = counts.get(p.name) ?? counts.get(p.id) ?? 0;
  });
  const kindMap = new Map<string, BpelStat>();
  for (const a of activities) {
    const rec = kindMap.get(a.kind) ?? { name: a.kind, count: 0 };
    rec.count += 1;
    kindMap.set(a.kind, rec);
  }
  if (!activities.length) warnings.push('BPEL process contains no activities.');
  if (!partners.length && activities.some((a) => a.partner)) warnings.push('Activities reference partners, but no partnerLinks were found.');
  return {
    name,
    sourceKind,
    namespace,
    partners,
    variables,
    activities,
    kinds: [...kindMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    warnings
  };
}

function parseBpelActivities(xml: string): BpelActivity[] {
  const tags =
    'receive|reply|invoke|assign|if|elseif|else|while|repeatUntil|forEach|sequence|flow|pick|onMessage|wait|throw|rethrow|compensate|empty|exit|scope';
  const re = new RegExp(`<(\\/?)(?:[\\w.-]+:)?(${tags})\\b([^>]*)(\\/?)>`, 'gi');
  const containers = new Set(['sequence', 'flow', 'if', 'elseif', 'else', 'while', 'repeatuntil', 'foreach', 'pick', 'onmessage', 'scope']);
  const activities: BpelActivity[] = [];
  const stack: Array<{ id: string; kind: string; name: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const closing = !!match[1];
    const kind = normalizeBpelKind(match[2] || 'invoke');
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].kind === kind) {
          stack.splice(i);
          break;
        }
      }
      continue;
    }
    const a = attrs(match[3] || '');
    const id = a.name || a.id || `${kind}-${activities.length + 1}`;
    const parent = stack[stack.length - 1];
    activities.push({
      id,
      index: activities.length,
      name: a.name || id,
      kind,
      partner: a.partnerLink || a.partner || '',
      operation: a.operation || '',
      variable: a.variable || a.inputVariable || a.outputVariable || '',
      createInstance: /^(yes|true)$/i.test(a.createInstance || ''),
      parentId: parent?.id || '',
      parentName: parent?.name || '',
      depth: stack.length
    });
    const selfClosing = match[4] === '/';
    if (!selfClosing && containers.has(kind)) stack.push({ id, kind, name: a.name || id });
  }
  return activities;
}

function parseBpelXml(xml: string): BpelDataset {
  if (!/<(?:[\w.-]+:)?process\b/i.test(xml) && !/<(?:[\w.-]+:)?partnerLink\b/i.test(xml) && !/wsbpel|bpel/i.test(xml)) {
    throw new Error('Not a BPEL document');
  }
  const proc = /<(?:[\w.-]+:)?process\b([^>]*)>/i.exec(xml)?.[1] ?? '';
  const pa = attrs(proc);
  const name = pa.name || 'BPEL process';
  const namespace = pa.targetNamespace || pa.xmlns || '';
  const partners: BpelPartner[] = [];
  const partnerRe =
    /<(?:[\w.-]+:)?partnerLink\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = partnerRe.exec(xml))) {
    const a = attrs(match[1]);
    const n = a.name || `partner-${partners.length + 1}`;
    partners.push({
      id: n,
      index: partners.length,
      name: n,
      type: a.partnerLinkType || a.type || '',
      myRole: a.myRole || '',
      partnerRole: a.partnerRole || '',
      activityCount: 0
    });
  }
  const variables: BpelVariable[] = [];
  const varRe = /<(?:[\w.-]+:)?variable\b([^>]*)\/?>/gi;
  while ((match = varRe.exec(xml))) {
    const a = attrs(match[1]);
    const n = a.name || `var-${variables.length + 1}`;
    variables.push({
      id: n,
      name: n,
      type: a.messageType || a.type || a.element || ''
    });
  }
  const activities = parseBpelActivities(xml);
  if (!activities.length && !partners.length) throw new Error('BPEL document contains no process activities or partners');
  const warnings: string[] = [];
  if (!partners.length) warnings.push('BPEL has no partnerLinks.');
  return finishDataset(name, 'bpel', namespace, partners, variables, activities, warnings);
}

function parseBpelJson(data: Record<string, unknown>): BpelDataset {
  const partnersRaw = Array.isArray(data.partners) ? data.partners : Array.isArray(data.partnerLinks) ? data.partnerLinks : [];
  const activitiesRaw = Array.isArray(data.activities) ? data.activities : null;
  if (!activitiesRaw && !partnersRaw.length) throw new Error('BPEL JSON is missing activities or partners');
  const partners: BpelPartner[] = partnersRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const n = asString(rec.name, `partner-${i + 1}`);
    return {
      id: asString(rec.id, n),
      index: i,
      name: n,
      type: asString(rec.type ?? rec.partnerLinkType),
      myRole: asString(rec.myRole),
      partnerRole: asString(rec.partnerRole),
      activityCount: 0
    };
  });
  const variablesRaw = Array.isArray(data.variables) ? data.variables : [];
  const variables: BpelVariable[] = variablesRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const n = asString(rec.name, `var-${i + 1}`);
    return { id: n, name: n, type: asString(rec.type ?? rec.messageType) };
  });
  const activities: BpelActivity[] = (activitiesRaw || []).map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const kind = normalizeBpelKind(asString(rec.kind ?? rec.type, 'invoke'));
    const n = asString(rec.name, `${kind}-${i + 1}`);
    return {
      id: asString(rec.id, n),
      index: i,
      name: n,
      kind,
      partner: asString(rec.partner ?? rec.partnerLink),
      operation: asString(rec.operation),
      variable: asString(rec.variable ?? rec.inputVariable ?? rec.outputVariable),
      createInstance: rec.createInstance === true || rec.createInstance === 'yes',
      parentId: asString(rec.parentId ?? rec.parent),
      parentName: asString(rec.parentName ?? rec.parent),
      depth: Number(rec.depth) || 0
    };
  });
  return finishDataset(asString(data.name, 'BPEL snapshot'), 'json', asString(data.namespace), partners, variables, activities, []);
}

function parseBpelCsv(text: string): BpelDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('BPEL CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const kindI = idx('kind') >= 0 ? idx('kind') : idx('type');
  const nameI = idx('name');
  if (kindI < 0 || nameI < 0) throw new Error('BPEL CSV needs kind and name columns');
  const partnerI = idx('partner') >= 0 ? idx('partner') : idx('partnerlink');
  const opI = idx('operation');
  const parentI = idx('parent');
  const activities: BpelActivity[] = [];
  const partnerNames = new Set<string>();
  rows.slice(1).forEach((row) => {
    const kind = normalizeBpelKind(row[kindI] || 'invoke');
    const name = row[nameI] || `${kind}-${activities.length + 1}`;
    const partner = partnerI >= 0 ? row[partnerI] || '' : '';
    if (partner) partnerNames.add(partner);
    activities.push({
      id: name,
      index: activities.length,
      name,
      kind,
      partner,
      operation: opI >= 0 ? row[opI] || '' : '',
      variable: '',
      createInstance: kind === 'receive' && activities.length === 0,
      parentId: parentI >= 0 ? row[parentI] || '' : '',
      parentName: parentI >= 0 ? row[parentI] || '' : '',
      depth: 0
    });
  });
  const partners: BpelPartner[] = [...partnerNames].map((n, i) => ({
    id: n,
    index: i,
    name: n,
    type: '',
    myRole: '',
    partnerRole: '',
    activityCount: 0
  }));
  return finishDataset('BPEL CSV', 'csv', '', partners, [], activities, []);
}

export function parseBpelText(text: string, fileName = ''): BpelDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('BPEL file is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid BPEL JSON');
    }
    if (!data || typeof data !== 'object') throw new Error('BPEL JSON must be an object');
    return parseBpelJson(data as Record<string, unknown>);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (trimmed.includes(',') && /kind|type/i.test(trimmed.split('\n')[0] || '') && /name/i.test(trimmed.split('\n')[0] || ''))) {
    return parseBpelCsv(trimmed);
  }
  if (ext === 'bpel' || ext === 'xml' || /^</.test(trimmed)) return parseBpelXml(trimmed);
  throw new Error('No BPEL process found — use .bpel, XML, JSON, or CSV');
}

export function parseBpelBytes(bytes: Uint8Array, fileName = ''): BpelDataset {
  if (!bytes.length) throw new Error('BPEL file is empty');
  return parseBpelText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterBpelActivities(activities: BpelActivity[], query: string): BpelActivity[] {
  const q = query.trim().toLowerCase();
  if (!q) return activities;
  const tokens = q.split(/\s+/).filter(Boolean);
  return activities.filter((a) =>
    tokens.every((token) => {
      if (['receive', 'reply', 'invoke', 'assign', 'if', 'while', 'sequence', 'flow', 'throw', 'wait'].includes(token)) {
        return a.kind === token;
      }
      if (token.startsWith('kind:')) return a.kind === token.slice(5);
      if (token.startsWith('partner:')) return a.partner.toLowerCase().includes(token.slice(8));
      if (token === 'start' || token === 'createinstance') return a.createInstance;
      return `${a.id} ${a.name} ${a.kind} ${a.partner} ${a.operation} ${a.parentName}`.toLowerCase().includes(token);
    })
  );
}

export function filterBpelPartners(partners: BpelPartner[], query: string): BpelPartner[] {
  const q = query.trim().toLowerCase();
  if (!q) return partners;
  const tokens = q.split(/\s+/).filter(Boolean);
  return partners.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('partner:')) return p.name.toLowerCase().includes(token.slice(8));
      return `${p.name} ${p.type} ${p.myRole} ${p.partnerRole}`.toLowerCase().includes(token);
    })
  );
}
