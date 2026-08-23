import type {
  MfArtifact,
  MfColumn,
  MfDataset,
  MfFileRole,
  MfSigKind,
  MfSignature,
  MfSourceKind
} from '../types/mlflow-model-viewer.types';
import { MF_CONDA_SAMPLE, MF_JSON_SAMPLE, MF_MLMODEL_SAMPLE } from '../constants/mlflow-model-viewer-sample.data';
import { isGzipMagic, isMostlyText } from './ml-file.utils';

const te = new TextEncoder();
const td = new TextDecoder('utf-8');
const ML_MAGIC = new Uint8Array([0x4d, 0x4c, 0x30, 0x31]); // ML01

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

function looksLikeMlmodel(text: string): boolean {
  return /^\s*(artifact_path|mlflow_version|flavors|signature)\s*:/m.test(text);
}

function dimValue(value: unknown): number {
  if (value == null || value === '' || value === 'null' || value === 'None' || value === '?') return -1;
  const n = Number(value);
  return Number.isFinite(n) ? n : -1;
}

function asNumberList(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(dimValue);
  if (typeof value === 'string') {
    return value
      .split(/[x×,]/i)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map(dimValue);
  }
  return [];
}

function shapeLabel(shape: number[]): string {
  if (!shape.length) return '—';
  return `[${shape.map((n) => (n < 0 ? 'null' : String(n))).join(', ')}]`;
}

function sigKind(raw: unknown, fallback: MfSigKind): MfSigKind {
  const v = asString(raw, fallback).toLowerCase();
  if (v === 'input' || v === 'inputs') return 'input';
  if (v === 'output' || v === 'outputs') return 'output';
  if (v === 'param' || v === 'parameter') return 'param';
  return fallback;
}

function fileRole(raw: unknown, name: string): MfFileRole {
  const v = asString(raw).toLowerCase();
  if (v === 'manifest' || v === 'model' || v === 'env' || v === 'signature' || v === 'other') return v;
  const n = name.toLowerCase();
  if (/(^|\/)mlmodel$/.test(n)) return 'manifest';
  if (/(conda|python_env|requirements).*\.(ya?ml|txt)$/.test(n)) return 'env';
  if (/\.(keras|h5|hdf5|onnx|pkl|pt|pth|bin|joblib)$/i.test(n) || /(^|\/)data\//.test(n)) return 'model';
  if (/signature/i.test(n)) return 'signature';
  return 'other';
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

function writeU32le(value: number, out: number[]): void {
  out.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isMlMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === ML_MAGIC[0] && bytes[1] === ML_MAGIC[1] && bytes[2] === ML_MAGIC[2] && bytes[3] === ML_MAGIC[3];
}

function listZipStoreEntries(bytes: Uint8Array): Array<{ name: string; data: Uint8Array }> {
  const out: Array<{ name: string; data: Uint8Array }> = [];
  let offset = 0;
  while (offset + 30 <= bytes.length && bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {
    const method = bytes[offset + 8] | (bytes[offset + 9] << 8);
    const compSize = u32le(bytes, offset + 18);
    const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
    const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);
    const nameStart = offset + 30;
    const name = td.decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    if (method === 0) out.push({ name, data: bytes.subarray(dataStart, dataStart + compSize) });
    offset = dataStart + compSize;
  }
  return out;
}

function writeZipStore(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const locals: number[] = [];
  const centrals: number[] = [];
  for (const entry of entries) {
    const nameBytes = te.encode(entry.name);
    const localOffset = locals.length;
    locals.push(0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    writeU32le(0, locals);
    writeU32le(entry.data.length, locals);
    writeU32le(entry.data.length, locals);
    locals.push(nameBytes.length & 0xff, (nameBytes.length >> 8) & 0xff, 0, 0);
    locals.push(...nameBytes, ...entry.data);
    centrals.push(0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    writeU32le(0, centrals);
    writeU32le(entry.data.length, centrals);
    writeU32le(entry.data.length, centrals);
    centrals.push(nameBytes.length & 0xff, (nameBytes.length >> 8) & 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    writeU32le(localOffset, centrals);
    centrals.push(...nameBytes);
  }
  const cdOffset = locals.length;
  const out = [...locals, ...centrals, 0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0];
  const count = entries.length;
  out.push(count & 0xff, (count >> 8) & 0xff, count & 0xff, (count >> 8) & 0xff);
  writeU32le(centrals.length, out);
  writeU32le(cdOffset, out);
  out.push(0, 0);
  return new Uint8Array(out);
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || fallback;
  if (/^shop[-_]?ranker$/i.test(fromFile) || /^shop[-_]?ranker$/i.test(fallback)) return 'ShopRanker';
  return fromFile;
}

function unquote(value: string): string {
  const t = value.trim();
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) return t.slice(1, -1);
  return t;
}

function parseMlmodelYaml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const flavors: Record<string, Record<string, string>> = {};
  const signature: Record<string, string> = {};
  let section: 'root' | 'flavors' | 'signature' = 'root';
  let currentFlavor = '';
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const indent = (/^ */.exec(raw)?.[0].length ?? 0);
    const line = raw.trim();
    if (indent === 0 && /^[\w.-]+\s*:/.test(line)) {
      const colon = line.indexOf(':');
      const key = line.slice(0, colon).trim();
      const val = unquote(line.slice(colon + 1));
      if (key === 'flavors') {
        section = 'flavors';
        currentFlavor = '';
        continue;
      }
      if (key === 'signature') {
        section = 'signature';
        continue;
      }
      section = 'root';
      out[key] = val;
      continue;
    }
    if (section === 'flavors') {
      if (indent === 2 && /^[\w.-]+\s*:\s*$/.test(line)) {
        currentFlavor = line.replace(/:\s*$/, '');
        flavors[currentFlavor] = {};
        continue;
      }
      if (currentFlavor && indent >= 4) {
        const colon = line.indexOf(':');
        if (colon > 0) flavors[currentFlavor][line.slice(0, colon).trim()] = unquote(line.slice(colon + 1));
      }
      continue;
    }
    if (section === 'signature' && indent >= 2) {
      const colon = line.indexOf(':');
      if (colon > 0) signature[line.slice(0, colon).trim()] = unquote(line.slice(colon + 1));
    }
  }
  if (Object.keys(flavors).length) out.flavors = flavors;
  if (Object.keys(signature).length) out.signature = signature;
  return out;
}

function parseSignatureList(raw: unknown, kind: MfSigKind): MfSignature[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  }
  return list.map((item, index) => {
    const n = rec(item);
    const spec = rec(n['tensor-spec'] || n.tensorSpec || n.tensor_spec);
    const name = asString(n.name || n.key, kind === 'input' ? `input${index + 1}` : `output${index + 1}`);
    const shape = asNumberList(n.shape || spec.shape || n.dims);
    return {
      id: `${kind}:${name}`,
      index,
      name,
      kind,
      type: asString(n.type || spec.type, 'tensor'),
      dtype: asString(n.dtype || spec.dtype, 'float32').toLowerCase(),
      shape,
      shapeLabel: shapeLabel(shape)
    };
  });
}

function pickFlavor(flavors: Record<string, unknown>): string {
  const keys = Object.keys(flavors);
  const preferred = keys.find((k) => /^(keras|tensorflow|pytorch|onnx|sklearn|xgboost)$/i.test(k));
  return preferred || keys.find((k) => k !== 'python_function') || keys[0] || '—';
}

function finishDataset(
  name: string,
  sourceKind: MfSourceKind,
  title: string,
  encoding: string,
  meta: { mlflowVersion?: string; flavor?: string; utcCreated?: string; artifactPath?: string },
  signatures: MfSignature[],
  files: MfArtifact[],
  warnings: string[]
): MfDataset {
  if (!signatures.length && !files.length) throw new Error('MLflow model contains no signature or files');
  signatures.forEach((s, i) => (s.index = i));
  files.forEach((f, i) => (f.index = i));
  const columns: MfColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'kind', index: 1, name: 'kind', type: 'STRING' },
    { id: 'type', index: 2, name: 'type', type: 'STRING' },
    { id: 'dtype', index: 3, name: 'dtype', type: 'STRING' },
    { id: 'shape', index: 4, name: 'shape', type: 'STRING' }
  ];
  const rows = signatures.map((s) => ({
    name: s.name,
    kind: s.kind,
    type: s.type,
    dtype: s.dtype,
    shape: s.shapeLabel
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    mlflowVersion: meta.mlflowVersion || '—',
    flavor: meta.flavor || '—',
    utcCreated: meta.utcCreated || '—',
    artifactPath: meta.artifactPath || '—',
    signatureCount: signatures.length,
    fileCount: files.length,
    signatures,
    files,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string, sourceKind: MfSourceKind = 'json', warnings: string[] = []): MfDataset {
  const root = rec(raw);
  const name = asString(root.name || root.title || root.artifactPath || root.artifact_path, prettyModelName(fileName, 'MLflow model'));
  const flavors = rec(root.flavors);
  const sigRoot = rec(root.signature);
  const inputs = parseSignatureList(root.inputs || sigRoot.inputs, 'input');
  const outputs = parseSignatureList(root.outputs || sigRoot.outputs, 'output');
  const signatures = [...inputs, ...outputs].map((s, index) => ({ ...s, index }));
  const fileSrc = (Array.isArray(root.files) ? root.files : Array.isArray(root.artifacts) ? root.artifacts : []) as unknown[];
  const files: MfArtifact[] = fileSrc.map((item, index) => {
    const n = rec(item);
    const fName = asString(n.name || n.path, `file${index + 1}`);
    const path = asString(n.path, fName);
    return {
      id: path || fName,
      index,
      name: fName.split('/').pop() || fName,
      path,
      role: fileRole(n.role, path || fName),
      flavor: asString(n.flavor, '—'),
      sizeLabel: asString(n.sizeLabel || n.size, '—')
    };
  });
  return finishDataset(
    name,
    sourceKind,
    asString(root.title, name),
    sourceKind === 'zip' || sourceKind === 'mlmodel' ? (sourceKind === 'zip' ? 'binary' : 'UTF-8') : 'UTF-8',
    {
      mlflowVersion: asString(root.mlflowVersion || root.mlflow_version),
      flavor: asString(root.flavor, pickFlavor(flavors)),
      utcCreated: asString(root.utcCreated || root.utc_time_created),
      artifactPath: asString(root.artifactPath || root.artifact_path)
    },
    signatures,
    files,
    warnings
  );
}

function ingestMlmodelText(text: string, fileName: string, sourceKind: MfSourceKind, extraFiles: MfArtifact[] = [], warnings: string[] = []): MfDataset {
  const parsed = parseMlmodelYaml(text);
  const flavors = rec(parsed.flavors);
  const sig = rec(parsed.signature);
  const name = prettyModelName(fileName, asString(parsed.artifact_path, 'MLflow model'));
  const inputs = parseSignatureList(sig.inputs, 'input');
  const outputs = parseSignatureList(sig.outputs, 'output');
  const signatures = [...inputs, ...outputs];
  const files = extraFiles.length
    ? extraFiles
    : [{ id: 'MLmodel', index: 0, name: 'MLmodel', path: 'MLmodel', role: 'manifest' as const, flavor: pickFlavor(flavors), sizeLabel: '—' }];
  if (!files.some((f) => f.role === 'manifest')) {
    files.unshift({ id: 'MLmodel', index: 0, name: 'MLmodel', path: 'MLmodel', role: 'manifest', flavor: pickFlavor(flavors), sizeLabel: '—' });
  }
  return finishDataset(
    name,
    sourceKind,
    name,
    sourceKind === 'zip' ? 'binary' : 'UTF-8',
    {
      mlflowVersion: asString(parsed.mlflow_version),
      flavor: pickFlavor(flavors),
      utcCreated: asString(parsed.utc_time_created),
      artifactPath: asString(parsed.artifact_path)
    },
    signatures,
    files,
    warnings
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

function parseCsvAsMf(text: string, fileName: string): MfDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('MLflow CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  const signatures: MfSignature[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const name = row.name || `col${index + 1}`;
    const shape = asNumberList(row.shape);
    signatures.push({
      id: `${row.kind || 'input'}:${name}`,
      index,
      name,
      kind: sigKind(row.kind, 'input'),
      type: row.type || 'tensor',
      dtype: (row.dtype || 'float32').toLowerCase(),
      shape,
      shapeLabel: shapeLabel(shape)
    });
  });
  const modelName = prettyModelName(fileName, 'MLflow model');
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', {}, signatures, [], []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: MfSourceKind): MfDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || prettyModelName(fileName, 'MLflow model')).trim();
  const keys: string[] = [];
  const signatures: MfSignature[] = [];
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
      const sigName = row.name || `col${signatures.length + 1}`;
      const shape = asNumberList(row.shape);
      signatures.push({
        id: `${row.kind || 'input'}:${sigName}`,
        index: signatures.length,
        name: sigName,
        kind: sigKind(row.kind, 'input'),
        type: row.type || 'tensor',
        dtype: (row.dtype || 'float32').toLowerCase(),
        shape,
        shapeLabel: shapeLabel(shape)
      });
    }
  }
  if (!signatures.length) throw new Error('MLflow markdown contains no signature rows');
  return finishDataset(name, sourceKind, name, 'UTF-8', {}, signatures, [], []);
}

function parseMl01(bytes: Uint8Array, fileName: string): MfDataset {
  if (bytes.length < 8) throw new Error('MLflow header is truncated');
  const len = u32le(bytes, 4);
  const jsonBytes = bytes.subarray(8, 8 + len);
  if (jsonBytes.length < len) throw new Error('MLflow JSON payload is truncated');
  let parsed: unknown;
  try {
    parsed = JSON.parse(td.decode(jsonBytes));
  } catch {
    throw new Error('Invalid MLflow ML01 JSON');
  }
  return ingestJson(parsed, fileName, 'mlmodel');
}

function parseMlflowZip(bytes: Uint8Array, fileName: string): MfDataset {
  const warnings = ['ZIP artifacts listed without running MLflow loaders'];
  const entries = listZipStoreEntries(bytes);
  if (!entries.length) warnings.push('No uncompressed ZIP entries found (deflate archives are not expanded)');
  const mlmodel = entries.find((e) => /(^|\/)MLmodel$/i.test(e.name));
  const files: MfArtifact[] = entries.map((e, index) => ({
    id: e.name,
    index,
    name: e.name.split('/').pop() || e.name,
    path: e.name,
    role: fileRole('', e.name),
    flavor: '—',
    sizeLabel: `${e.data.length} B`
  }));
  if (mlmodel) {
    const parsed = ingestMlmodelText(td.decode(mlmodel.data), fileName, 'zip', files, warnings);
    const flavor = parsed.flavor;
    parsed.files.forEach((f) => {
      if (f.flavor === '—') f.flavor = flavor;
    });
    if (entries.some((e) => /\.pkl$/i.test(e.name))) warnings.push('Pickle artifacts are present but not executed');
    return parsed;
  }
  const jsonEntry = entries.find((e) => /model\.json$|mlflow\.json$/i.test(e.name));
  if (jsonEntry) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(td.decode(jsonEntry.data));
    } catch {
      throw new Error('Invalid model.json inside MLflow ZIP');
    }
    return ingestJson(parsed, fileName, 'zip', warnings);
  }
  throw new Error('MLflow ZIP has no MLmodel manifest');
}

export function buildSampleMfBytes(): Uint8Array {
  return writeZipStore([
    { name: 'MLmodel', data: te.encode(MF_MLMODEL_SAMPLE) },
    { name: 'conda.yaml', data: te.encode(MF_CONDA_SAMPLE) },
    { name: 'requirements.txt', data: te.encode('keras==3.5.0\nnumpy\n') },
    { name: 'data/model.keras', data: te.encode('{"note":"weights omitted"}') }
  ]);
}

export function buildSampleMfJson(): string {
  return MF_JSON_SAMPLE;
}

export function parseMfText(text: string, fileName = ''): MfDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('MLflow model file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || looksLikeJson(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid MLflow JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'mlmodel' || ext === 'yaml' || ext === 'yml' || looksLikeMlmodel(raw)) {
    return ingestMlmodelText(raw, fileName, 'mlmodel');
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsMf(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an MLflow model dump');
}

export function parseMfBytes(bytes: Uint8Array, fileName = ''): MfDataset {
  if (!bytes.length) throw new Error('MLflow model file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed MLflow files are not supported — decompress first');
  if (isMlMagic(bytes)) return parseMl01(bytes, fileName);
  if (isZipMagic(bytes)) return parseMlflowZip(bytes, fileName);
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'zip') throw new Error('Not an MLflow artifact ZIP');
  if (!isMostlyText(bytes) && (ext === 'mlmodel' || ext === 'yaml' || ext === 'yml')) {
    throw new Error('Not an MLflow MLmodel (expected YAML, ZIP, or JSON)');
  }
  return parseMfText(td.decode(bytes), fileName);
}

export function filterMfSignatures(signatures: MfSignature[], query: string): MfSignature[] {
  const q = query.trim().toLowerCase();
  if (!q) return signatures;
  const tokens = q.split(/\s+/).filter(Boolean);
  return signatures.filter((s) =>
    tokens.every((token) => {
      if (token.startsWith('sig:') || token.startsWith('name:')) return s.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('kind:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return s.type.toLowerCase().includes(needle) || s.kind.toLowerCase().includes(needle);
      }
      if (token.startsWith('dtype:')) return s.dtype.toLowerCase().includes(token.slice(6));
      if (token.startsWith('shape:')) return s.shapeLabel.toLowerCase().includes(token.slice(6));
      if (token.startsWith('file:') || token.startsWith('flavor:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${s.name} ${s.kind} ${s.type} ${s.dtype} ${s.shapeLabel}`.toLowerCase().includes(token);
    })
  );
}

export function filterMfFiles(files: MfArtifact[], query: string): MfArtifact[] {
  const q = query.trim().toLowerCase();
  if (!q) return files;
  const tokens = q.split(/\s+/).filter(Boolean);
  return files.filter((f) =>
    tokens.every((token) => {
      if (token.startsWith('file:') || token.startsWith('name:')) return `${f.name} ${f.path}`.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('flavor:')) return f.flavor.toLowerCase().includes(token.slice(7));
      if (token.startsWith('type:') || token.startsWith('kind:')) return f.role.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('sig:') || token.startsWith('dtype:') || token.startsWith('shape:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${f.name} ${f.path} ${f.role} ${f.flavor}`.toLowerCase().includes(token);
    })
  );
}

export function filterMfRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('sig:') || token.startsWith('type:') || token.startsWith('name:') || token.startsWith('kind:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('file:') || token.startsWith('flavor:') || token.startsWith('dtype:') || token.startsWith('shape:')) return true;
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
