import type {
  SimulationDataset,
  SimulationMetric,
  SimulationProbe,
  SimulationSourceKind
} from '../types/simulation-result-viewer.types';
import { minMaxVolume } from './volume-slice.utils';

const SIM_MAX_CELLS = 2_000_000;

function asNumber(value: unknown, fallback = NaN): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function flattenNumbers(value: unknown): number[] {
  const out: number[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const n = asNumber(node);
    if (Number.isFinite(n)) out.push(n);
  };
  walk(value);
  return out;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.filter((v) => Number.isFinite(v)))].sort((a, b) => a - b);
}

function finishDataset(
  partial: Omit<SimulationDataset, 'dataMin' | 'dataMax'> & { dataMin?: number; dataMax?: number }
): SimulationDataset {
  const concat = new Float32Array(partial.fields.reduce((sum, f) => sum + f.length, 0));
  let offset = 0;
  for (const field of partial.fields) {
    concat.set(field, offset);
    offset += field.length;
  }
  const stats = concat.length ? minMaxVolume(concat) : { min: 0, max: 1 };
  return {
    ...partial,
    nt: partial.times.length,
    dataMin: Number.isFinite(stats.min) ? stats.min : 0,
    dataMax: Number.isFinite(stats.max) ? stats.max : 1
  };
}

export function extractSimField(dataset: SimulationDataset, timeIndex: number): Float32Array {
  const t = Math.max(0, Math.min(dataset.nt - 1, timeIndex));
  return dataset.fields[t] ?? new Float32Array(0);
}

export function extractSimSlice(
  dataset: SimulationDataset,
  timeIndex: number,
  axis: 'i' | 'j',
  index: number
): Float32Array {
  const field = extractSimField(dataset, timeIndex);
  const { nx, ny } = dataset;
  if (axis === 'j') {
    const j = Math.max(0, Math.min(ny - 1, index));
    return field.slice(j * nx, j * nx + nx);
  }
  const i = Math.max(0, Math.min(nx - 1, index));
  const col = new Float32Array(ny);
  for (let j = 0; j < ny; j++) col[j] = field[j * nx + i];
  return col;
}

function parseProbes(raw: unknown, nt: number, warnings: string[]): SimulationProbe[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const values = Array.isArray(rec['values']) ? rec['values'].map((v) => asNumber(v, NaN)) : [];
    if (values.length && values.length !== nt) warnings.push(`Probe ${asString(rec['id'] || rec['name'], String(index))} length ≠ ${nt} times`);
    const aligned = new Array(nt).fill(NaN);
    values.forEach((v, i) => {
      if (i < nt) aligned[i] = v;
    });
    return {
      id: asString(rec['id'], `p-${index + 1}`),
      name: asString(rec['name'], asString(rec['id'], `Probe ${index + 1}`)),
      i: Math.max(0, Math.round(asNumber(rec['i'] ?? rec['x'], 0))),
      j: Math.max(0, Math.round(asNumber(rec['j'] ?? rec['y'], 0))),
      values: aligned
    };
  });
}

function parseMetrics(raw: unknown, nt: number): SimulationMetric[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const values = Array.isArray(rec['values']) ? rec['values'].map((v) => asNumber(v, NaN)) : [];
    const aligned = new Array(nt).fill(NaN);
    values.forEach((v, i) => {
      if (i < nt) aligned[i] = v;
    });
    return { name: asString(rec['name'], `metric-${index + 1}`), values: aligned };
  });
}

function parseJsonSimulation(text: string): SimulationDataset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid simulation JSON');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Simulation JSON must be an object');
  const rec = data as Record<string, unknown>;
  const nx = Math.max(1, Math.round(asNumber(rec['nx'], 0)));
  const ny = Math.max(1, Math.round(asNumber(rec['ny'], 0)));
  const timesRaw = rec['times'] ?? rec['time'];
  const times = Array.isArray(timesRaw) ? timesRaw.map((t) => asNumber(t, 0)) : [0];
  const warnings: string[] = [];
  const expected = nx * ny;
  if (expected > SIM_MAX_CELLS) throw new Error('Simulation grid is too large for in-browser preview');
  const fieldsRaw = rec['fields'] ?? rec['data'] ?? rec['values'];
  const fields: Float32Array[] = [];
  if (Array.isArray(fieldsRaw)) {
    if (fieldsRaw.length && typeof fieldsRaw[0] === 'number') {
      const flat = flattenNumbers(fieldsRaw);
      const nt = times.length || Math.max(1, Math.floor(flat.length / expected));
      for (let t = 0; t < nt; t++) {
        const slice = new Float32Array(expected);
        slice.set(flat.slice(t * expected, t * expected + expected));
        fields.push(slice);
      }
      if (times.length !== fields.length) {
        times.length = 0;
        for (let t = 0; t < fields.length; t++) times.push(t);
      }
    } else {
      for (const item of fieldsRaw) {
        const flat = flattenNumbers(item);
        const slice = new Float32Array(expected);
        slice.fill(NaN);
        slice.set(flat.slice(0, expected));
        fields.push(slice);
      }
    }
  }
  if (!fields.length) throw new Error('Simulation JSON is missing fields');
  while (times.length < fields.length) times.push(times.length);
  const nt = fields.length;
  return finishDataset({
    name: asString(rec['name'] ?? rec['title'], 'Simulation result'),
    sourceKind: 'json',
    solver: asString(rec['solver'], ''),
    fieldName: asString(rec['fieldName'] ?? rec['field'] ?? rec['variable'], 'field'),
    unit: asString(rec['unit'] ?? rec['units'], ''),
    nx,
    ny,
    nt,
    dx: asNumber(rec['dx'], 1) || 1,
    dy: asNumber(rec['dy'], 1) || 1,
    times: times.slice(0, nt),
    fields,
    probes: parseProbes(rec['probes'], nt, warnings),
    metrics: parseMetrics(rec['metrics'], nt),
    warnings
  });
}

function parseCsvSimulation(text: string): SimulationDataset {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(',').map((cell) => cell.trim()));
  if (rows.length < 2) throw new Error('Simulation CSV needs a header and at least one row');
  const header = rows[0].map((h) => h.toLowerCase());
  const tIdx = header.indexOf('t') >= 0 ? header.indexOf('t') : header.indexOf('time');
  const iIdx = header.indexOf('i') >= 0 ? header.indexOf('i') : header.indexOf('x');
  const jIdx = header.indexOf('j') >= 0 ? header.indexOf('j') : header.indexOf('y');
  const vIdx = header.indexOf('value') >= 0 ? header.indexOf('value') : header.indexOf('u') >= 0 ? header.indexOf('u') : header.length - 1;
  if (tIdx < 0 || iIdx < 0 || jIdx < 0 || vIdx < 0) throw new Error('Simulation CSV needs t,i,j,value (or time,x,y,value) columns');
  const records = rows.slice(1).map((row) => ({
    t: asNumber(row[tIdx], 0),
    i: Math.round(asNumber(row[iIdx], 0)),
    j: Math.round(asNumber(row[jIdx], 0)),
    value: asNumber(row[vIdx])
  }));
  const times = uniqueSorted(records.map((r) => r.t));
  const isIndex = header.includes('i') || header.includes('j');
  let nx: number;
  let ny: number;
  let iOf: (v: number) => number;
  let jOf: (v: number) => number;
  if (isIndex) {
    nx = Math.max(...records.map((r) => r.i), 0) + 1;
    ny = Math.max(...records.map((r) => r.j), 0) + 1;
    iOf = (v) => v;
    jOf = (v) => v;
  } else {
    const xs = uniqueSorted(records.map((r) => r.i));
    const ys = uniqueSorted(records.map((r) => r.j));
    nx = xs.length;
    ny = ys.length;
    iOf = (v) => xs.indexOf(v);
    jOf = (v) => ys.indexOf(v);
  }
  if (!nx || !ny || !times.length) throw new Error('Simulation CSV did not yield a grid');
  const fields = times.map(() => {
    const field = new Float32Array(nx * ny);
    field.fill(NaN);
    return field;
  });
  for (const rec of records) {
    const t = times.indexOf(rec.t);
    const i = iOf(rec.i);
    const j = jOf(rec.j);
    if (t < 0 || i < 0 || j < 0 || !Number.isFinite(rec.value)) continue;
    fields[t][j * nx + i] = rec.value;
  }
  return finishDataset({
    name: 'Simulation grid',
    sourceKind: 'csv',
    solver: '',
    fieldName: header[vIdx] || 'value',
    unit: '',
    nx,
    ny,
    nt: times.length,
    dx: 1,
    dy: 1,
    times,
    fields,
    probes: [],
    metrics: [],
    warnings: []
  });
}

function parseVtkSimulation(text: string): SimulationDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  if (!/vtk datafile/i.test(text)) throw new Error('Not a VTK ASCII data file');
  if (!/ASCII/i.test(text)) throw new Error('Only ASCII VTK structured points are supported');
  if (!/DATASET\s+STRUCTURED_POINTS/i.test(text)) throw new Error('Only VTK STRUCTURED_POINTS datasets are supported');
  let nx = 0;
  let ny = 0;
  let nz = 1;
  let dx = 1;
  let dy = 1;
  let dz = 1;
  let fieldName = 'field';
  const scalars: number[] = [];
  let readingScalars = false;
  for (const line of lines) {
    const dim = /^DIMENSIONS\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(line);
    if (dim) {
      nx = Math.round(Number(dim[1]));
      ny = Math.round(Number(dim[2]));
      nz = Math.round(Number(dim[3])) || 1;
      continue;
    }
    const sp = /^SPACING\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/i.exec(line);
    if (sp) {
      dx = Number(sp[1]) || 1;
      dy = Number(sp[2]) || 1;
      dz = Number(sp[3]) || 1;
      continue;
    }
    const sc = /^SCALARS\s+(\S+)/i.exec(line);
    if (sc) {
      fieldName = sc[1];
      continue;
    }
    if (/^LOOKUP_TABLE/i.test(line) || /^POINT_DATA/i.test(line)) {
      readingScalars = /^LOOKUP_TABLE/i.test(line) || readingScalars;
      if (/^LOOKUP_TABLE/i.test(line)) readingScalars = true;
      continue;
    }
    if (readingScalars) {
      for (const part of line.split(/\s+/)) {
        const n = asNumber(part);
        if (Number.isFinite(n)) scalars.push(n);
      }
    }
  }
  if (!nx || !ny) throw new Error('VTK file is missing DIMENSIONS');
  const count = nx * ny;
  const nt = Math.max(1, nz);
  if (count * nt > SIM_MAX_CELLS) throw new Error('VTK grid is too large for in-browser preview');
  const fields: Float32Array[] = [];
  for (let t = 0; t < nt; t++) {
    const slice = new Float32Array(count);
    slice.fill(NaN);
    slice.set(scalars.slice(t * count, t * count + count));
    fields.push(slice);
  }
  const title = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !/^vtk datafile/i.test(l))[0] || 'VTK field';
  return finishDataset({
    name: title.replace(/^ASCII$/i, 'VTK field'),
    sourceKind: 'vtk',
    solver: '',
    fieldName,
    unit: '',
    nx,
    ny,
    nt,
    dx,
    dy,
    times: Array.from({ length: nt }, (_, i) => i * dz),
    fields,
    probes: [],
    metrics: [],
    warnings: nz > 1 ? ['VTK Z dimension is treated as time.'] : []
  });
}

function parseSimText(text: string): SimulationDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let name = 'Simulation result';
  let solver = '';
  let fieldName = 'field';
  let unit = '';
  let nx = 0;
  let ny = 0;
  let dx = 1;
  let dy = 1;
  let times: number[] = [];
  const fields: Float32Array[] = [];
  const probes: SimulationProbe[] = [];
  const metrics: SimulationMetric[] = [];
  let currentField: number[] | null = null;
  for (const line of lines) {
    if (line.startsWith('# SIMULATION')) {
      name = line.replace(/^#\s*SIMULATION\s*/i, '').trim() || name;
      continue;
    }
    if (line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const key = parts[0]?.toUpperCase();
    if (key === 'SOLVER') {
      solver = parts.slice(1).join(' ');
      continue;
    }
    if (key === 'FIELD' && parts.length >= 2 && !/^FIELD_T$/i.test(key)) {
      fieldName = parts[1];
      unit = parts[2] || '';
      continue;
    }
    if (key === 'GRID' && parts.length >= 3) {
      nx = Math.round(asNumber(parts[1], 0));
      ny = Math.round(asNumber(parts[2], 0));
      continue;
    }
    if (key === 'SPACING' && parts.length >= 3) {
      dx = asNumber(parts[1], 1) || 1;
      dy = asNumber(parts[2], 1) || 1;
      continue;
    }
    if (key === 'TIMES') {
      times = parts.slice(1).map((v) => asNumber(v, 0));
      continue;
    }
    if (key === 'FIELD_T') {
      if (currentField && nx && ny) {
        const slice = new Float32Array(nx * ny);
        slice.fill(NaN);
        slice.set(currentField.slice(0, nx * ny));
        fields.push(slice);
      }
      currentField = [];
      const t = asNumber(parts[1], fields.length);
      if (!times.includes(t)) times.push(t);
      continue;
    }
    if (key === 'PROBE' && parts.length >= 4) {
      probes.push({
        id: parts[1],
        name: parts[1],
        i: Math.round(asNumber(parts[2], 0)),
        j: Math.round(asNumber(parts[3], 0)),
        values: parts.slice(4).map((v) => asNumber(v, NaN))
      });
      continue;
    }
    if (key === 'METRIC' && parts.length >= 2) {
      metrics.push({ name: parts[1], values: parts.slice(2).map((v) => asNumber(v, NaN)) });
      continue;
    }
    if (currentField) {
      for (const part of parts) {
        const n = asNumber(part);
        if (Number.isFinite(n)) currentField.push(n);
      }
    }
  }
  if (currentField && nx && ny) {
    const slice = new Float32Array(nx * ny);
    slice.fill(NaN);
    slice.set(currentField.slice(0, nx * ny));
    fields.push(slice);
  }
  if (!nx || !ny || !fields.length) throw new Error('.sim file is missing GRID / FIELD_T data');
  while (times.length < fields.length) times.push(times.length);
  const nt = fields.length;
  probes.forEach((probe) => {
    const aligned = new Array(nt).fill(NaN);
    probe.values.forEach((v, i) => {
      if (i < nt) aligned[i] = v;
    });
    probe.values = aligned;
  });
  metrics.forEach((metric) => {
    const aligned = new Array(nt).fill(NaN);
    metric.values.forEach((v, i) => {
      if (i < nt) aligned[i] = v;
    });
    metric.values = aligned;
  });
  return finishDataset({
    name,
    sourceKind: 'sim',
    solver,
    fieldName,
    unit,
    nx,
    ny,
    nt,
    dx,
    dy,
    times: times.slice(0, nt),
    fields,
    probes,
    metrics,
    warnings: []
  });
}

export function parseSimulationText(text: string, sourceHint: SimulationSourceKind = 'json'): SimulationDataset {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Simulation file is empty');
  if (/^#\s*vtk/i.test(trimmed) || sourceHint === 'vtk') return parseVtkSimulation(trimmed);
  if (trimmed.startsWith('{')) return parseJsonSimulation(trimmed);
  if (/^#\s*SIMULATION/i.test(trimmed) || sourceHint === 'sim') return parseSimText(trimmed);
  if (trimmed.includes(',') || sourceHint === 'csv') return parseCsvSimulation(trimmed);
  throw new Error('Unrecognized simulation format — use JSON, CSV, VTK ASCII, or .sim');
}

export function parseSimulationBytes(bytes: Uint8Array, fileName: string): SimulationDataset {
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  const ext = /\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '';
  const hint: SimulationSourceKind =
    ext === 'csv' ? 'csv' : ext === 'vtk' ? 'vtk' : ext === 'sim' || ext === 'fld' ? 'sim' : 'json';
  return parseSimulationText(text, hint);
}
