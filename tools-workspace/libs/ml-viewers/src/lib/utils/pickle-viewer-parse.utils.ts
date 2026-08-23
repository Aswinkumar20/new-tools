import type { PkColumn, PkDataset, PkSourceKind, PkTypeHint, PkTypeKind, PkWarning, PkWarningLevel } from '../types/pickle-viewer.types';
import { PK_JSON_SAMPLE } from '../constants/pickle-viewer-sample.data';
import { isGzipMagic, isMostlyText } from './ml-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const PI_MAGIC = new Uint8Array([0x50, 0x49, 0x30, 0x31]); // PI01 (not PK — ZIP conflict)

const DANGEROUS_MODULES = new Set(['os', 'subprocess', 'posix', 'nt', 'commands', 'pty', 'socket', 'webbrowser', 'importlib', 'ctypes', 'code', 'builtins']);
const DANGEROUS_NAMES = new Set(['system', 'popen', 'exec', 'eval', 'execfile', 'compile', '__import__', 'open']);

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isPiMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === PI_MAGIC[0] && bytes[1] === PI_MAGIC[1] && bytes[2] === PI_MAGIC[2] && bytes[3] === PI_MAGIC[3];
}

function isPickleProto(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x80 && bytes[1] >= 0 && bytes[1] <= 5;
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || fallback;
  if (/^shop[-_]?ranker$/i.test(fromFile) || /^shop[-_]?ranker$/i.test(fallback)) return 'ShopRanker';
  return fromFile;
}

function typeKind(raw: unknown, name: string, module: string): PkTypeKind {
  const v = asString(raw).toLowerCase();
  if (v === 'class' || v === 'array' || v === 'mapping' || v === 'module' || v === 'function' || v === 'other') return v;
  const n = `${module}.${name}`.toLowerCase();
  if (/ndarray|tensor|array/.test(n)) return 'array';
  if (/dict|ordereddict|mapping/.test(n)) return 'mapping';
  if (/nn\.|module$/.test(n) || /^torch\.nn/.test(module)) return 'module';
  if (/^def |function/.test(n)) return 'function';
  return 'class';
}

function warningLevel(raw: unknown, fallback: PkWarningLevel = 'info'): PkWarningLevel {
  const v = asString(raw, fallback).toLowerCase();
  if (v === 'info' || v === 'warn' || v === 'danger') return v;
  if (v === 'warning') return 'warn';
  if (v === 'error' || v === 'critical') return 'danger';
  return fallback;
}

function isDangerous(module: string, name: string): boolean {
  const mod = module.split('.')[0]?.toLowerCase() || '';
  const nm = name.toLowerCase();
  if (DANGEROUS_MODULES.has(mod) && (DANGEROUS_NAMES.has(nm) || nm === '*')) return true;
  if (mod === 'os' || mod === 'subprocess' || mod === 'posix' || mod === 'nt') return true;
  if (mod === 'builtins' && DANGEROUS_NAMES.has(nm)) return true;
  return false;
}

function alwaysInfoWarning(): PkWarning {
  return {
    id: 'never-unpickle',
    index: 0,
    level: 'info',
    message: 'Pickle dumps are not executed; only type hints are listed.'
  };
}

function finishDataset(
  name: string,
  sourceKind: PkSourceKind,
  title: string,
  encoding: string,
  protocol: string,
  python: string,
  types: PkTypeHint[],
  warningItems: PkWarning[],
  extraWarnings: string[]
): PkDataset {
  if (!types.length && !warningItems.length) throw new Error('Pickle dump contains no type hints');
  types.forEach((t, i) => (t.index = i));
  const seenWarn = new Set(warningItems.map((w) => w.message));
  if (!seenWarn.has(alwaysInfoWarning().message)) warningItems.unshift(alwaysInfoWarning());
  warningItems.forEach((w, i) => (w.index = i));
  const columns: PkColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'module', index: 1, name: 'module', type: 'STRING' },
    { id: 'kind', index: 2, name: 'kind', type: 'STRING' },
    { id: 'qualified', index: 3, name: 'qualified', type: 'STRING' }
  ];
  const rows = types.map((t) => ({
    name: t.name,
    module: t.module,
    kind: t.kind,
    qualified: t.qualified
  }));
  const warnings = extraWarnings.slice();
  for (const w of warningItems) {
    if (w.level !== 'info') warnings.push(`${w.level}: ${w.message}`);
  }
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    protocol: protocol || '—',
    python: python || '—',
    typeCount: types.length,
    warningCount: warningItems.length,
    types,
    warningItems,
    columns,
    rows,
    warnings
  };
}

function makeType(name: string, module: string, kindRaw: unknown): PkTypeHint {
  const kind = typeKind(kindRaw, name, module);
  return {
    id: `${module}.${name}` || name,
    index: 0,
    name,
    module,
    kind,
    qualified: module ? `${module}.${name}` : name
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: PkSourceKind = 'json', extraWarnings: string[] = []): PkDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Pickle'));
  const typeSrc = (Array.isArray(root.types) ? root.types : Array.isArray(root.classes) ? root.classes : []) as unknown[];
  const warnSrc = (Array.isArray(root.warnings) ? root.warnings : Array.isArray(root.notes) ? root.notes : []) as unknown[];
  const types: PkTypeHint[] = typeSrc.map((item, index) => {
    const n = rec(item);
    const typeName = asString(n.name || n.class || n.qualname, `type${index + 1}`);
    const module = asString(n.module || n.pkg);
    return makeType(typeName, module, n.kind || n.role);
  });
  const warningItems: PkWarning[] = warnSrc.map((item, index) => {
    if (typeof item === 'string') {
      return { id: `w${index}`, index, level: 'info' as const, message: item };
    }
    const w = rec(item);
    return {
      id: asString(w.id, `w${index}`),
      index,
      level: warningLevel(w.level || w.severity),
      message: asString(w.message || w.text, 'Note')
    };
  });
  for (const t of types) {
    if (isDangerous(t.module, t.name)) {
      warningItems.push({
        id: `danger-${t.qualified}`,
        index: warningItems.length,
        level: 'danger',
        message: `Dangerous reconstruct: ${t.qualified}`
      });
    }
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'pkl' ? 'binary' : 'UTF-8',
    asString(root.protocol, '4'),
    asString(root.python || root.version, '3.11'),
    types,
    warningItems,
    extraWarnings
  );
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsvAsPk(text: string, fileName: string): PkDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('Pickle CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const types: PkTypeHint[] = [];
  const warningItems: PkWarning[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    if (row.message || row.warning || (row.level && !row.name)) {
      warningItems.push({
        id: `w${index}`,
        index: warningItems.length,
        level: warningLevel(row.level || row.severity),
        message: row.message || row.warning || row.text || ''
      });
      return;
    }
    const name = row.name || `type${index + 1}`;
    types.push(makeType(name, row.module || '', row.kind));
  });
  const modelName = prettyModelName(fileName, 'Pickle');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', '4', '3.11', types, warningItems, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: PkSourceKind): PkDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Pickle')).trim();
  const keys: string[] = [];
  const types: PkTypeHint[] = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      keys.push(schema[1]);
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!keys.length) {
        parts.forEach((p) => keys.push(p));
        continue;
      }
      const row: Record<string, string> = {};
      keys.forEach((k, i) => (row[k] = parts[i] || ''));
      const typeName = row.name || `type${types.length + 1}`;
      types.push(makeType(typeName, row.module || '', row.kind));
    }
  }
  if (!types.length) throw new Error('Pickle markdown contains no type hints');
  return finishDataset(name, sourceKind, name, 'UTF-8', '4', '3.11', types, [], []);
}

function readAsciiLine(bytes: Uint8Array, start: number): { value: string; next: number } {
  let i = start;
  while (i < bytes.length && bytes[i] !== 0x0a) i += 1;
  return { value: td.decode(bytes.subarray(start, i)).replace(/\r$/, ''), next: Math.min(bytes.length, i + 1) };
}

function scanPickleOpcodes(bytes: Uint8Array, fileName: string): PkDataset {
  const strings: string[] = [];
  const types: PkTypeHint[] = [];
  const warningItems: PkWarning[] = [];
  const seen = new Set<string>();
  let protocol = String(bytes[1] ?? 0);
  let i = 2;
  const addType = (module: string, name: string) => {
    if (!name) return;
    const key = `${module}.${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    const hint = makeType(name, module, '');
    types.push(hint);
    if (isDangerous(module, name)) {
      warningItems.push({
        id: `danger-${key}`,
        index: warningItems.length,
        level: 'danger',
        message: `Dangerous reconstruct: ${key}`
      });
    }
  };
  while (i < bytes.length) {
    const op = bytes[i];
    i += 1;
    if (op === 0x2e) break; // STOP
    if (op === 0x80 && i < bytes.length) {
      protocol = String(bytes[i]);
      i += 1;
      continue;
    }
    if (op === 0x63 || op === 0x69) {
      const mod = readAsciiLine(bytes, i);
      const nam = readAsciiLine(bytes, mod.next);
      addType(mod.value, nam.value);
      i = nam.next;
      continue;
    }
    if (op === 0x8c && i < bytes.length) {
      const len = bytes[i];
      i += 1;
      strings.push(td.decode(bytes.subarray(i, i + len)));
      i += len;
      continue;
    }
    if (op === 0x58 && i + 4 <= bytes.length) {
      const len = u32le(bytes, i);
      i += 4;
      if (len < 0 || len > bytes.length - i || len > 1_000_000) break;
      strings.push(td.decode(bytes.subarray(i, i + len)));
      i += len;
      continue;
    }
    if (op === 0x93) {
      const name = strings.pop() || '';
      const module = strings.pop() || '';
      addType(module, name);
      continue;
    }
    if (op === 0x94 || op === 0x71 || op === 0x68 || op === 0x61 || op === 0x65 || op === 0x75 || op === 0x73) continue;
    if (op === 0x4b && i < bytes.length) {
      i += 1;
      continue;
    }
    if (op === 0x4a && i + 4 <= bytes.length) {
      i += 4;
      continue;
    }
    if (op === 0x81 || op === 0x52 || op === 0x62 || op === 0x86 || op === 0x85 || op === 0x87) continue;
  }
  if (!types.length) throw new Error('Pickle stream has no GLOBAL / STACK_GLOBAL type hints');
  const name = prettyModelName(fileName, 'Pickle');
  return finishDataset(name, 'pkl', name, 'binary', protocol, '—', types, warningItems, []);
}

function parseProtocol0Text(text: string, fileName: string): PkDataset {
  const types: PkTypeHint[] = [];
  const warningItems: PkWarning[] = [];
  const seen = new Set<string>();
  const globalRe = /^c([A-Za-z0-9_.]+)\n([A-Za-z0-9_]+)\n/gm;
  let match: RegExpExecArray | null;
  while ((match = globalRe.exec(text))) {
    const module = match[1];
    const name = match[2];
    const key = `${module}.${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    types.push(makeType(name, module, ''));
    if (isDangerous(module, name)) {
      warningItems.push({
        id: `danger-${key}`,
        index: warningItems.length,
        level: 'danger',
        message: `Dangerous reconstruct: ${key}`
      });
    }
  }
  if (!types.length) throw new Error('Not a pickle dump');
  const modelName = prettyModelName(fileName, 'Pickle');
  return finishDataset(modelName, 'txt', modelName, 'UTF-8', '0', '—', types, warningItems, []);
}

function parsePi01(bytes: Uint8Array, fileName: string): PkDataset {
  if (bytes.length < 8) throw new Error('Pickle dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('Pickle dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid PI01 JSON');
  }
  return ingestJson(parsed, fileName, 'pkl');
}

export function buildSamplePkBytes(): Uint8Array {
  const json = te.encode(PK_JSON_SAMPLE);
  const out: number[] = [...PI_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSamplePkJson(): string {
  return PK_JSON_SAMPLE;
}

export function buildSamplePickleProto(): Uint8Array {
  const out: number[] = [0x80, 0x04];
  const pushShort = (s: string) => {
    const b = te.encode(s);
    out.push(0x8c, b.length, ...b, 0x94);
  };
  pushShort('shop.ranker');
  pushShort('ShopRanker');
  out.push(0x93);
  pushShort('numpy');
  pushShort('ndarray');
  out.push(0x93);
  pushShort('collections');
  pushShort('OrderedDict');
  out.push(0x93);
  pushShort('torch.nn');
  pushShort('Linear');
  out.push(0x93);
  out.push(0x2e);
  return new Uint8Array(out);
}

export function buildDangerousPickleProto(): Uint8Array {
  const out: number[] = [0x80, 0x04];
  const pushShort = (s: string) => {
    const b = te.encode(s);
    out.push(0x8c, b.length, ...b);
  };
  pushShort('os');
  pushShort('system');
  out.push(0x93, 0x2e);
  return new Uint8Array(out);
}

export function parsePkText(text: string, fileName = ''): PkDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('Pickle dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || looksLikeJson(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid pickle JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsPk(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  if (/^c[A-Za-z0-9_.]+\n[A-Za-z0-9_]+\n/m.test(raw) || /^\(dp0/m.test(raw)) return parseProtocol0Text(raw, fileName);
  throw new Error('Not a pickle dump');
}

export function parsePkBytes(bytes: Uint8Array, fileName = ''): PkDataset {
  if (!bytes.length) throw new Error('Pickle dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed pickle files are not supported — decompress first');
  if (isPiMagic(bytes)) return parsePi01(bytes, fileName);
  if (isPickleProto(bytes)) return scanPickleOpcodes(bytes, fileName);
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if ((ext === 'pkl' || ext === 'pickle' || ext === 'p' || ext === 'joblib') && !isMostlyText(bytes)) {
    throw new Error('Not a pickle dump (expected PI01, PROTO, or JSON)');
  }
  return parsePkText(td.decode(bytes), fileName);
}

export function filterPkTypes(types: PkTypeHint[], query: string): PkTypeHint[] {
  const q = query.trim().toLowerCase();
  if (!q) return types;
  const tokens = q.split(/\s+/).filter(Boolean);
  return types.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('type:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return t.name.toLowerCase().includes(needle) || t.qualified.toLowerCase().includes(needle);
      }
      if (token.startsWith('module:')) return t.module.toLowerCase().includes(token.slice(7));
      if (token.startsWith('kind:')) return t.kind.toLowerCase().includes(token.slice(5));
      if (token.startsWith('warn:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${t.name} ${t.module} ${t.kind} ${t.qualified}`.toLowerCase().includes(token);
    })
  );
}

export function filterPkWarnings(items: PkWarning[], query: string): PkWarning[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((w) =>
    tokens.every((token) => {
      if (token.startsWith('warn:') || token.startsWith('name:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return w.message.toLowerCase().includes(needle) || w.level.toLowerCase().includes(needle);
      }
      if (token.startsWith('kind:') || token.startsWith('type:')) return w.level.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('module:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${w.level} ${w.message}`.toLowerCase().includes(token);
    })
  );
}

export function filterPkRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('type:') || token.startsWith('name:') || token.startsWith('module:') || token.startsWith('kind:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('warn:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        const hit = Object.entries(row).find(([k]) => k.toLowerCase() === key.toLowerCase());
        return hit ? hit[1].toLowerCase().includes(needle) : false;
      }
      return Object.values(row).some((v) => v.toLowerCase().includes(token));
    })
  );
}
