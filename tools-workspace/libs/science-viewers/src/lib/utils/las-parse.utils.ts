import { LAS_MAX_ROWS } from '../constants/las-well-log-viewer.constants';
import type { LasHeaderRow, ParsedLas } from '../types/las-well-log-viewer.types';
import { isDepthCurve, summarizeCurve } from './well-log-render.utils';

function parseLasLine(line: string): LasHeaderRow | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const match = trimmed.match(/^([A-Za-z0-9_]+)\s*\.([^\s:]*)\s+(.*?)\s*:\s*(.*)$/);
  if (match) {
    return {
      mnemonic: match[1].trim(),
      unit: match[2].trim(),
      value: match[3].trim(),
      description: match[4].trim()
    };
  }
  const loose = trimmed.match(/^([A-Za-z0-9_]+)\s*\.?\s*(.*?)\s*:\s*(.*)$/);
  if (!loose) return null;
  return { mnemonic: loose[1].trim(), unit: '', value: loose[2].trim(), description: loose[3].trim() };
}

function headerValue(rows: LasHeaderRow[], mnem: string): string {
  const hit = rows.find((r) => r.mnemonic.toUpperCase() === mnem.toUpperCase());
  return hit?.value ?? '';
}

export function parseLasText(text: string): ParsedLas {
  const warnings: string[] = [];
  const raw = text.replace(/^\uFEFF/, '').replace(/\r/g, '');
  if (!raw.trim()) throw new Error('File is empty');
  if (!/^\s*~V/im.test(raw) && !/^\s*~W/im.test(raw) && !/^\s*~A/im.test(raw)) {
    throw new Error('No LAS section headers found — expected ~V / ~W / ~A.');
  }

  const lines = raw.split('\n');
  let section = '';
  const versionRows: LasHeaderRow[] = [];
  const well: LasHeaderRow[] = [];
  const curvesMeta: LasHeaderRow[] = [];
  const parameters: LasHeaderRow[] = [];
  const otherLines: string[] = [];
  const asciiLines: string[] = [];

  for (const line of lines) {
    const marker = line.trim();
    if (marker.startsWith('~')) {
      const letter = marker.charAt(1).toUpperCase();
      if (letter === 'V') section = 'V';
      else if (letter === 'W') section = 'W';
      else if (letter === 'C') section = 'C';
      else if (letter === 'P') section = 'P';
      else if (letter === 'O') section = 'O';
      else if (letter === 'A') section = 'A';
      else section = letter;
      continue;
    }
    if (section === 'A') {
      if (marker && !marker.startsWith('#')) asciiLines.push(marker);
      continue;
    }
    if (section === 'O') {
      if (marker && !marker.startsWith('#')) otherLines.push(marker);
      continue;
    }
    const row = parseLasLine(line);
    if (!row) continue;
    if (section === 'V') versionRows.push(row);
    else if (section === 'W') well.push(row);
    else if (section === 'C') curvesMeta.push(row);
    else if (section === 'P') parameters.push(row);
  }

  if (!curvesMeta.length) throw new Error('No ~CURVE information found in LAS file.');
  if (!asciiLines.length) throw new Error('No ~ASCII depth data found in LAS file.');

  const wrap = headerValue(versionRows, 'WRAP').toUpperCase().startsWith('Y');
  const version = headerValue(versionRows, 'VERS') || '2.0';
  const nullValue = Number(headerValue(well, 'NULL')) || -999.25;
  const startDepth = Number(headerValue(well, 'STRT'));
  const stopDepth = Number(headerValue(well, 'STOP'));
  const step = Number(headerValue(well, 'STEP'));
  const depthUnit = well.find((r) => r.mnemonic.toUpperCase() === 'STRT')?.unit || curvesMeta[0]?.unit || '';

  if (wrap) warnings.push('WRAP=YES — rows were flattened from whitespace-separated values.');

  const numbers: number[] = [];
  for (const line of asciiLines) {
    if (/^[A-Za-z]/.test(line) && /DEPT|DEPTH|GR|RHOB/i.test(line) && !/[-+]?\d/.test(line.slice(0, 4))) {
      continue;
    }
    const parts = line.trim().split(/\s+/);
    for (const p of parts) {
      const n = Number(p);
      if (Number.isFinite(n)) numbers.push(n);
    }
  }

  const width = curvesMeta.length;
  if (width < 1) throw new Error('LAS curve list is empty.');
  const rowCount = Math.floor(numbers.length / width);
  if (!rowCount) throw new Error('ASCII section did not contain a full data row.');
  if (numbers.length % width !== 0) {
    warnings.push(`Trailing ${numbers.length % width} value(s) after the last complete row were ignored.`);
  }
  let usedRows = rowCount;
  if (usedRows > LAS_MAX_ROWS) {
    usedRows = LAS_MAX_ROWS;
    warnings.push(`Only the first ${LAS_MAX_ROWS} depth rows are previewed.`);
  }

  const columns: number[][] = Array.from({ length: width }, () => []);
  for (let r = 0; r < usedRows; r++) {
    for (let c = 0; c < width; c++) {
      const v = numbers[r * width + c];
      columns[c].push(v === nullValue || v === -999.25 || v === -9999 ? Number.NaN : v);
    }
  }

  const depthIndex = curvesMeta.findIndex((c) => isDepthCurve(c.mnemonic));
  const depthCol = depthIndex >= 0 ? depthIndex : 0;
  const depth = columns[depthCol];
  const curves = curvesMeta
    .map((meta, i) => summarizeCurve(meta.mnemonic, meta.unit, meta.description, columns[i]))
    .filter((_, i) => i !== depthCol);

  if (!depth.length) throw new Error('No depth samples could be parsed.');
  if (Number.isFinite(startDepth) && Math.abs(depth[0] - startDepth) > Math.abs(step || 1) * 2) {
    warnings.push(`First ASCII depth ${depth[0]} differs from STRT ${startDepth}.`);
  }

  return {
    version,
    wrap,
    nullValue,
    startDepth: Number.isFinite(startDepth) ? startDepth : depth[0],
    stopDepth: Number.isFinite(stopDepth) ? stopDepth : depth[depth.length - 1],
    step: Number.isFinite(step) ? step : null,
    depthUnit,
    well,
    parameters,
    other: otherLines.join('\n'),
    depth,
    curves,
    warnings
  };
}
