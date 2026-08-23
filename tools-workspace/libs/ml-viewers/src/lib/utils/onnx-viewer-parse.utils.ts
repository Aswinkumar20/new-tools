import type { OxColumn, OxDataset, OxNode, OxSourceKind, OxTensor, OxTensorKind } from '../types/onnx-viewer.types';
import { OX_JSON_SAMPLE } from '../constants/onnx-viewer-sample.data';
import { decodeOnnxModel, encodeShopRankerOnnx } from './onnx-proto.utils';
import { isGzipMagic, isMostlyText } from './ml-file.utils';

const td = new TextDecoder('utf-8');

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

function tensorKind(raw: unknown, fallback: OxTensorKind): OxTensorKind {
  const v = asString(raw, fallback).toLowerCase();
  if (v === 'input' || v === 'output' || v === 'initializer' || v === 'value') return v;
  return fallback;
}

function finishDataset(
  name: string,
  sourceKind: OxSourceKind,
  title: string,
  encoding: string,
  meta: {
    irVersion?: string;
    producerName?: string;
    producerVersion?: string;
    domain?: string;
    modelVersion?: string;
    docString?: string;
    opset?: string;
  },
  nodes: OxNode[],
  tensors: OxTensor[],
  warnings: string[]
): OxDataset {
  if (!nodes.length && !tensors.length) throw new Error('ONNX model contains no ops or tensors');
  const columns: OxColumn[] = [
    { id: 'name', index: 0, name: 'name', type: 'STRING' },
    { id: 'opType', index: 1, name: 'opType', type: 'STRING' },
    { id: 'inputs', index: 2, name: 'inputs', type: 'STRING' },
    { id: 'outputs', index: 3, name: 'outputs', type: 'STRING' }
  ];
  const rows = nodes.map((node) => ({
    name: node.name,
    opType: node.opType,
    inputs: node.inputs.join('|'),
    outputs: node.outputs.join('|')
  }));
  return {
    name,
    sourceKind,
    title: title || name,
    encoding,
    irVersion: meta.irVersion || '—',
    producerName: meta.producerName || '—',
    producerVersion: meta.producerVersion || '—',
    domain: meta.domain || '—',
    modelVersion: meta.modelVersion || '—',
    docString: meta.docString || '',
    opset: meta.opset || '—',
    nodeCount: nodes.length,
    tensorCount: tensors.length,
    nodes,
    tensors,
    columns,
    rows,
    warnings
  };
}

function ingestJson(raw: unknown, fileName: string): OxDataset {
  const warnings: string[] = [];
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || 'ONNX model';
  const root = rec(raw);
  const graph = rec(root.graph);
  const name = asString(root.name || graph.name || root.title, fromFile);
  const nodeSrc = (Array.isArray(root.nodes) ? root.nodes : Array.isArray(graph.nodes) ? graph.nodes : []) as unknown[];
  const tensorSrc = (
    Array.isArray(root.tensors)
      ? root.tensors
      : Array.isArray(root.initializers)
        ? root.initializers
        : []
  ) as unknown[];
  const nodes: OxNode[] = nodeSrc.map((item, index) => {
    const n = rec(item);
    const inputs = asStringList(n.inputs || n.input);
    const outputs = asStringList(n.outputs || n.output);
    const opName = asString(n.name, `op${index + 1}`);
    return {
      id: opName,
      index,
      name: opName,
      opType: asString(n.opType || n.op_type || n.type, 'Unknown'),
      domain: asString(n.domain),
      inputs,
      outputs,
      inputCount: inputs.length,
      outputCount: outputs.length
    };
  });
  const tensors: OxTensor[] = tensorSrc.map((item, index) => {
    const t = rec(item);
    const shape = asNumberList(t.shape || t.dims);
    const tName = asString(t.name, `tensor${index + 1}`);
    return {
      id: tName,
      index,
      name: tName,
      kind: tensorKind(t.kind || t.role, 'initializer'),
      dtype: asString(t.dtype || t.type, 'FLOAT').toUpperCase(),
      shape,
      shapeLabel: shapeLabel(shape),
      size: shapeProduct(shape),
      preview: asString(t.preview || t.value)
    };
  });
  if (Array.isArray(root.inputs)) {
    for (const item of root.inputs as unknown[]) {
      const t = rec(item);
      const tName = asString(t.name);
      if (!tName || tensors.some((x) => x.name === tName)) continue;
      const shape = asNumberList(t.shape || t.dims);
      tensors.push({
        id: tName,
        index: tensors.length,
        name: tName,
        kind: 'input',
        dtype: asString(t.dtype || t.type, 'FLOAT').toUpperCase(),
        shape,
        shapeLabel: shapeLabel(shape),
        size: shapeProduct(shape),
        preview: ''
      });
    }
  }
  if (Array.isArray(root.outputs)) {
    for (const item of root.outputs as unknown[]) {
      const t = rec(item);
      const tName = asString(t.name);
      if (!tName || tensors.some((x) => x.name === tName)) continue;
      const shape = asNumberList(t.shape || t.dims);
      tensors.push({
        id: tName,
        index: tensors.length,
        name: tName,
        kind: 'output',
        dtype: asString(t.dtype || t.type, 'FLOAT').toUpperCase(),
        shape,
        shapeLabel: shapeLabel(shape),
        size: shapeProduct(shape),
        preview: ''
      });
    }
  }
  tensors.forEach((t, i) => (t.index = i));
  return finishDataset(
    name,
    'json',
    asString(root.title || root.docString || graph.name, name),
    'UTF-8',
    {
      irVersion: asString(root.irVersion || root.ir_version),
      producerName: asString(root.producerName || root.producer_name),
      producerVersion: asString(root.producerVersion || root.producer_version),
      domain: asString(root.domain),
      modelVersion: asString(root.modelVersion || root.model_version),
      docString: asString(root.docString || root.doc_string),
      opset: asString(root.opset || root.opsetVersion)
    },
    nodes,
    tensors,
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

function parseCsvAsOnnx(text: string, fileName: string): OxDataset {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('#'));
  if (lines.length < 2) throw new Error('ONNX CSV dump contains no rows');
  const header = parseCsvLine(lines[0]).map((h) => h.trim()).filter(Boolean);
  if (!header.length) throw new Error('ONNX CSV dump contains no schema');
  const nodes: OxNode[] = [];
  lines.slice(1).forEach((line, index) => {
    const parts = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = parts[i] ?? ''));
    const inputs = asStringList(row.inputs || row.input);
    const outputs = asStringList(row.outputs || row.output);
    const name = row.name || `op${index + 1}`;
    nodes.push({
      id: name,
      index,
      name,
      opType: row.opType || row.type || 'Unknown',
      domain: row.domain || '',
      inputs,
      outputs,
      inputCount: inputs.length,
      outputCount: outputs.length
    });
  });
  const modelName = fileName.replace(/\.[^.]+$/, '') || 'ONNX model';
  return finishDataset(modelName, 'csv', modelName, 'UTF-8', {}, nodes, [], []);
}

function parseMarkdown(text: string, fileName: string, sourceKind: OxSourceKind): OxDataset {
  const name = (/^#\s+(.+)$/m.exec(text)?.[1] || fileName.replace(/\.[^.]+$/, '') || 'ONNX model').trim();
  const keys: string[] = [];
  const nodes: OxNode[] = [];
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
      const outputs = asStringList(row.outputs || row.output);
      const opName = row.name || `op${nodes.length + 1}`;
      nodes.push({
        id: opName,
        index: nodes.length,
        name: opName,
        opType: row.opType || row.type || 'Unknown',
        domain: '',
        inputs,
        outputs,
        inputCount: inputs.length,
        outputCount: outputs.length
      });
    }
  }
  if (!nodes.length) throw new Error('ONNX markdown contains no ops');
  return finishDataset(name, sourceKind, name, 'UTF-8', {}, nodes, [], []);
}

function parseOnnxBinary(bytes: Uint8Array, fileName: string): OxDataset {
  const decoded = decodeOnnxModel(bytes);
  const warnings: string[] = [];
  if (!decoded.nodes.length) warnings.push('ModelProto has no graph nodes');
  const nodes: OxNode[] = decoded.nodes.map((node, index) => ({
    id: node.name || `op${index + 1}`,
    index,
    name: node.name || `op${index + 1}`,
    opType: node.opType || 'Unknown',
    domain: node.domain,
    inputs: node.inputs,
    outputs: node.outputs,
    inputCount: node.inputs.length,
    outputCount: node.outputs.length
  }));
  const tensors: OxTensor[] = [];
  const pushTensor = (name: string, kind: OxTensorKind, dtype: string, shape: number[], preview = '') => {
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
      preview
    });
  };
  for (const t of decoded.initializers) pushTensor(t.name, 'initializer', t.dtype, t.shape, t.preview);
  for (const t of decoded.inputs) pushTensor(t.name, 'input', t.dtype, t.shape);
  for (const t of decoded.outputs) pushTensor(t.name, 'output', t.dtype, t.shape);
  const fromFile = fileName.replace(/\.[^.]+$/, '').replace(/^sample-/, '') || 'ONNX model';
  return finishDataset(
    decoded.graphName || fromFile,
    'onnx',
    decoded.docString || decoded.graphName || fromFile,
    'protobuf',
    {
      irVersion: decoded.irVersion,
      producerName: decoded.producerName,
      producerVersion: decoded.producerVersion,
      domain: decoded.domain,
      modelVersion: decoded.modelVersion,
      docString: decoded.docString,
      opset: decoded.opset
    },
    nodes,
    tensors,
    warnings
  );
}

export function buildSampleOnnxBytes(): Uint8Array {
  return encodeShopRankerOnnx();
}

export function buildSampleOnnxJson(): string {
  return OX_JSON_SAMPLE;
}

export function parseOnnxText(text: string, fileName = ''): OxDataset {
  const stripped = text.replace(/^\uFEFF/, '');
  if (!stripped.trim()) throw new Error('ONNX file is empty');
  const raw = stripped.replace(/\r?\n+$/, '');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (looksLikeJson(raw) || ext === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid ONNX JSON');
    }
    return ingestJson(parsed, fileName);
  }
  if (ext === 'csv' || /^[\w."]+,[\w."]+/.test(raw.split(/\r?\n/)[0] || '')) return parseCsvAsOnnx(raw, fileName);
  if (ext === 'md' || (/^#\s+/m.test(raw) && (raw.includes('|') || /:\s+[A-Za-z]/.test(raw)))) {
    return parseMarkdown(raw, fileName, ext === 'md' ? 'markdown' : 'txt');
  }
  throw new Error('Not an ONNX dump');
}

export function parseOnnxBytes(bytes: Uint8Array, fileName = ''): OxDataset {
  if (!bytes.length) throw new Error('ONNX file is empty');
  if (isGzipMagic(bytes)) throw new Error('Compressed ONNX files are not supported — decompress first');
  const ext = (/\.([^.]+)$/.exec(fileName.toLowerCase())?.[1] ?? '').toLowerCase();
  if (ext === 'onnx' || (!isMostlyText(bytes) && ext !== 'json' && ext !== 'csv' && ext !== 'md' && ext !== 'txt')) {
    return parseOnnxBinary(bytes, fileName);
  }
  return parseOnnxText(td.decode(bytes), fileName);
}

export function filterOxNodes(nodes: OxNode[], query: string): OxNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const tokens = q.split(/\s+/).filter(Boolean);
  return nodes.filter((n) =>
    tokens.every((token) => {
      if (token.startsWith('op:') || token.startsWith('type:')) return n.opType.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('name:')) return n.name.toLowerCase().includes(token.slice(5));
      if (token.startsWith('in:')) return n.inputs.some((v) => v.toLowerCase().includes(token.slice(3)));
      if (token.startsWith('out:')) return n.outputs.some((v) => v.toLowerCase().includes(token.slice(4)));
      if (token.startsWith('tensor:') || token.startsWith('dtype:') || token.startsWith('shape:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) return true;
      return `${n.name} ${n.opType} ${n.inputs.join(' ')} ${n.outputs.join(' ')}`.toLowerCase().includes(token);
    })
  );
}

export function filterOxTensors(tensors: OxTensor[], query: string): OxTensor[] {
  const q = query.trim().toLowerCase();
  if (!q) return tensors;
  const tokens = q.split(/\s+/).filter(Boolean);
  return tensors.filter((t) =>
    tokens.every((token) => {
      if (token.startsWith('tensor:') || token.startsWith('name:')) return t.name.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('type:') || token.startsWith('dtype:')) return t.dtype.toLowerCase().includes(token.slice(token.indexOf(':') + 1));
      if (token.startsWith('kind:')) return t.kind.toLowerCase().includes(token.slice(5));
      if (token.startsWith('shape:')) return t.shapeLabel.toLowerCase().includes(token.slice(6));
      if (token.startsWith('op:') || token.startsWith('in:') || token.startsWith('out:') || token.startsWith('row:')) return true;
      const colon = token.indexOf(':');
      if (colon > 0) {
        const key = token.slice(0, colon);
        const needle = token.slice(colon + 1);
        return t.name.toLowerCase() === key && `${t.dtype} ${t.shapeLabel} ${t.preview}`.toLowerCase().includes(needle);
      }
      return `${t.name} ${t.kind} ${t.dtype} ${t.shapeLabel} ${t.preview}`.toLowerCase().includes(token);
    })
  );
}

export function filterOxRows(rows: Array<Record<string, string>>, query: string): Array<Record<string, string>> {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((row) =>
    tokens.every((token) => {
      if (token.startsWith('row:') || token.startsWith('op:') || token.startsWith('type:')) {
        const needle = token.slice(token.indexOf(':') + 1);
        return Object.values(row).some((v) => v.toLowerCase().includes(needle));
      }
      if (token.startsWith('tensor:') || token.startsWith('dtype:') || token.startsWith('shape:') || token.startsWith('in:') || token.startsWith('out:')) {
        return true;
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
