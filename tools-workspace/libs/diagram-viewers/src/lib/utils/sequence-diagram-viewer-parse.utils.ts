import type {
  SeqDataset,
  SeqLifeline,
  SeqLifelineKind,
  SeqMessage,
  SeqMessageStyle,
  SeqSourceKind
} from '../types/sequence-diagram-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:sequence|interaction|lifeline|message)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:uml|plantuml|puml|mermaid|sequence)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) return { source: fence[1].trim(), fenced: true };
  return { source: text.trim(), fenced: false };
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

function kindFrom(raw: string): SeqLifelineKind {
  const v = raw.trim().toLowerCase();
  if (v === 'actor' || v === 'boundary' || v === 'control' || v === 'entity') return v;
  return 'participant';
}

function styleFromArrow(arrow: string): SeqMessageStyle {
  if (arrow === '->>') return 'async';
  if (arrow === '-->' || arrow === '-->>') return 'return';
  return 'sync';
}

function styleFromName(raw: string): SeqMessageStyle {
  const v = raw.trim().toLowerCase();
  if (v === 'async' || v === 'return' || v === 'create') return v;
  return 'sync';
}

function upsertLifeline(
  lifelines: SeqLifeline[],
  next: { id: string; name: string; kind: SeqLifelineKind; alias?: string }
): SeqLifeline {
  const existing = lifelines.find((l) => l.id === next.id || l.alias === next.id || l.name === next.name);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind !== 'participant') existing.kind = next.kind;
    if (next.alias) existing.alias = next.alias;
    return existing;
  }
  const created: SeqLifeline = {
    id: next.id,
    index: lifelines.length,
    name: next.name,
    kind: next.kind,
    alias: next.alias || next.id,
    x: 70 + lifelines.length * 150,
    y: 36
  };
  lifelines.push(created);
  return created;
}

function resolveId(token: string, lifelines: SeqLifeline[]): string {
  const id = unquote(token);
  const found = lifelines.find((l) => l.id === id || l.alias === id || l.name === id);
  return found?.id || id;
}

function finishDataset(
  name: string,
  sourceKind: SeqSourceKind,
  title: string,
  lifelines: SeqLifeline[],
  messages: SeqMessage[],
  warnings: string[]
): SeqDataset {
  const nameById = new Map(lifelines.map((l) => [l.id, l.name] as const));
  messages.forEach((m, i) => {
    m.index = i;
    m.sourceName = nameById.get(m.source) || m.source;
    m.targetName = nameById.get(m.target) || m.target;
  });
  lifelines.forEach((l, i) => {
    l.index = i;
    l.x = 70 + i * 150;
    l.y = 36;
  });
  if (!lifelines.length) warnings.push('Sequence diagram contains no lifelines.');
  if (!messages.length && lifelines.length) warnings.push('Sequence diagram has lifelines but no messages.');
  return { name, sourceKind, title: title || name, lifelines, messages, warnings };
}

function parseXml(xml: string, fileName: string): SeqDataset {
  const root = /<(?:sequence|interaction)\b([^>]*)>/i.exec(xml);
  const name = attrs(root?.[1] || '').name || fileName.replace(/\.[^.]+$/, '') || 'Sequence';
  const lifelines: SeqLifeline[] = [];
  const messages: SeqMessage[] = [];
  for (const m of xml.matchAll(/<(lifeline|participant|actor)\b([^>]*)\/?>/gi)) {
    const a = attrs(m[2] || '');
    const id = a.id || a.name || `l-${lifelines.length + 1}`;
    upsertLifeline(lifelines, { id, name: a.name || id, kind: kindFrom(a.kind || m[1]) });
  }
  for (const m of xml.matchAll(/<message\b([^>]*)\/?>/gi)) {
    const a = attrs(m[1] || '');
    const source = resolveId(a.source || a.from || '', lifelines);
    const target = resolveId(a.target || a.to || '', lifelines);
    if (!source || !target) continue;
    upsertLifeline(lifelines, { id: source, name: source, kind: 'participant' });
    upsertLifeline(lifelines, { id: target, name: target, kind: 'participant' });
    messages.push({
      id: `m-${messages.length + 1}`,
      index: messages.length,
      source,
      target,
      sourceName: '',
      targetName: '',
      label: a.label || a.name || '',
      style: styleFromName(a.style || '')
    });
  }
  if (!lifelines.length) throw new Error('Sequence XML contains no lifelines');
  return finishDataset(name, 'xml', name, lifelines, messages, []);
}

function parseJson(text: string, fileName: string): SeqDataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Invalid sequence JSON');
  }
  const obj = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!obj || typeof obj !== 'object') throw new Error('Sequence JSON must be an object');
  const lineRaw = (Array.isArray(obj.lifelines) ? obj.lifelines : Array.isArray(obj.participants) ? obj.participants : []) as unknown[];
  if (!lineRaw.length) throw new Error('Sequence JSON is missing lifelines');
  const lifelines: SeqLifeline[] = lineRaw.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `l-${i + 1}`),
      index: i,
      name: asString(rec.name || rec.label, asString(rec.id, `l-${i + 1}`)),
      kind: kindFrom(asString(rec.kind)),
      alias: asString(rec.alias, asString(rec.id, `l-${i + 1}`)),
      x: Number(rec.x) || 0,
      y: Number(rec.y) || 0
    };
  });
  const msgRaw = (Array.isArray(obj.messages) ? obj.messages : Array.isArray(obj.links) ? obj.links : []) as unknown[];
  const messages: SeqMessage[] = msgRaw
    .map((item, i) => {
      const rec = (item ?? {}) as Record<string, unknown>;
      return {
        id: asString(rec.id, `m-${i + 1}`),
        index: i,
        source: asString(rec.source || rec.from),
        target: asString(rec.target || rec.to),
        sourceName: '',
        targetName: '',
        label: asString(rec.label),
        style: styleFromName(asString(rec.style))
      };
    })
    .filter((m) => m.source && m.target);
  return finishDataset(
    asString(obj.name || obj.title, fileName.replace(/\.[^.]+$/, '') || 'Sequence JSON'),
    'json',
    asString(obj.title),
    lifelines,
    messages,
    []
  );
}

function parseMermaid(source: string, fileName: string, sourceKind: SeqSourceKind): SeqDataset {
  const warnings: string[] = [];
  const lines = source.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
  const lifelines: SeqLifeline[] = [];
  const messages: SeqMessage[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const participant = /^(?:participant|actor)\s+([A-Za-z][A-Za-z0-9_]*)(?:\s+as\s+(.+))?$/i.exec(line);
    if (participant) {
      upsertLifeline(lifelines, {
        id: participant[1],
        name: (participant[2] || participant[1]).trim(),
        kind: /^actor\b/i.test(line) ? 'actor' : 'participant',
        alias: participant[1]
      });
      continue;
    }
    const msg = /^([A-Za-z][A-Za-z0-9_]*)\s*(-->>|->>|-->|->)\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (msg) {
      upsertLifeline(lifelines, { id: msg[1], name: msg[1], kind: 'participant' });
      upsertLifeline(lifelines, { id: msg[3], name: msg[3], kind: 'participant' });
      messages.push({
        id: `m-${messages.length + 1}`,
        index: messages.length,
        source: msg[1],
        target: msg[3],
        sourceName: '',
        targetName: '',
        label: msg[4].trim(),
        style: styleFromArrow(msg[2])
      });
      continue;
    }
    if (/^(loop|alt|opt|else|end|Note)\b/i.test(line)) {
      warnings.push(`Fragment keyword "${line.split(/\s+/)[0]}" is preview-only.`);
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
  }
  const name = fileName.replace(/\.[^.]+$/, '') || 'Sequence';
  return finishDataset(name, sourceKind, name, lifelines, messages, warnings);
}

function parsePlantLike(source: string, fileName: string, sourceKind: SeqSourceKind): SeqDataset {
  const warnings: string[] = [];
  let title = '';
  const lines = source
    .replace(/\/'[\s\S]*?'\//g, '\n')
    .split(/\r?\n/)
    .map((l) => l.replace(/'.*$/, '').trim())
    .filter((l) => l && !/^@(start|end)uml\b/i.test(l) && !/^skinparam\b|^hide\b|^show\b|^autonumber\b|^!include\b/i.test(l));
  const lifelines: SeqLifeline[] = [];
  const messages: SeqMessage[] = [];
  for (const line of lines) {
    const titleMatch = /^title\s+(.+)$/i.exec(line);
    if (titleMatch) {
      title = unquote(titleMatch[1]);
      continue;
    }
    const decl = /^(actor|participant|boundary|control|entity)\s+(?:"([^"]+)"|([A-Za-z][\w.-]*))(?:\s+as\s+(\S+))?$/i.exec(line);
    if (decl) {
      const kind = kindFrom(decl[1]);
      const name = decl[2] || decl[3];
      const id = decl[4] ? unquote(decl[4]) : name;
      upsertLifeline(lifelines, { id, name, kind, alias: decl[4] ? unquote(decl[4]) : id });
      continue;
    }
    const msg = /^([A-Za-z][A-Za-z0-9_]*)\s*(-->>|->>|-->|->)\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (msg) {
      const sourceId = resolveId(msg[1], lifelines);
      const targetId = resolveId(msg[3], lifelines);
      upsertLifeline(lifelines, { id: sourceId, name: sourceId, kind: lifelines.find((l) => l.id === sourceId)?.kind || 'participant' });
      upsertLifeline(lifelines, { id: targetId, name: targetId, kind: lifelines.find((l) => l.id === targetId)?.kind || 'participant' });
      messages.push({
        id: `m-${messages.length + 1}`,
        index: messages.length,
        source: sourceId,
        target: targetId,
        sourceName: '',
        targetName: '',
        label: msg[4].trim(),
        style: styleFromArrow(msg[2])
      });
      continue;
    }
    if (/^(activate|deactivate|destroy|create|loop|alt|opt|else|end|note)\b/i.test(line)) {
      warnings.push(`Sequence keyword "${line.split(/\s+/)[0]}" is preview-only.`);
      continue;
    }
    warnings.push(`Skipped line: ${line}`);
  }
  const fallback = title || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'Sequence diagram';
  return finishDataset(fallback, sourceKind, title, lifelines, messages, warnings);
}

export function parseSequenceText(text: string, fileName = ''): SeqDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('Sequence file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') return parseJson(raw, fileName);
  if (looksLikeXml(raw) || ext === 'xml') return parseXml(raw, fileName);
  const extracted = extractFence(raw);
  const sourceKind: SeqSourceKind =
    extracted.fenced || ext === 'md' ? 'markdown' : ext === 'mmd' || /^sequenceDiagram\b/i.test(extracted.source) ? 'mermaid' : ext === 'txt' ? 'txt' : 'puml';
  if (/^sequenceDiagram\b/i.test(extracted.source)) {
    const parsed = parseMermaid(extracted.source, fileName, sourceKind);
    if (!parsed.lifelines.length) throw new Error('Sequence diagram contains no lifelines');
    return parsed;
  }
  if (
    /@startuml\b/i.test(extracted.source) ||
    /\b(actor|participant|boundary|control|entity)\b/i.test(extracted.source) ||
    /->/.test(extracted.source)
  ) {
    if (/\b(class|interface|enum|abstract)\b/i.test(extracted.source) && !/\b(actor|participant)\b/i.test(extracted.source)) {
      throw new Error('Not a sequence diagram');
    }
    const parsed = parsePlantLike(extracted.source, fileName, sourceKind);
    if (!parsed.lifelines.length) throw new Error('Sequence diagram contains no lifelines');
    return parsed;
  }
  throw new Error('Not a sequence diagram');
}

export function parseSequenceBytes(bytes: Uint8Array, fileName = ''): SeqDataset {
  if (!bytes.length) throw new Error('Sequence file is empty');
  return parseSequenceText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterSeqLifelines(lifelines: SeqLifeline[], query: string, kind: 'all' | SeqLifelineKind = 'all'): SeqLifeline[] {
  let list = kind === 'all' ? lifelines : lifelines.filter((l) => l.kind === kind);
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const tokens = q.split(/\s+/).filter(Boolean);
  return list.filter((l) =>
    tokens.every((token) => {
      if (token.startsWith('kind:')) return l.kind === token.slice(5);
      if (token.startsWith('line:') || token.startsWith('actor:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return l.name.toLowerCase().includes(needle) || l.id.toLowerCase().includes(needle);
      }
      return `${l.id} ${l.name} ${l.kind} ${l.alias}`.toLowerCase().includes(token);
    })
  );
}

export function filterSeqMessages(messages: SeqMessage[], query: string): SeqMessage[] {
  const q = query.trim().toLowerCase();
  if (!q) return messages;
  const tokens = q.split(/\s+/).filter(Boolean);
  return messages.filter((m) =>
    tokens.every((token) => {
      if (token.startsWith('msg:') || token.startsWith('label:')) return m.label.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('from:')) return m.sourceName.toLowerCase().includes(token.slice(5)) || m.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return m.targetName.toLowerCase().includes(token.slice(3)) || m.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('style:')) return m.style === token.slice(6);
      return `${m.source} ${m.target} ${m.sourceName} ${m.targetName} ${m.label} ${m.style}`.toLowerCase().includes(token);
    })
  );
}
