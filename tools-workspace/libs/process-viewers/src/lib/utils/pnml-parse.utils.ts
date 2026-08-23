import type {
  PnmlArc,
  PnmlDataset,
  PnmlPlace,
  PnmlSourceKind,
  PnmlTokenMarking,
  PnmlTransition
} from '../types/pnml-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) out[match[1]] = match[2];
  return out;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function innerText(block: string, tag: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`, 'i');
  const match = re.exec(block);
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')) : '';
}

function pnmlName(block: string, fallback: string): string {
  const named = /<(?:[\w.-]+:)?name\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?name>/i.exec(block)?.[1] ?? '';
  const text = innerText(named || block, 'text') || innerText(block, 'name');
  return text || fallback;
}

function pnmlMarking(block: string): number {
  const mark = /<(?:[\w.-]+:)?initialMarking\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?initialMarking>/i.exec(block)?.[1] ?? '';
  const text = innerText(mark || block, 'text') || mark.replace(/<[^>]+>/g, '').trim();
  return Math.max(0, asNumber(text, 0));
}

function pnmlWeight(block: string): number {
  const ins = /<(?:[\w.-]+:)?inscription\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?inscription>/i.exec(block)?.[1] ?? '';
  const text = innerText(ins || block, 'text') || ins.replace(/<[^>]+>/g, '').trim();
  return Math.max(1, asNumber(text || 1, 1));
}

function position(block: string): { x: number; y: number } {
  const pos = /<(?:[\w.-]+:)?position\b([^>]*)\/?>/i.exec(block)?.[1] ?? '';
  const a = attrs(pos);
  return { x: asNumber(a.x), y: asNumber(a.y) };
}

function isTransitionEnabled(transitionId: string, places: PnmlPlace[], arcs: PnmlArc[]): boolean {
  const inputs = arcs.filter((a) => a.target === transitionId);
  if (!inputs.length) return false;
  return inputs.every((a) => {
    const place = places.find((p) => p.id === a.source);
    return !!place && place.tokens >= Math.max(1, a.weight || 1);
  });
}

function finishDataset(
  name: string,
  sourceKind: PnmlSourceKind,
  netType: string,
  places: PnmlPlace[],
  transitions: PnmlTransition[],
  arcs: PnmlArc[],
  warnings: string[]
): PnmlDataset {
  const nameById = new Map<string, string>([
    ...places.map((p) => [p.id, p.name] as const),
    ...transitions.map((t) => [t.id, t.name] as const)
  ]);
  const inCount = new Map<string, number>();
  const outCount = new Map<string, number>();
  for (const a of arcs) {
    outCount.set(a.source, (outCount.get(a.source) ?? 0) + 1);
    inCount.set(a.target, (inCount.get(a.target) ?? 0) + 1);
    a.sourceName = nameById.get(a.source) || a.source;
    a.targetName = nameById.get(a.target) || a.target;
  }
  places.forEach((p) => {
    p.inCount = inCount.get(p.id) ?? 0;
    p.outCount = outCount.get(p.id) ?? 0;
  });
  transitions.forEach((t) => {
    t.inCount = inCount.get(t.id) ?? 0;
    t.outCount = outCount.get(t.id) ?? 0;
    t.enabled = isTransitionEnabled(t.id, places, arcs);
  });
  const tokens: PnmlTokenMarking[] = places.map((p, i) => ({
    id: `m-${p.id}`,
    index: i,
    placeId: p.id,
    placeName: p.name,
    tokens: p.tokens
  }));
  const tokenTotal = places.reduce((sum, p) => sum + p.tokens, 0);
  const enabledCount = transitions.filter((t) => t.enabled).length;
  if (!places.length) warnings.push('PNML net contains no places.');
  if (!transitions.length && places.length) warnings.push('PNML has places but no transitions.');
  if (!tokenTotal) warnings.push('Initial marking is empty — no tokens on any place.');
  return {
    name,
    sourceKind,
    netType,
    places,
    transitions,
    arcs,
    tokens,
    tokenTotal,
    enabledCount,
    warnings
  };
}

function parsePnmlXml(xml: string): PnmlDataset {
  if (!/<(?:[\w.-]+:)?pnml\b/i.test(xml) && !/<(?:[\w.-]+:)?net\b/i.test(xml) && !/<(?:[\w.-]+:)?place\b/i.test(xml)) {
    throw new Error('Not a PNML document');
  }
  const netMatch = /<(?:[\w.-]+:)?net\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?net>/i.exec(xml);
  const netAttrs = attrs(netMatch?.[1] ?? '');
  const block = netMatch?.[2] || xml;
  const name = pnmlName(block, netAttrs.id || 'Petri net');
  const netType = netAttrs.type || '';
  const places: PnmlPlace[] = [];
  const placeRe = /<(?:[\w.-]+:)?place\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?place>|<(?:[\w.-]+:)?place\b([^>]*)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = placeRe.exec(block))) {
    const a = attrs(match[1] || match[3] || '');
    const inner = match[2] || '';
    const id = a.id || `p-${places.length + 1}`;
    const pos = position(inner);
    places.push({
      id,
      index: places.length,
      name: a.name || pnmlName(inner, id),
      tokens: pnmlMarking(inner),
      x: pos.x,
      y: pos.y,
      inCount: 0,
      outCount: 0
    });
  }
  const transitions: PnmlTransition[] = [];
  const transRe =
    /<(?:[\w.-]+:)?transition\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?transition>|<(?:[\w.-]+:)?transition\b([^>]*)\/>/gi;
  while ((match = transRe.exec(block))) {
    const a = attrs(match[1] || match[3] || '');
    const inner = match[2] || '';
    const id = a.id || `t-${transitions.length + 1}`;
    const pos = position(inner);
    transitions.push({
      id,
      index: transitions.length,
      name: a.name || pnmlName(inner, id),
      enabled: false,
      x: pos.x,
      y: pos.y,
      inCount: 0,
      outCount: 0
    });
  }
  const arcs: PnmlArc[] = [];
  const arcRe = /<(?:[\w.-]+:)?arc\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?arc>|<(?:[\w.-]+:)?arc\b([^>]*)\/>/gi;
  while ((match = arcRe.exec(block))) {
    const a = attrs(match[1] || match[3] || '');
    const inner = match[2] || '';
    const source = a.source || a.sourceRef || '';
    const target = a.target || a.targetRef || '';
    if (!source || !target) continue;
    arcs.push({
      id: a.id || `a-${arcs.length + 1}`,
      index: arcs.length,
      source,
      target,
      sourceName: source,
      targetName: target,
      weight: pnmlWeight(inner) || asNumber(a.weight, 1)
    });
  }
  if (!places.length && !transitions.length) throw new Error('PNML document contains no places or transitions');
  const warnings: string[] = [];
  return finishDataset(name, 'pnml', netType, places, transitions, arcs, warnings);
}

function parsePnmlJson(data: Record<string, unknown>): PnmlDataset {
  const placesRaw = Array.isArray(data.places) ? data.places : null;
  if (!placesRaw) throw new Error('PNML JSON is missing places');
  const places: PnmlPlace[] = placesRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `p-${i + 1}`),
      index: i,
      name: asString(rec.name, `Place ${i + 1}`),
      tokens: Math.max(0, asNumber(rec.tokens ?? rec.marking ?? rec.initialMarking)),
      x: asNumber(rec.x),
      y: asNumber(rec.y),
      inCount: 0,
      outCount: 0
    };
  });
  const transRaw = Array.isArray(data.transitions) ? data.transitions : [];
  const transitions: PnmlTransition[] = transRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `t-${i + 1}`),
      index: i,
      name: asString(rec.name, `Transition ${i + 1}`),
      enabled: false,
      x: asNumber(rec.x),
      y: asNumber(rec.y),
      inCount: 0,
      outCount: 0
    };
  });
  const arcsRaw = Array.isArray(data.arcs) ? data.arcs : [];
  const arcs: PnmlArc[] = arcsRaw.map((item, i) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      id: asString(rec.id, `a-${i + 1}`),
      index: i,
      source: asString(rec.source ?? rec.from),
      target: asString(rec.target ?? rec.to),
      sourceName: asString(rec.sourceName ?? rec.source ?? rec.from),
      targetName: asString(rec.targetName ?? rec.target ?? rec.to),
      weight: Math.max(1, asNumber(rec.weight, 1))
    };
  });
  return finishDataset(asString(data.name, 'PNML snapshot'), 'json', asString(data.netType), places, transitions, arcs, []);
}

function parsePnmlCsv(text: string): PnmlDataset {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(',').map((c) => c.trim()));
  if (rows.length < 2) throw new Error('PNML CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase().replace(/-/g, '_'));
  const idx = (name: string): number => header.indexOf(name);
  const typeI = idx('type') >= 0 ? idx('type') : idx('kind');
  const idI = idx('id');
  const nameI = idx('name');
  if (typeI < 0) throw new Error('PNML CSV needs a type column');
  const tokenI = idx('tokens') >= 0 ? idx('tokens') : idx('marking');
  const sourceI = idx('source') >= 0 ? idx('source') : idx('from');
  const targetI = idx('target') >= 0 ? idx('target') : idx('to');
  const weightI = idx('weight');
  const places: PnmlPlace[] = [];
  const transitions: PnmlTransition[] = [];
  const arcs: PnmlArc[] = [];
  rows.slice(1).forEach((row) => {
    const type = (row[typeI] || '').toLowerCase();
    const id = (idI >= 0 && row[idI]) || `${type}-${places.length + transitions.length + arcs.length + 1}`;
    const name = (nameI >= 0 && row[nameI]) || id;
    if (type === 'place') {
      places.push({
        id,
        index: places.length,
        name,
        tokens: Math.max(0, asNumber(tokenI >= 0 ? row[tokenI] : 0)),
        x: 0,
        y: 0,
        inCount: 0,
        outCount: 0
      });
    } else if (type === 'transition') {
      transitions.push({
        id,
        index: transitions.length,
        name,
        enabled: false,
        x: 0,
        y: 0,
        inCount: 0,
        outCount: 0
      });
    } else if (type === 'arc') {
      const source = sourceI >= 0 ? row[sourceI] : '';
      const target = targetI >= 0 ? row[targetI] : '';
      if (!source || !target) return;
      arcs.push({
        id,
        index: arcs.length,
        source,
        target,
        sourceName: source,
        targetName: target,
        weight: Math.max(1, asNumber(weightI >= 0 ? row[weightI] : 1, 1))
      });
    }
  });
  if (!places.length) throw new Error('PNML CSV contains no places');
  return finishDataset('PNML CSV', 'csv', '', places, transitions, arcs, []);
}

export function parsePnmlText(text: string, fileName = ''): PnmlDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('PNML file is empty');
  if (trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid PNML JSON');
    }
    if (!data || typeof data !== 'object') throw new Error('PNML JSON must be an object');
    return parsePnmlJson(data as Record<string, unknown>);
  }
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  if (ext === 'csv' || (trimmed.includes(',') && /type|kind/i.test(trimmed.split('\n')[0] || '') && /place|transition|arc/i.test(trimmed))) {
    return parsePnmlCsv(trimmed);
  }
  if (ext === 'pnml' || ext === 'xml' || /^</.test(trimmed)) return parsePnmlXml(trimmed);
  throw new Error('No PNML net found — use .pnml, XML, JSON, or CSV');
}

export function parsePnmlBytes(bytes: Uint8Array, fileName = ''): PnmlDataset {
  if (!bytes.length) throw new Error('PNML file is empty');
  return parsePnmlText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterPnmlPlaces(places: PnmlPlace[], query: string): PnmlPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return places;
  const tokens = q.split(/\s+/).filter(Boolean);
  return places.filter((p) =>
    tokens.every((token) => {
      if (token === 'marked' || token === 'tokens') return p.tokens > 0;
      if (token === 'empty') return p.tokens === 0;
      if (token.startsWith('place:')) return p.name.toLowerCase().includes(token.slice(6)) || p.id.toLowerCase().includes(token.slice(6));
      return `${p.id} ${p.name} ${p.tokens}`.toLowerCase().includes(token);
    })
  );
}

export function filterPnmlTransitions(transitions: PnmlTransition[], query: string): PnmlTransition[] {
  const q = query.trim().toLowerCase();
  if (!q) return transitions;
  const tokens = q.split(/\s+/).filter(Boolean);
  return transitions.filter((t) =>
    tokens.every((token) => {
      if (token === 'enabled') return t.enabled;
      if (token === 'disabled') return !t.enabled;
      if (token.startsWith('transition:')) {
        return t.name.toLowerCase().includes(token.slice(11)) || t.id.toLowerCase().includes(token.slice(11));
      }
      return `${t.id} ${t.name} ${t.enabled ? 'enabled' : 'disabled'}`.toLowerCase().includes(token);
    })
  );
}

export function filterPnmlTokens(tokens: PnmlTokenMarking[], query: string): PnmlTokenMarking[] {
  const q = query.trim().toLowerCase();
  if (!q) return tokens;
  const parts = q.split(/\s+/).filter(Boolean);
  return tokens.filter((t) =>
    parts.every((token) => {
      if (token === 'marked' || token === 'tokens') return t.tokens > 0;
      if (token === 'empty') return t.tokens === 0;
      if (token.startsWith('place:')) return t.placeName.toLowerCase().includes(token.slice(6));
      return `${t.placeName} ${t.placeId} ${t.tokens}`.toLowerCase().includes(token);
    })
  );
}
