import type { SmDataset, SmSourceKind, SmState, SmStateKind, SmTransition } from '../types/state-machine-viewer.types';

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function looksLikeXml(text: string): boolean {
  return /<(?:scxml|fsm|statechart|state|transition|final)\b/i.test(text);
}

function extractFence(text: string): { source: string; fenced: boolean } {
  const fence = /```(?:scxml|fsm|xml|json|state)?\s*([\s\S]*?)```/i.exec(text);
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

function normalizeKind(raw: string, fallback: SmStateKind = 'normal'): SmStateKind {
  const k = raw.toLowerCase();
  if (k === 'initial' || k === 'start' || k === 'init') return 'initial';
  if (k === 'final' || k === 'end' || k === 'accept') return 'final';
  if (k === 'parallel') return 'parallel';
  return fallback;
}

function upsertState(states: SmState[], next: { id: string; name?: string; kind?: SmStateKind }): SmState {
  const existing = states.find((s) => s.id === next.id || s.name === next.name);
  if (existing) {
    if (next.name && next.name !== next.id) existing.name = next.name;
    if (next.kind && next.kind !== 'normal') existing.kind = next.kind;
    return existing;
  }
  const created: SmState = {
    id: next.id,
    index: states.length,
    name: next.name || next.id,
    kind: next.kind || 'normal',
    x: 0,
    y: 0
  };
  states.push(created);
  return created;
}

function addTransition(
  transitions: SmTransition[],
  source: string,
  target: string,
  event: string,
  cond = '',
  sourceName = '',
  targetName = ''
): void {
  if (!source || !target) return;
  if (transitions.some((t) => t.source === source && t.target === target && t.event === event && t.cond === cond)) return;
  transitions.push({
    id: `t-${transitions.length + 1}`,
    index: transitions.length,
    source,
    target,
    sourceName: sourceName || source,
    targetName: targetName || target,
    event: event || '',
    cond
  });
}

function layoutStates(states: SmState[], transitions: SmTransition[], initial: string): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const s of states) {
    incoming.set(s.id, []);
    outgoing.set(s.id, []);
  }
  for (const t of transitions) {
    outgoing.get(t.source)?.push(t.target);
    incoming.get(t.target)?.push(t.source);
  }
  const rank = new Map<string, number>();
  const startIds = initial && states.some((s) => s.id === initial) ? [initial] : states.filter((s) => s.kind === 'initial').map((s) => s.id);
  const starts = startIds.length ? startIds : states.filter((s) => !(incoming.get(s.id)?.length)).map((s) => s.id);
  (starts.length ? starts : states.slice(0, 1).map((s) => s.id)).forEach((id) => rank.set(id, 0));
  const queue = [...rank.keys()];
  while (queue.length) {
    const id = queue.shift() as string;
    const r = rank.get(id) ?? 0;
    for (const next of outgoing.get(id) ?? []) {
      if (!rank.has(next)) {
        rank.set(next, r + 1);
        queue.push(next);
      }
    }
  }
  const buckets = new Map<number, SmState[]>();
  for (const s of states) {
    const r = rank.get(s.id) ?? 0;
    const list = buckets.get(r) ?? [];
    list.push(s);
    buckets.set(r, list);
  }
  for (const [r, list] of buckets) {
    list.forEach((s, i) => {
      s.x = 48 + r * 200;
      s.y = 40 + i * 110;
    });
  }
}

function finishDataset(
  name: string,
  sourceKind: SmSourceKind,
  title: string,
  initial: string,
  states: SmState[],
  transitions: SmTransition[],
  warnings: string[]
): SmDataset {
  if (!states.length) throw new Error('State machine contains no states');
  let init = initial;
  if (init) {
    const start = upsertState(states, { id: init, name: init, kind: 'initial' });
    init = start.id;
  } else {
    const marked = states.find((s) => s.kind === 'initial');
    init = marked?.id || states[0]?.id || '';
    if (init) upsertState(states, { id: init, kind: 'initial' });
  }
  const byId = new Map(states.map((s) => [s.id, s.name]));
  const byName = new Map(states.map((s) => [s.name.toLowerCase(), s.id]));
  for (const t of transitions) {
    if (!byId.has(t.source)) t.source = byName.get(t.source.toLowerCase()) || t.source;
    if (!byId.has(t.target)) t.target = byName.get(t.target.toLowerCase()) || t.target;
    t.sourceName = byId.get(t.source) || t.sourceName || t.source;
    t.targetName = byId.get(t.target) || t.targetName || t.target;
  }
  layoutStates(states, transitions, init);
  states.forEach((s, i) => (s.index = i));
  transitions.forEach((t, i) => (t.index = i));
  return { name, sourceKind, title: title || name, initial: init, states, transitions, warnings };
}

function parseScxml(xml: string, fileName: string, sourceKind: SmSourceKind): SmDataset {
  const root = /<(?:[\w.-]+:)?(?:scxml|fsm|statechart)\b([^>]*)>/i.exec(xml);
  const ra = attrs(root?.[1] || '');
  const name = ra.name || fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'State machine';
  const initial = ra.initial || ra.initialstate || '';
  const states: SmState[] = [];
  const transitions: SmTransition[] = [];

  const stateRe =
    /<(?:[\w.-]+:)?(state|final|parallel)\b([^>]*?)\/>|<(?:[\w.-]+:)?(state|final|parallel)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:state|final|parallel)>/gi;
  let match: RegExpExecArray | null;
  while ((match = stateRe.exec(xml))) {
    const kindRaw = (match[1] || match[3] || 'state').toLowerCase();
    const a = attrs(match[2] || match[4] || '');
    const id = a.id || a.name || '';
    if (!id) continue;
    const kind: SmStateKind = kindRaw === 'final' ? 'final' : kindRaw === 'parallel' ? 'parallel' : normalizeKind(a.kind || a.type || a.initial === 'true' ? 'initial' : '');
    upsertState(states, { id, name: a.name || a.label || id, kind: kind === 'normal' && a.initial === 'true' ? 'initial' : kind });
    const inner = match[5] || '';
    const transRe =
      /<(?:[\w.-]+:)?transition\b([^>]*?)\/>|<(?:[\w.-]+:)?transition\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?transition>/gi;
    let tm: RegExpExecArray | null;
    while ((tm = transRe.exec(inner))) {
      const ta = attrs(tm[1] || tm[2] || '');
      const target = ta.target || ta.to || '';
      if (!target) continue;
      upsertState(states, { id: target, name: target });
      addTransition(transitions, id, target, ta.event || ta.trigger || '', ta.cond || ta.condition || '');
    }
  }

  const topTrans =
    /<(?:[\w.-]+:)?transition\b([^>]*?)\/>|<(?:[\w.-]+:)?transition\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?transition>/gi;
  while ((match = topTrans.exec(xml))) {
    const a = attrs(match[1] || match[2] || '');
    const source = a.source || a.from || '';
    const target = a.target || a.to || '';
    if (!source || !target) continue;
    upsertState(states, { id: source, name: source });
    upsertState(states, { id: target, name: target });
    addTransition(transitions, source, target, a.event || a.trigger || '', a.cond || a.condition || '');
  }

  if (!states.length) throw new Error('SCXML contains no states');
  return finishDataset(name, sourceKind, name, initial, states, transitions, []);
}

function parseJson(raw: unknown, fileName: string): SmDataset {
  const root = rec(Array.isArray(raw) ? { states: raw } : raw);
  const name = asString(root.name || root.title, fileName.replace(/\.[^.]+$/, '') || 'State machine');
  const initial = asString(root.initial || root.initialState || rec(root.machine).initial);
  const states: SmState[] = [];
  const transitions: SmTransition[] = [];
  const stateList = Array.isArray(root.states) ? root.states : Array.isArray(rec(root.machine).states) ? rec(root.machine).states : [];
  const transList = Array.isArray(root.transitions)
    ? root.transitions
    : Array.isArray(root.edges)
      ? root.edges
      : [];
  if (Array.isArray(stateList)) {
    for (const item of stateList) {
      if (typeof item === 'string') {
        upsertState(states, { id: item, name: item });
        continue;
      }
      const row = rec(item);
      const id = asString(row.id || row.name);
      if (!id) continue;
      upsertState(states, { id, name: asString(row.name || row.label, id), kind: normalizeKind(asString(row.kind || row.type)) });
      const ons = rec(row.on || row.transitions);
      for (const [event, targetRaw] of Object.entries(ons)) {
        const target = asString(typeof targetRaw === 'string' ? targetRaw : rec(targetRaw).target);
        if (!target) continue;
        upsertState(states, { id: target, name: target });
        addTransition(transitions, id, target, event);
      }
    }
  } else if (stateList && typeof stateList === 'object') {
    for (const [id, spec] of Object.entries(rec(stateList))) {
      const row = rec(spec);
      upsertState(states, { id, name: asString(row.name, id), kind: normalizeKind(asString(row.kind || row.type)) });
      const ons = rec(row.on);
      for (const [event, targetRaw] of Object.entries(ons)) {
        const target = asString(typeof targetRaw === 'string' ? targetRaw : rec(targetRaw).target);
        if (!target) continue;
        upsertState(states, { id: target, name: target });
        addTransition(transitions, id, target, event);
      }
    }
  }
  for (const item of transList) {
    const row = rec(item);
    const source = asString(row.source || row.from);
    const target = asString(row.target || row.to);
    if (!source || !target) continue;
    upsertState(states, { id: source, name: asString(row.sourceName, source) });
    upsertState(states, { id: target, name: asString(row.targetName, target) });
    addTransition(transitions, source, target, asString(row.event || row.trigger || row.label), asString(row.cond || row.condition));
  }
  if (!states.length) throw new Error('State machine JSON contains no states');
  return finishDataset(name, 'json', asString(root.title || root.name, name), initial, states, transitions, []);
}

function parseGenericXml(xml: string, fileName: string): SmDataset {
  const root = /<(?:fsm|statechart|machine)\b([^>]*)>/i.exec(xml);
  const ra = attrs(root?.[1] || '');
  const name = ra.name || fileName.replace(/\.[^.]+$/, '') || 'State machine';
  const initial = ra.initial || '';
  const states: SmState[] = [];
  const transitions: SmTransition[] = [];
  const stateRe = /<(?:[\w.-]+:)?state\b([^>]*?)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = stateRe.exec(xml))) {
    const a = attrs(match[1] || '');
    const id = a.id || a.name || '';
    if (!id) continue;
    upsertState(states, { id, name: a.name || id, kind: normalizeKind(a.kind || a.type) });
  }
  const transRe = /<(?:[\w.-]+:)?transition\b([^>]*?)\/>/gi;
  while ((match = transRe.exec(xml))) {
    const a = attrs(match[1] || '');
    const source = a.source || a.from || '';
    const target = a.target || a.to || '';
    if (!source || !target) continue;
    upsertState(states, { id: source, name: source });
    upsertState(states, { id: target, name: target });
    addTransition(transitions, source, target, a.event || a.trigger || '', a.cond || '');
  }
  if (!states.length) throw new Error('FSM XML contains no states');
  return finishDataset(name, 'xml', name, initial, states, transitions, []);
}

function parseMarkdownList(text: string, fileName: string, sourceKind: SmSourceKind): SmDataset {
  const states: SmState[] = [];
  const transitions: SmTransition[] = [];
  let initial = '';
  let name = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '').replace(/-/g, ' ') || 'State machine';
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('```')) continue;
    const heading = /^#\s+(.+)$/.exec(trimmed);
    if (heading) {
      name = heading[1].trim();
      continue;
    }
    const start = /^(?:\[\*\]|\(\*\))\s*-+>\s*(\S+)$/.exec(trimmed);
    if (start) {
      initial = start[1];
      upsertState(states, { id: start[1], name: start[1], kind: 'initial' });
      continue;
    }
    const end = /^(\S+)\s*-+>\s*(?:\[\*\]|\(\*\))(?:\s*:\s*(.+))?$/.exec(trimmed);
    if (end) {
      upsertState(states, { id: end[1], name: end[1] });
      upsertState(states, { id: `${end[1]}-end`, name: 'end', kind: 'final' });
      addTransition(transitions, end[1], `${end[1]}-end`, (end[2] || '').trim());
      continue;
    }
    const arrow = /^(\S+)\s*-+>\s*(\S+)(?:\s*:\s*(.+))?$/.exec(trimmed);
    if (arrow) {
      upsertState(states, { id: arrow[1], name: arrow[1] });
      upsertState(states, { id: arrow[2], name: arrow[2] });
      addTransition(transitions, arrow[1], arrow[2], (arrow[3] || '').trim());
    }
  }
  if (!states.length) throw new Error('State machine contains no states');
  return finishDataset(name, sourceKind, name, initial, states, transitions, []);
}

export function parseStateMachineText(text: string, fileName = ''): SmDataset {
  const raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) throw new Error('State machine file is empty');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid state machine JSON');
    }
    return parseJson(parsed, fileName);
  }
  if (looksLikeXml(raw) || ext === 'xml' || ext === 'scxml' || ext === 'fsm') {
    if (/<(?:[\w.-]+:)?scxml\b/i.test(raw) || ext === 'scxml') {
      return parseScxml(raw, fileName, ext === 'scxml' || /<(?:[\w.-]+:)?scxml\b/i.test(raw) ? 'scxml' : 'xml');
    }
    try {
      return parseGenericXml(raw, fileName);
    } catch {
      return parseScxml(raw, fileName, 'xml');
    }
  }
  const extracted = extractFence(raw);
  const sourceKind: SmSourceKind = extracted.fenced || ext === 'md' ? 'markdown' : 'txt';
  if (/->|\[\*\]/.test(extracted.source) || /^#\s+/m.test(extracted.source)) {
    return parseMarkdownList(extracted.source, fileName, sourceKind);
  }
  throw new Error('Not a state machine');
}

export function parseStateMachineBytes(bytes: Uint8Array, fileName = ''): SmDataset {
  if (!bytes.length) throw new Error('State machine file is empty');
  return parseStateMachineText(new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, ''), fileName);
}

export function filterSmStates(states: SmState[], query: string): SmState[] {
  const q = query.trim().toLowerCase();
  if (!q) return states;
  const tokens = q.split(/\s+/).filter(Boolean);
  return states.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('state:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return s.name.toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle);
      }
      if (token.startsWith('kind:')) return s.kind === token.slice(5);
      return `${s.id} ${s.name} ${s.kind}`.toLowerCase().includes(token);
    })
  );
}

export function filterSmTransitions(transitions: SmTransition[], query: string): SmTransition[] {
  const q = query.trim().toLowerCase();
  if (!q) return transitions;
  const tokens = q.split(/\s+/).filter(Boolean);
  return transitions.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('from:')) return t.sourceName.toLowerCase().includes(token.slice(5)) || t.source.toLowerCase().includes(token.slice(5));
      if (token.startsWith('to:')) return t.targetName.toLowerCase().includes(token.slice(3)) || t.target.toLowerCase().includes(token.slice(3));
      if (token.startsWith('event:')) return t.event.toLowerCase().includes(token.slice(6));
      return `${t.source} ${t.target} ${t.sourceName} ${t.targetName} ${t.event} ${t.cond}`.toLowerCase().includes(token);
    })
  );
}
