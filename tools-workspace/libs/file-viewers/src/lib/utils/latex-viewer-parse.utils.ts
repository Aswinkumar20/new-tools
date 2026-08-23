import type { LxColumn, LxCommand, LxDataset, LxEnv, LxSection, LxSourceKind } from '../types/latex-viewer.types';
import { LX_JSON_SAMPLE } from '../constants/latex-viewer-sample.data';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const LX_MAGIC = new Uint8Array([0x4c, 0x58, 0x30, 0x31]); // LX01

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function looksLikeLatex(text: string): boolean {
  const t = text.trim();
  if (/\b(?:EPUB|MOBI|AZW) dump\b/i.test(t)) return false;
  if (/\bLATEX dump\b/i.test(t)) return true;
  if (/\\documentclass\b/.test(t) || /\\section\s*\{/.test(t)) return true;
  if (/^\s*SECTION\s+\S+/m.test(t) && /^\s*(?:COMMAND|ENV|CLASS|PACKAGE)\s+/m.test(t)) return true;
  return false;
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isLxMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === LX_MAGIC[0] && bytes[1] === LX_MAGIC[1] && bytes[2] === LX_MAGIC[2] && bytes[3] === LX_MAGIC[3];
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function prettyDocName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.(?:latex|tex|[^.]+)$/i, '').replace(/^sample-/, '') || fallback;
  if (/shop/i.test(fromFile) || /shop/i.test(fallback)) return 'ShopRanker';
  return fromFile;
}

function makeSection(raw: Record<string, unknown>, index: number): LxSection {
  const name = asString(raw.name || raw.id, `sec${index + 1}`);
  return {
    id: name,
    index,
    name,
    title: asString(raw.title, name) || name,
    level: asNumber(raw.level, 1) || 1,
    text: asString(raw.text || raw.body)
  };
}

function makeCommand(raw: Record<string, unknown>, index: number): LxCommand {
  const name = asString(raw.name || raw.id, `cmd${index + 1}`);
  return { id: `${name}-${index}`, index, name, value: asString(raw.value) };
}

function makeEnv(raw: Record<string, unknown>, index: number): LxEnv {
  const name = asString(raw.name || raw.id, `env${index + 1}`);
  return { id: name, index, name, kind: asString(raw.kind || raw.type, 'other') || 'other', body: asString(raw.body || raw.value) };
}

function rebuildSource(title: string, author: string, docClass: string, sections: LxSection[], commands: LxCommand[], envs: LxEnv[]): string {
  const pkgs = commands.filter((c) => c.name === 'usepackage').map((c) => `\\usepackage{${c.value}}`);
  const lines = [`\\documentclass{${docClass || 'article'}}`, ...pkgs];
  if (title) lines.push(`\\title{${title}}`);
  if (author) lines.push(`\\author{${author}}`);
  lines.push('\\begin{document}');
  if (title) lines.push('\\maketitle');
  for (const s of sections) {
    const cmd = s.level >= 2 ? 'subsection' : 'section';
    lines.push(`\\${cmd}{${s.title}}`, s.text);
  }
  for (const e of envs) {
    lines.push(`\\begin{${e.kind}}`, e.body, `\\end{${e.kind}}`);
  }
  lines.push('\\end{document}');
  return lines.filter((l) => l !== '').join('\n');
}

function finishDataset(
  name: string,
  sourceKind: LxSourceKind,
  title: string,
  author: string,
  docClass: string,
  encoding: string,
  latexVer: string,
  sections: LxSection[],
  commands: LxCommand[],
  envs: LxEnv[],
  sourceText: string,
  warnings: string[]
): LxDataset {
  if (!sections.length && !commands.length && !envs.length) throw new Error('LaTeX dump contains no sections or commands');
  sections.forEach((s, i) => (s.index = i));
  commands.forEach((c, i) => (c.index = i));
  envs.forEach((e, i) => (e.index = i));
  const columns: LxColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'section', index: 2, name: 'section', type: 'STRING' },
    { id: 'command', index: 3, name: 'command', type: 'STRING' },
    { id: 'value', index: 4, name: 'value', type: 'STRING' }
  ];
  const rows = [
    ...sections.map((s) => ({ name: s.name, type: 'section', section: s.title, command: '', value: s.text.slice(0, 80) })),
    ...commands.map((c) => ({ name: c.name, type: 'command', section: '', command: c.name, value: c.value })),
    ...envs.map((e) => ({ name: e.name, type: 'env', section: e.name, command: e.kind, value: e.body }))
  ];
  return {
    name,
    sourceKind,
    title: title || name,
    author: author || '—',
    docClass: docClass || 'article',
    encoding,
    latexVer: latexVer || '—',
    sectionCount: sections.length,
    commandCount: commands.length,
    envCount: envs.length,
    sourceText: sourceText || rebuildSource(title, author, docClass, sections, commands, envs),
    sections,
    commands,
    envs,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: LxSourceKind = 'json', warnings: string[] = []): LxDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyDocName(fileName, 'LatexDoc'));
  const sections = ((Array.isArray(root.sections) ? root.sections : []) as unknown[]).map((item, i) => makeSection(rec(item), i));
  const commands = ((Array.isArray(root.commands) ? root.commands : []) as unknown[]).map((item, i) => makeCommand(rec(item), i));
  const envs = ((Array.isArray(root.envs) ? root.envs : []) as unknown[]).map((item, i) => makeEnv(rec(item), i));
  const title = asString(root.title, name);
  const author = asString(root.author, 'EasyToolHub');
  const docClass = asString(root.docClass || root.class, 'article') || 'article';
  return finishDataset(
    name,
    sourceKind,
    title,
    author,
    docClass,
    'UTF-8',
    asString(root.latexVer || root.version, '1.0'),
    sections,
    commands,
    envs,
    asString(root.sourceText),
    warnings
  );
}

function parseAsciiLatex(text: string, fileName: string): LxDataset {
  const version = /LATEX dump\s+\S+\s+([\w.]+)/i.exec(text)?.[1] || '1.0';
  const dumpName = /LATEX dump\s+([A-Za-z0-9_-]+)/i.exec(text)?.[1] || prettyDocName(fileName, 'LatexDoc');
  const name = prettyDocName(fileName, dumpName);
  const sections: LxSection[] = [];
  const commands: LxCommand[] = [];
  const envs: LxEnv[] = [];
  let title = name;
  let author = '';
  let docClass = 'article';
  let m: RegExpExecArray | null;
  const classRe = /\bCLASS\s+(\S+)/gi;
  while ((m = classRe.exec(text))) {
    docClass = m[1];
    commands.push(makeCommand({ name: 'documentclass', value: m[1] }, commands.length));
  }
  const pkgRe = /\bPACKAGE\s+(\S+)/gi;
  while ((m = pkgRe.exec(text))) {
    commands.push(makeCommand({ name: 'usepackage', value: m[1] }, commands.length));
  }
  const cmdRe = /\bCOMMAND\s+(\S+)\s+(.+)$/gim;
  while ((m = cmdRe.exec(text))) {
    if (m[1].toLowerCase() === 'title') title = m[2].trim();
    if (m[1].toLowerCase() === 'author') author = m[2].trim();
    commands.push(makeCommand({ name: m[1], value: m[2].trim() }, commands.length));
  }
  const envRe = /\bENV\s+(\S+)\s+(\S+)\s+(.+)$/gim;
  while ((m = envRe.exec(text))) {
    envs.push(makeEnv({ name: m[2], kind: m[1], body: m[3].trim() }, envs.length));
  }
  const parts = text.split(/\bSECTION\s+/i).slice(1);
  for (const part of parts) {
    const header = /^([A-Za-z0-9_-]+)\s+([^\n]+)\n?([\s\S]*)$/.exec(part.trim());
    if (!header) continue;
    const body = header[3].replace(/\b(?:ENV|COMMAND|CLASS|PACKAGE)\b[\s\S]*$/i, '').trim();
    sections.push(makeSection({ name: header[1], title: header[2].trim(), text: body }, sections.length));
  }
  if (!sections.length && !commands.length) throw new Error('LaTeX dump has no SECTION or COMMAND entries');
  const warnings = ['ASCII LaTeX dump is a metadata subset — not Overleaf, TeX Live, or a full LaTeX kernel.'];
  return finishDataset(name, 'latex', title, author || 'EasyToolHub', docClass, 'UTF-8', version, sections, commands, envs, '', warnings);
}

function parseTexSource(text: string, fileName: string): LxDataset {
  const name = prettyDocName(fileName, 'LatexDoc');
  const sections: LxSection[] = [];
  const commands: LxCommand[] = [];
  const envs: LxEnv[] = [];
  const docClass = /\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/.exec(text)?.[1] || 'article';
  commands.push(makeCommand({ name: 'documentclass', value: docClass }, 0));
  const pkgRe = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = pkgRe.exec(text))) {
    commands.push(makeCommand({ name: 'usepackage', value: m[1] }, commands.length));
  }
  const title = /\\title\{([^}]+)\}/.exec(text)?.[1] || name;
  const author = /\\author\{([^}]+)\}/.exec(text)?.[1] || 'EasyToolHub';
  commands.push(makeCommand({ name: 'title', value: title }, commands.length));
  commands.push(makeCommand({ name: 'author', value: author }, commands.length));
  const secRe = /\\(section|subsection|subsubsection)\*?\{([^}]+)\}/g;
  const matches: Array<{ kind: string; title: string; index: number }> = [];
  while ((m = secRe.exec(text))) {
    matches.push({ kind: m[1], title: m[2], index: m.index });
  }
  const bodyStart = /\\begin\{document\}/.exec(text)?.index ?? 0;
  const bodyEnd = /\\end\{document\}/.exec(text)?.index ?? text.length;
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : bodyEnd;
    const chunk = text.slice(start, end);
    const heading = /\\(?:sub)*section\*?\{([^}]+)\}/.exec(chunk)?.[1] || matches[i].title;
    const para = chunk.replace(/\\(?:sub)*section\*?\{[^}]+\}/, '').replace(/\\begin\{[\s\S]*$/i, '').trim();
    const level = matches[i].kind === 'subsubsection' ? 3 : matches[i].kind === 'subsection' ? 2 : 1;
    sections.push(
      makeSection(
        {
          name: `sec${i + 1}`,
          title: heading,
          level,
          text: para.replace(/\\[a-zA-Z]+(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, ' ').replace(/\s+/g, ' ').trim()
        },
        sections.length
      )
    );
  }
  const envRe = /\\begin\{(figure|equation|table|itemize|enumerate|abstract)\}([\s\S]*?)\\end\{\1\}/gi;
  let envI = 0;
  while ((m = envRe.exec(text))) {
    if (m.index < bodyStart) continue;
    envI += 1;
    envs.push(
      makeEnv(
        {
          name: `${m[1]}${envI}`,
          kind: m[1].toLowerCase(),
          body: m[2].replace(/\\[a-zA-Z]+(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, ' ').replace(/\s+/g, ' ').trim() || m[2].trim()
        },
        envs.length
      )
    );
  }
  if (!sections.length && !commands.length) throw new Error('LaTeX source has no sections or commands');
  const warnings = ['TeX subset maps sections, commands, and common environments — full TeX Live expansion is not run.'];
  return finishDataset(name, 'latex', title, author, docClass, 'UTF-8', '1.0', sections, commands, envs, text, warnings);
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

function parseCsvAsLx(text: string, fileName: string): LxDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('LaTeX CSV dump contains no rows');
  const header = parseCsvLine(lines[0])
    .map((h) => h.trim())
    .filter(Boolean);
  const sections: LxSection[] = [];
  const commands: LxCommand[] = [];
  const envs: LxEnv[] = [];
  let title = prettyDocName(fileName, 'LatexDoc');
  let author = '';
  let docClass = 'article';
  lines.slice(1).forEach((line) => {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cols[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'command' || type === 'class' || type === 'package') {
      const cmd = row.command || (row.kind === 'class' ? 'documentclass' : row.kind === 'package' ? 'usepackage' : row.name);
      if (cmd === 'documentclass' || row.kind === 'class') docClass = row.value || row.name || docClass;
      if (cmd === 'title' || row.kind === 'title') title = row.value || title;
      if (cmd === 'author' || row.kind === 'author') author = row.value || author;
      commands.push(makeCommand({ name: cmd, value: row.value || row.name }, commands.length));
      return;
    }
    if (type === 'env') {
      envs.push(makeEnv({ name: row.name || row.section, kind: row.kind || row.command, body: row.value }, envs.length));
      return;
    }
    sections.push(
      makeSection({ name: row.name, title: row.section || row.kind || row.name, level: row.kind, text: row.value }, sections.length)
    );
  });
  return finishDataset(title, 'csv', title, author || 'EasyToolHub', docClass, 'UTF-8', '1.0', sections, commands, envs, '', []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: LxSourceKind): LxDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyDocName(fileName, 'LatexDoc')).trim();
  const keys: string[] = [];
  const sections: LxSection[] = [];
  const commands: LxCommand[] = [];
  const envs: LxEnv[] = [];
  for (const line of text.split(/\r?\n/)) {
    const schema = /^\s*([A-Za-z_][\w.]*)\s*:\s*([A-Za-z0-9_]+)\s*$/.exec(line);
    if (schema) {
      keys.push(schema[1]);
      continue;
    }
    if (line.includes('|') && !/^\s*\|?\s*-+/.test(line) && !/^#/.test(line)) {
      const cols = line
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean);
      if (!cols.length) continue;
      if (!keys.length) {
        cols.forEach((p) => keys.push(p));
        continue;
      }
      const row: Record<string, string> = {};
      keys.forEach((k, i) => (row[k] = cols[i] || ''));
      const type = (row.type || '').toLowerCase();
      if (type === 'command') {
        commands.push(makeCommand({ name: row.kind === 'class' ? 'documentclass' : row.kind === 'package' ? 'usepackage' : row.name, value: row.name }, commands.length));
        continue;
      }
      if (type === 'env') {
        envs.push(makeEnv({ name: row.name, kind: row.kind, body: row.kind }, envs.length));
        continue;
      }
      sections.push(makeSection({ name: row.name, title: row.kind || row.name, text: row.kind }, sections.length));
    }
  }
  if (!sections.length && !commands.length && !envs.length) throw new Error('LaTeX markdown contains no sections or commands');
  return finishDataset(name, sourceKind, name, 'EasyToolHub', 'article', 'UTF-8', '1.0', sections, commands, envs, '', []);
}

function parseLx01(bytes: Uint8Array, fileName: string): LxDataset {
  if (bytes.length < 8) throw new Error('LaTeX dump header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('LaTeX dump JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid LX01 JSON');
  }
  return ingestJson(parsed, fileName, 'latex');
}

export function buildSampleLxBytes(): Uint8Array {
  const json = te.encode(LX_JSON_SAMPLE);
  const out: number[] = [...LX_MAGIC];
  writeU32le(json.length, out);
  out.push(...json);
  return new Uint8Array(out);
}

export function buildSampleLxJson(): string {
  return LX_JSON_SAMPLE;
}

export function parseLxText(text: string, fileName = ''): LxDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('LaTeX dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikeLatex(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid LaTeX JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (/\\documentclass\b/.test(raw) || /\\section\s*\{/.test(raw)) return parseTexSource(raw, fileName);
  if (ext === 'tex' || looksLikeLatex(raw)) return parseAsciiLatex(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsLx(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a LaTeX dump');
}

export function parseLxBytes(bytes: Uint8Array, fileName = ''): LxDataset {
  if (!bytes.length) throw new Error('LaTeX dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed LaTeX files are not supported — decompress first');
  if (isLxMagic(bytes)) return parseLx01(bytes, fileName);
  if (isZipMagic(bytes)) throw new Error('ZIP LaTeX archives are not expanded here — export a .tex dump or JSON');
  return parseLxText(td.decode(bytes), fileName);
}

export function filterLxSections(items: LxSection[], query: string): LxSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('sec:') || token.startsWith('section:') || token.startsWith('name:') || token.startsWith('title:')) {
        return `${s.name} ${s.title}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:') || token.startsWith('kind:')) {
        return 'section'.includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('cmd:') || token.startsWith('command:') || token.startsWith('env:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.title} ${s.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterLxCommands(items: LxCommand[], query: string): LxCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('cmd:') || token.startsWith('command:') || token.startsWith('name:')) {
        return `${c.name} ${c.value}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('class:') || token.startsWith('pkg:') || token.startsWith('package:')) {
        return `${c.name} ${c.value}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('sec:') || token.startsWith('env:') || token.startsWith('row:') || token.startsWith('type:') || token.startsWith('kind:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.name} ${c.value}`.toLowerCase().includes(token);
    })
  );
}

export function filterLxEnvs(items: LxEnv[], query: string): LxEnv[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((e) =>
    tokens.every((token) => {
      if (token.startsWith('env:') || token.startsWith('name:') || token.startsWith('kind:') || token.startsWith('type:')) {
        return `${e.name} ${e.kind} ${e.body}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('sec:') || token.startsWith('cmd:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${e.name} ${e.kind} ${e.body}`.toLowerCase().includes(token);
    })
  );
}

export function filterLxRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('sec:') ||
        token.startsWith('section:') ||
        token.startsWith('cmd:') ||
        token.startsWith('command:') ||
        token.startsWith('env:') ||
        token.startsWith('kind:') ||
        token.startsWith('title:')
      ) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
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
