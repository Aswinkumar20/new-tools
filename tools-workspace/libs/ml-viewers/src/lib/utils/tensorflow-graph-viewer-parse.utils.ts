import type { TfColumn, TfDataset, TfNode, TfSourceKind, TfTensor, TfTensorKind } from '../types/tensorflow-graph-viewer.types';
import { TF_PBTXT_SAMPLE } from '../constants/tensorflow-graph-viewer-sample.data';
import { decodeTfGraphDef, encodeShopRankerTfGraph } from './tensorflow-graph-proto.utils';
import { isGzipMagic, isMostlyText } from './ml-file.utils';

const td = new TextDecoder('utf-8');

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value).trim();
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function prettyModelName(fileName: string, fallback: string): string {
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || fallback;
  if (/^shop[-_]?ranker$/i.test(fromFile)) return 'ShopRanker';
  return fromFile;
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('{')) return true;
  return /^\s*\[\s*(?:[{\["\d]|true|false|null|-)/.test(t);
}

function looksLikePbtxt(text: string): boolean {
  return /^\s*node\s*\{/m.test(text) && /\bop\s*:/.test(text);
}

function shapeProduct(shape: number[]): number {
  return shape.length ? shape.reduce((a, b) => a * Math.max(1, b), 1) : 0;
}

function shapeLabel(shape: number[]): string {
  return shape.length ? `[${shape.join(', ')}]` : '—';
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[|,]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function asNumberList(value: unknown): number[] {
  if (Array.isArray(value)) return value.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (typeof value === 'string') {
    return value
      .split(/[x,×]/i)
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n));
  }
  return [];
}

function tensorKind(raw: unknown, fallback: TfTensorKind): TfTensorKind {
  const v = asString(raw, fallback).toLowerCase();
  if (v === 'placeholder' || v === 'constant' || v === 'variable' || v === 'output' || v === 'value') return v;
  if (v === 'input') return 'placeholder';
  if (v === 'const') return 'constant';
  return fallback;
}

function kindFromOp(op: string): TfTensorKind | null {
  const u = op.toUpperCase();
  if (u === 'PLACEHOLDER' || u === 'PLACEHOLDERV2') return 'placeholder';
  if (u === 'CONST') return 'constant';
  if (u === 'VARIABLE' || u === 'VARIABLEV2' || u === 'VARHANDLEOP') return 'variable';
  return null;
}

function inferTensors(nodes: TfNode[], extra: TfTensor[] = []): TfTensor[] {
  const consumed = new Set<string>();
  for (const node of nodes) for (const input of node.inputs) consumed.add(input.split(':')[0] || input);
  const tensors: TfTensor[] = [...extra];
  const push = (name: string, kind: TfTensorKind, dtype = 'DT_FLOAT', shape: number[] = []) => {
    if (!name || tensors.some((t) => t.name === name)) return;
    tensors.push({
      id: name,
      index: tensors.length,
      name,
      kind,
      dtype,
      shape,
      shapeLabel: shapeLabel(shape),
      size: shapeProduct(shape),
      preview: ''
    });
  };
  for (const node of nodes) {
    const kind = kindFromOp(node.op);
    if (kind) push(node.name, kind);
    else if (!consumed.has(node.name)) push(node.name, 'output');
  }
  tensors.forEach((t, i) => (t.index = i));
  return tensors;
}

function finishDataset(
  name: string,
  sourceKind: TfSourceKind,
  title: string,
  encoding: string,
  meta: { producer?: string; tfVersion?: string },
  nodes: TfNode[],
  tensors: TfTensor[],
  warnings: string[]
): TfDataset {
  if (!nodes.length && !tensors.length) throw new Error('TensorFlow graph contains no nodes or tensors');
  const columns: TfColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'op', index: 1, name: 'op', type: 'STRING' },
    { id: 'inputs', index: 2, name: 'inputs', type: 'STRING' },
    { id: 'device', index: 3, name: 'device', type: 'STRING' }
  ];
  const rows = nodes.map((node) => ({
    name: node.name,
    op: node.op,
    inputs: node.inputs.join('|'),
    device: node.device
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    producer: meta.producer || '—',
    tfVersion: meta.tfVersion || '—',
    nodeCount: nodes.length,
    tensorCount: tensors.length,
    nodes,
    tensors,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string): TfDataset {
  const warnings: string[] = [];
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || 'TF graph';
  const root = rec(raw);
  const graph = rec(root.graph);
  const name = asString(root.name || graph.name || root.title, fromFile);
  const nodeSrc = (Array.isArray(root.nodes) ? root.nodes : Array.isArray(graph.nodes) ? graph.nodes : []) as unknown[];
  const nodes: TfNode[] = nodeSrc.map((item, index) => {
    const n = rec(item);
    const inputs = asStringList(n.inputs || n.input);
    const nodeName = asString(n.name, `node${index + 1}`);
    return {
      id: nodeName,
      index,
      name: nodeName,
      op: asString(n.op || n.opType || n.type, 'Unknown'),
      device: asString(n.device),
      inputs,
      inputCount: inputs.length
    };
  });
  const tensorSrc = (Array.isArray(root.tensors) ? root.tensors : []) as unknown[];
  const extra: TfTensor[] = tensorSrc.map((item, index) => {
    const t = rec(item);
    const shape = asNumberList(t.shape || t.dims);
    const tName = asString(t.name, `tensor${index + 1}`);
    return {
      id: tName,
      index,
      name: tName,
      kind: tensorKind(t.kind || t.role, 'value'),
      dtype: asString(t.dtype || t.type, 'DT_FLOAT').toUpperCase(),
      shape,
      shapeLabel: shapeLabel(shape),
      size: shapeProduct(shape),
      preview: asString(t.preview)
    };
  });
  return finishDataset(
    name,
    'json',
    asString(root.title || root.docString, name),
    'UTF-8',
    { producer: asString(root.producer || root.producerName), tfVersion: asString(root.tfVersion || root.version) },
    nodes,
    inferTensors(nodes, extra),
    warnings
  );
}

function parsePbtxt(text: string, fileName: string): TfDataset {
  const warnings: string[] = [];
  const nodes: TfNode[] = [];
  const blocks = text.split(/node\s*\{/i).slice(1);
  for (const block of blocks) {
    const body = block.split('}')[0] || '';
    const name = /name\s*:\s*"?([^"\s}]+)"?/.exec(body)?.[1] || `node${nodes.length + 1}`;
    const op = /op\s*:\s*"?([^"\s}]+)"?/.exec(body)?.[1] || 'Unknown';
    const device = /device\s*:\s*"([^"]+)"/.exec(body)?.[1] || '';
    const inputs: string[] = [];
    const inputRe = /input\s*:\s*"?([^"\s}]+)"?/g;
    let match: RegExpExecArray | null;
    while ((match = inputRe.exec(body))) inputs.push(match[1]);
    nodes.push({ id: name, index: nodes.length, name, op, device, inputs, inputCount: inputs.length });
  }
  if (!nodes.length) throw new Error('TensorFlow pbtxt contains no nodes');
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || 'TF graph';
  return finishDataset(fromFile, 'pbtxt', fromFile, 'UTF-8', { producer: 'pbtxt' }, nodes, inferTensors(nodes), warnings);
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

function parseCsvAsTf(text: string, fileName: string): TfDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('TensorFlow CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('TensorFlow CSV dump contains no schema');
  const nodes: TfNode[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const inputs = asStringList(row.inputs || row.input);
    const name = row.name || `node${index + 1}`;
    nodes.push({
      id: name,
      index,
      name,
      op: row.op || row.opType || row.type || 'Unknown',
      device: row.device || '',
      inputs,
      inputCount: inputs.length
    });
  });
  const modelName = fileName.replace(/\.[^.]+$/, '') || 'TF graph';
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', {}, nodes, inferTensors(nodes), []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: TfSourceKind): TfDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'TF graph').trim();
  const keys: string[] = [];
  const nodes: TfNode[] = [];
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
      const inputs = asStringList(row.inputs || row.input);
      const nodeName = row.name || `node${nodes.length + 1}`;
      nodes.push({
        id: nodeName,
        index: nodes.length,
        name: nodeName,
        op: row.op || row.opType || row.type || 'Unknown',
        device: '',
        inputs,
        inputCount: inputs.length
      });
    }
  }
  if (!nodes.length) throw new Error('TensorFlow markdown contains no nodes');
  return finishDataset(name, sourceKind, name, 'UTF-8', {}, nodes, inferTensors(nodes), []);
}

function parseGraphDefBinary(bytes: Uint8Array, fileName: string): TfDataset {
  const decoded = decodeTfGraphDef(bytes);
  const warnings: string[] = [];
  const nodes: TfNode[] = decoded.nodes.map((node, index) => ({
    id: node.name || `node${index + 1}`,
    index,
    name: node.name || `node${index + 1}`,
    op: node.op || 'Unknown',
    device: node.device,
    inputs: node.inputs,
    inputCount: node.inputs.length
  }));
  const name = prettyModelName(fileName, 'TF graph');
  return finishDataset(name, 'graphdef', name, 'protobuf', { producer: 'easytoolhub' }, nodes, inferTensors(nodes), warnings);
}

export function buildSampleTfGraphBytes(): Uint8Array {
  return encodeShopRankerTfGraph();
}

export function buildSampleTfPbtxt(): string {
  return TF_PBTXT_SAMPLE;
}

export function parseTfGraphText(text: string, fileName = ''): TfDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('TensorFlow graph file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'json' || looksLikeJson(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid TensorFlow JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'pbtxt' || ext === 'graphdef' || looksLikePbtxt(raw)) return parsePbtxt(raw, fileName);
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsTf(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not a TensorFlow graph dump');
}

export function parseTfGraphBytes(bytes: Uint8Array, fileName = ''): TfDataset {
  if (!bytes.length) throw new Error('TensorFlow graph file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed TensorFlow graphs are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'pb' || ext === 'graphdef' || (!isMostlyText(bytes) && ext !== 'json' && ext !== 'csv' && ext !== 'md' && ext !== 'txt' && ext !== 'pbtxt')) {
    return parseGraphDefBinary(bytes, fileName);
  }
  return parseTfGraphText(td.decode(bytes), fileName);
}

export function filterTfNodes(nodes: TfNode[], query: string): TfNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('node:') || token.startsWith('name:')) return n.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('op:') || token.startsWith('type:')) return n.op.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('in:')) return n.inputs.some((v) => v.toLowerCase().includes(token.slice(3)));
      if (token.startsWith('device:')) return n.device.toLowerCase().includes(token.slice(7));
      if (token.startsWith('tensor:') || token.startsWith('dtype:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${n.name} ${n.op} ${n.device} ${n.inputs.join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterTfTensors(tensors: TfTensor[], query: string): TfTensor[] {
  const q = query.trim().toLowerCase();
  if (!q) return tensors;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tensors.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('tensor:') || token.startsWith('name:')) return t.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('dtype:')) return t.dtype.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('kind:')) return t.kind.toLowerCase().includes(token.slice(5));
      if (token.startsWith('shape:')) return t.shapeLabel.toLowerCase().includes(token.slice(6));
      if (token.startsWith('op:') || token.startsWith('node:') || token.startsWith('in:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${t.name} ${t.kind} ${t.dtype} ${t.shapeLabel}`.toLowerCase().includes(token);
    })
  );
}

export function filterTfRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('op:') || token.startsWith('node:') || token.startsWith('type:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('tensor:') || token.startsWith('dtype:') || token.startsWith('in:') || token.startsWith('device:')) return true;
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
