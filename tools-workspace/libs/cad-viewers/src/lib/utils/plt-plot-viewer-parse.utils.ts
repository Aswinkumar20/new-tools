import type { PlColumn, PlCommand, PlCommandType, PlDataset, PlPen, PlSourceKind } from '../types/plt-plot-viewer.types';
import { PL_ASCII_SAMPLE, PL_JSON_SAMPLE } from '../constants/plt-plot-viewer-sample.data';
import { aciToHex, isGzipMagic, isMostlyText, type CadDumpRec, prettyCadModelName } from './cad-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const PL01 = [0x50, 0x4c, 0x30, 0x31];

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): CadDumpRec {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as CadDumpRec) : {};
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{["\d]|true|false|null|-)/.test(t);
}

function looksLikePlt(text: string): boolean {
  const t = text.trim();
  if (/\bPLT dump\b/i.test(t)) return true;
  if (/^\s*PEN\s+\S+/m.test(t)) return true;
  if (/^\s*(?:LINE|CIRCLE|POLYLINE|TEXT)\s+\S+\s+\S+/m.test(t)) return true;
  if (/^\s*IN\s*;/m.test(t) && /(?:^|;|\n)\s*(?:SP|PU|PD)\s*[;\d.-]/im.test(t)) return true;
  return false;
}

function prettyModelName(fileName: string, fallback: string): string {
  return prettyCadModelName(fileName, fallback);
}

function commandType(raw: unknown, name: string): PlCommandType {
  const v = asString(raw, name).toLowerCase();
  if (v === 'line' || v === 'circle' || v === 'arc' || v === 'polyline' || v === 'text' || v === 'point' || v === 'other') return v;
  if (v === 'lwpolyline') return 'polyline';
  return 'other';
}

function asPoints(value: unknown): Array<{ x: number; y: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (Array.isArray(item) && item.length >= 2) return { x: asNumber(item[0]), y: asNumber(item[1]) };
      const p = rec(item);
      return { x: asNumber(p.x), y: asNumber(p.y) };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function lineLength(x: number, y: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x, y2 - y);
}

function polylineLength(points: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

function makePen(name: string, color: number, visible = true, commandCount = 0, index = 0): PlPen {
  return { id: name, index, name, color, colorHex: aciToHex(color || 7), visible, commandCount };
}

function makeCommand(raw: CadDumpRec, index: number, fallbackPen: string, penColors: Map<string, string>): PlCommand {
  const name = asString(raw.name || raw.id, `cmd${index + 1}`);
  const type = commandType(raw.type || raw.kind, name);
  const points = asPoints(raw.points);
  const x = asNumber(raw.x ?? raw.x1 ?? (points[0]?.x ?? 0));
  const y = asNumber(raw.y ?? raw.y1 ?? (points[0]?.y ?? 0));
  const x2 = asNumber(raw.x2 ?? raw.endX ?? (points[points.length - 1]?.x ?? 0));
  const y2 = asNumber(raw.y2 ?? raw.endY ?? (points[points.length - 1]?.y ?? 0));
  const r = asNumber(raw.r ?? raw.radius);
  const pen = asString(raw.pen || raw.layer, fallbackPen || 'PEN1');
  const length =
    type === 'line'
      ? lineLength(x, y, x2, y2)
      : type === 'circle'
        ? Number((2 * Math.PI * r).toFixed(3))
        : type === 'polyline'
          ? polylineLength(points.length ? points : [
              { x, y },
              { x: x2, y: y2 }
            ])
          : asNumber(raw.length);
  return {
    id: name,
    index,
    name,
    type,
    pen,
    colorHex: asString(raw.colorHex) || penColors.get(pen) || aciToHex(asNumber(raw.color, 7)),
    x,
    y,
    x2,
    y2,
    r,
    text: asString(raw.text || raw.label),
    length,
    points
  };
}

function finishDataset(
  name: string,
  sourceKind: PlSourceKind,
  title: string,
  encoding: string,
  plotterVer: string,
  units: string,
  pens: PlPen[],
  commands: PlCommand[],
  warnings: string[]
): PlDataset {
  if (!pens.length && !commands.length) throw new Error('PLT dump contains no pens or commands');
  commands.forEach((c, i) => (c.index = i));
  pens.forEach((p) => {
    if (!p.commandCount) p.commandCount = commands.filter((c) => c.pen === p.name).length;
  });
  const columns: PlColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'type', index: 1, name: 'type', type: 'STRING' },
    { id: 'pen', index: 2, name: 'pen', type: 'STRING' },
    { id: 'x', index: 3, name: 'x', type: 'NUMBER' },
    { id: 'y', index: 4, name: 'y', type: 'NUMBER' }
  ];
  const rows = commands.map((c) => ({
    name: c.name,
    type: c.type,
    pen: c.pen,
    x: String(c.x),
    y: String(c.y)
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    plotterVer: plotterVer || '—',
    units: units || 'm',
    penCount: pens.length,
    commandCount: commands.length,
    pens,
    commands,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: PlSourceKind = 'json', warnings: string[] = []): PlDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title, prettyModelName(fileName, 'Plot'));
  const penSrc = (Array.isArray(root.pens) ? root.pens : Array.isArray(root.layers) ? root.layers : []) as unknown[];
  const cmdSrc = (Array.isArray(root.commands) ? root.commands : Array.isArray(root.entities) ? root.entities : []) as unknown[];
  const pens: PlPen[] = penSrc.map((item, index) => {
    const n = rec(item);
    return makePen(asString(n.name, `pen${index + 1}`), asNumber(n.color ?? n.aci, 7), n.visible !== false, asNumber(n.commandCount ?? n.entityCount), index);
  });
  const colors = new Map(pens.map((p) => [p.name, p.colorHex] as const));
  const commands: PlCommand[] = cmdSrc.map((item, index) => makeCommand(rec(item), index, pens[0]?.name || 'PEN1', colors));
  if (!pens.length) {
    const names = [...new Set(commands.map((c) => c.pen || 'PEN1'))];
    names.forEach((pn, i) => pens.push(makePen(pn, 7 - (i % 6), true, 0, i)));
  }
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'plt' ? 'ASCII' : 'UTF-8',
    asString(root.plotterVer || root.version || root.hpglVer, 'HPGL/2'),
    asString(root.units, 'm'),
    pens,
    commands,
    warnings
  );
}

function parseCoordList(args: string): number[] {
  return args
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => Number(p))
    .filter((n) => Number.isFinite(n));
}

function pairsFromCoords(nums: number[]): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i], y: nums[i + 1] });
  return out;
}

function tokenizeHpgl(text: string): Array<{ cmd: string; args: string }> {
  const out: Array<{ cmd: string; args: string }> = [];
  let i = 0;
  const s = text;
  const twoLetter = new Set([
    'IN',
    'SP',
    'PU',
    'PD',
    'PA',
    'PR',
    'CI',
    'AA',
    'AR',
    'DT',
    'VS',
    'PW',
    'IP',
    'SC',
    'SI',
    'SR',
    'DI',
    'DR',
    'CP',
    'EA',
    'ER',
    'EW',
    'RA',
    'RR',
    'WG',
    'PM',
    'EP',
    'FP',
    'PG',
    'AF',
    'AH',
    'EC',
    'SM',
    'TL',
    'XT',
    'YT'
  ]);
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (i >= s.length) break;
    const two = s.slice(i, i + 2).toUpperCase();
    if (two === 'LB') {
      i += 2;
      let args = '';
      while (i < s.length && s[i] !== '\x03' && s[i] !== ';') {
        args += s[i];
        i += 1;
      }
      if (s[i] === '\x03' || s[i] === ';') i += 1;
      out.push({ cmd: 'LB', args });
      continue;
    }
    if (twoLetter.has(two) && !/[A-Za-z]/.test(s[i + 2] || '')) {
      i += 2;
      let args = '';
      while (i < s.length && s[i] !== ';' && s[i] !== '\n') {
        args += s[i];
        i += 1;
      }
      if (s[i] === ';' || s[i] === '\n') i += 1;
      out.push({ cmd: two, args: args.trim() });
      continue;
    }
    while (i < s.length && s[i] !== ';' && s[i] !== '\n') i += 1;
    if (s[i] === ';' || s[i] === '\n') i += 1;
  }
  return out;
}

function parseAsciiPlt(text: string, fileName: string): PlDataset {
  const dumpMatch = /PLT dump\s+(\S+)(?:\s+(\S+))?/i.exec(text);
  const plotterVer = dumpMatch?.[2] || (/HPGL\/?\s*2/i.test(text) ? 'HPGL/2' : 'HPGL');
  const name = prettyModelName(fileName, dumpMatch?.[1] || 'Plot');
  const pens: PlPen[] = [];
  const commands: PlCommand[] = [];
  const penByNumber = new Map<number, string>();
  const colors = new Map<string, string>();

  const penRe = /^\s*PEN\s+(\S+)(?:\s+(\d+))?/gim;
  let penMatch: RegExpExecArray | null;
  while ((penMatch = penRe.exec(text))) {
    const penName = penMatch[1];
    const color = penMatch[2] ? Number(penMatch[2]) : pens.length + 1;
    if (!pens.some((p) => p.name === penName)) {
      const pen = makePen(penName, color, true, 0, pens.length);
      pens.push(pen);
      colors.set(pen.name, pen.colorHex);
      penByNumber.set(color, pen.name);
    }
  }

  const dumpLineRe =
    /^\s*(LINE|CIRCLE|POLYLINE|TEXT|ARC)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/gim;
  let dumpMatchRow: RegExpExecArray | null;
  while ((dumpMatchRow = dumpLineRe.exec(text))) {
    const kind = dumpMatchRow[1].toLowerCase();
    const cmdName = dumpMatchRow[2];
    const penName = dumpMatchRow[3];
    const rest = (dumpMatchRow[4] || '').trim();
    if (!pens.some((p) => p.name === penName)) {
      const pen = makePen(penName, pens.length + 1, true, 0, pens.length);
      pens.push(pen);
      colors.set(pen.name, pen.colorHex);
    }
    if (kind === 'line') {
      const nums = parseCoordList(rest);
      commands.push(
        makeCommand(
          { name: cmdName, type: 'line', pen: penName, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3] },
          commands.length,
          penName,
          colors
        )
      );
    } else if (kind === 'circle') {
      const nums = parseCoordList(rest);
      commands.push(
        makeCommand({ name: cmdName, type: 'circle', pen: penName, x: nums[0], y: nums[1], r: nums[2] }, commands.length, penName, colors)
      );
    } else if (kind === 'arc') {
      const nums = parseCoordList(rest);
      commands.push(
        makeCommand(
          { name: cmdName, type: 'arc', pen: penName, x: nums[0], y: nums[1], x2: nums[2], y2: nums[3], r: nums[4] },
          commands.length,
          penName,
          colors
        )
      );
    } else if (kind === 'polyline') {
      const pts = pairsFromCoords(parseCoordList(rest));
      commands.push(makeCommand({ name: cmdName, type: 'polyline', pen: penName, points: pts }, commands.length, penName, colors));
    } else if (kind === 'text') {
      const nums = parseCoordList(rest);
      const label = rest.replace(/^[\d.\s,-]+/, '').trim() || cmdName;
      commands.push(
        makeCommand(
          { name: cmdName, type: 'text', pen: penName, x: nums[0], y: nums[1], text: label },
          commands.length,
          penName,
          colors
        )
      );
    }
  }

  let cx = 0;
  let cy = 0;
  let penDown = false;
  let currentPen = pens[0]?.name || 'PEN1';
  const tokens = tokenizeHpgl(text);
  for (const token of tokens) {
    const nums = parseCoordList(token.args);
    if (token.cmd === 'SP') {
      const n = Math.max(1, Math.round(nums[0] || 1));
      currentPen = penByNumber.get(n) || `PEN${n}`;
      if (!pens.some((p) => p.name === currentPen)) {
        const pen = makePen(currentPen, n, true, 0, pens.length);
        pens.push(pen);
        colors.set(pen.name, pen.colorHex);
        penByNumber.set(n, currentPen);
      }
      continue;
    }
    if (token.cmd === 'PU') {
      penDown = false;
      const pts = pairsFromCoords(nums);
      if (pts.length) {
        cx = pts[pts.length - 1].x;
        cy = pts[pts.length - 1].y;
      }
      continue;
    }
    if (token.cmd === 'PD') {
      const pts = pairsFromCoords(nums);
      if (!pts.length) {
        penDown = true;
        continue;
      }
      const chain = [{ x: cx, y: cy }, ...pts];
      if (chain.length >= 3) {
        commands.push(
          makeCommand(
            { name: `poly${commands.length + 1}`, type: 'polyline', pen: currentPen, points: chain },
            commands.length,
            currentPen,
            colors
          )
        );
      } else {
        commands.push(
          makeCommand(
            { name: `line${commands.length + 1}`, type: 'line', pen: currentPen, x: cx, y: cy, x2: pts[0].x, y2: pts[0].y },
            commands.length,
            currentPen,
            colors
          )
        );
      }
      cx = pts[pts.length - 1].x;
      cy = pts[pts.length - 1].y;
      penDown = true;
      continue;
    }
    if (token.cmd === 'PA' || token.cmd === 'PR') {
      const pts = pairsFromCoords(nums);
      if (!pts.length) continue;
      const abs = token.cmd === 'PA';
      for (const pt of pts) {
        const nx = abs ? pt.x : cx + pt.x;
        const ny = abs ? pt.y : cy + pt.y;
        if (penDown) {
          commands.push(
            makeCommand(
              { name: `line${commands.length + 1}`, type: 'line', pen: currentPen, x: cx, y: cy, x2: nx, y2: ny },
              commands.length,
              currentPen,
              colors
            )
          );
        }
        cx = nx;
        cy = ny;
      }
      continue;
    }
    if (token.cmd === 'CI') {
      const r = nums[0] || 0;
      commands.push(
        makeCommand({ name: `circle${commands.length + 1}`, type: 'circle', pen: currentPen, x: cx, y: cy, r }, commands.length, currentPen, colors)
      );
      continue;
    }
    if (token.cmd === 'AA' || token.cmd === 'AR') {
      const pts = pairsFromCoords(nums);
      const sweep = nums.length >= 3 ? nums[2] : 90;
      const target = pts[0] || { x: cx, y: cy };
      commands.push(
        makeCommand(
          { name: `arc${commands.length + 1}`, type: 'arc', pen: currentPen, x: cx, y: cy, x2: target.x, y2: target.y, r: sweep },
          commands.length,
          currentPen,
          colors
        )
      );
      continue;
    }
    if (token.cmd === 'LB') {
      commands.push(
        makeCommand(
          { name: token.args.trim() || `text${commands.length + 1}`, type: 'text', pen: currentPen, x: cx, y: cy, text: token.args.trim() },
          commands.length,
          currentPen,
          colors
        )
      );
    }
  }

  if (!pens.length && !commands.length) throw new Error('PLT contains no pens or commands');
  if (!pens.length) {
    const names = [...new Set(commands.map((c) => c.pen || 'PEN1'))];
    names.forEach((pn, idx) => pens.push(makePen(pn, 7 - (idx % 6), true, 0, idx)));
  }
  return finishDataset(name, 'plt', name, 'ASCII', plotterVer, 'm', pens, commands, []);
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

function parseCsvAsPl(text: string, fileName: string): PlDataset {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('PLT CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const pens: PlPen[] = [];
  const commands: PlCommand[] = [];
  const colors = new Map<string, string>();
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const type = (row.type || '').toLowerCase();
    if (type === 'pen' || type === 'layer') {
      const pen = makePen(row.name || row.pen || row.layer || `pen${pens.length + 1}`, asNumber(row.color, 7), true, 0, pens.length);
      pens.push(pen);
      colors.set(pen.name, pen.colorHex);
      return;
    }
    commands.push(
      makeCommand(
        {
          name: row.name,
          type: row.type,
          pen: row.pen || row.layer,
          x: row.x,
          y: row.y,
          x2: row.x2,
          y2: row.y2,
          r: row.r,
          text: row.text,
          color: row.color
        },
        index,
        row.pen || row.layer || 'PEN1',
        colors
      )
    );
  });
  const modelName = prettyModelName(fileName, 'Plot');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', 'HPGL/2', 'm', pens, commands, []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: PlSourceKind): PlDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'Plot')).trim();
  const keys: string[] = [];
  const pens: PlPen[] = [];
  const commands: PlCommand[] = [];
  const colors = new Map<string, string>();
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
      const type = (row.type || '').toLowerCase();
      if (type === 'pen' || type === 'layer') {
        const pen = makePen(row.name || row.pen || row.layer || `pen${pens.length + 1}`, 7, true, 0, pens.length);
        pens.push(pen);
        colors.set(pen.name, pen.colorHex);
        continue;
      }
      commands.push(
        makeCommand({ name: row.name, type: row.type, pen: row.pen || row.layer, text: row.text }, commands.length, row.pen || row.layer || 'PEN1', colors)
      );
    }
  }
  if (!pens.length && !commands.length) throw new Error('PLT markdown contains no pens or commands');
  return finishDataset(name, sourceKind, name, 'UTF-8', 'HPGL/2', 'm', pens, commands, []);
}

function isPl01(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === PL01[0] && bytes[1] === PL01[1] && bytes[2] === PL01[2] && bytes[3] === PL01[3];
}

export function buildSamplePlBytes(): Uint8Array {
  return te.encode(PL_ASCII_SAMPLE);
}

export function buildSamplePlJson(): string {
  return PL_JSON_SAMPLE;
}

export function parsePlText(text: string, fileName = ''): PlDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('PLT dump is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || (looksLikeJson(raw) && !looksLikePlt(raw))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid PLT JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'plt' || looksLikePlt(raw)) return parseAsciiPlt(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsPl(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a PLT dump');
}

export function parsePlBytes(bytes: Uint8Array, fileName = ''): PlDataset {
  if (!bytes.length) throw new Error('PLT dump is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed PLT files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (isPl01(bytes)) {
    const payload = td.decode(bytes.subarray(4));
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new Error('Invalid PL01 JSON payload');
    }
    return ingestJson(parsed, fileName, 'plt', ['Decoded PL01 plot dump']);
  }
  if (ext === 'plt' && !isMostlyText(bytes)) {
    throw new Error('Not an ASCII PLT file (binary plot is not expanded — export HPGL/JSON)');
  }
  return parsePlText(td.decode(bytes), fileName);
}

export function filterPlPens(pens: PlPen[], query: string): PlPen[] {
  const q = query.trim().toLowerCase();
  if (!q) return pens;
  const tokens = q.split(/\s+/).filter(Boolean);
  return pens.filter((p) =>
    tokens.every((token) => {
      if (token.startsWith('pen:') || token.startsWith('name:') || token.startsWith('layer:')) {
        return p.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('color:')) return `${p.color} ${p.colorHex}`.toLowerCase().includes(token.slice(6));
      if (token.startsWith('type:') || token.startsWith('cmd:') || token.startsWith('command:') || token.startsWith('ent:') || token.startsWith('row:')) {
        return true;
      }
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${p.name} ${p.colorHex}`.toLowerCase().includes(token);
    })
  );
}

export function filterPlCommands(commands: PlCommand[], query: string): PlCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const tokens = q.split(/\s+/).filter(Boolean);
  return commands.filter((c) =>
    tokens.every((token) => {
      if (token.startsWith('cmd:') || token.startsWith('command:') || token.startsWith('ent:') || token.startsWith('name:')) {
        return `${c.name} ${c.text}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      }
      if (token.startsWith('type:')) return c.type.toLowerCase().includes(token.slice(5));
      if (token.startsWith('pen:') || token.startsWith('layer:')) return c.pen.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('color:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${c.name} ${c.type} ${c.pen} ${c.text}`.toLowerCase().includes(token);
    })
  );
}

export function filterPlRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (
        token.startsWith('row:') ||
        token.startsWith('name:') ||
        token.startsWith('type:') ||
        token.startsWith('pen:') ||
        token.startsWith('layer:') ||
        token.startsWith('cmd:') ||
        token.startsWith('command:') ||
        token.startsWith('ent:')
      ) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('color:')) return true;
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
