import type {
  Hdf5Attribute,
  Hdf5DatasetPreview,
  Hdf5ParsedFile,
  Hdf5TreeNode
} from '../types/hdf5-viewer.types';
import { minMaxVolume } from './volume-slice.utils';

// @ts-expect-error jsfive ships no TypeScript types
import * as jsfiveNs from 'jsfive';

type H5FileHandle = {
  keys?: Iterable<string> | string[];
  get(key: string): { constructor?: { name?: string }; shape?: number[]; dtype?: unknown; value?: unknown; attrs?: Record<string, unknown>; keys?: Iterable<string> | string[]; get?(key: string): unknown } | null;
  attrs?: Record<string, unknown>;
};

const H5File = (jsfiveNs as unknown as { File: new (buffer: ArrayBuffer, filename?: string) => H5FileHandle }).File;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+/g, '/');
}

function dtypeLabel(dtype: unknown): string {
  if (!dtype) return 'unknown';
  if (typeof dtype === 'string') return dtype;
  if (typeof dtype === 'object' && dtype !== null) {
    const obj = dtype as { name?: string; kind?: string };
    return obj.name ?? obj.kind ?? 'unknown';
  }
  return String(dtype);
}

function arrayLikeToFloat32(value: unknown): Float32Array | null {
  if (value == null) return null;
  if (value instanceof Float32Array) return value;
  if (Array.isArray(value) || (typeof value === 'object' && 'length' in (value as object))) {
    const arr = value as ArrayLike<number>;
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      const v = Number(arr[i]);
      out[i] = Number.isFinite(v) ? v : 0;
    }
    return out;
  }
  const n = Number(value);
  if (Number.isFinite(n)) {
    return new Float32Array([n]);
  }
  return null;
}

function toViewDims(shape: number[]): [number, number, number] {
  const dims = [...shape];
  while (dims.length < 3) dims.unshift(1);
  if (dims.length > 3) {
    const leading = dims.slice(0, dims.length - 2);
    const product = leading.reduce((a, b) => a * b, 1);
    return [dims[dims.length - 1], dims[dims.length - 2], product];
  }
  if (dims.length === 3) {
    return [dims[2], dims[1], dims[0]];
  }
  if (dims.length === 2) {
    return [dims[1], dims[0], 1];
  }
  return [1, 1, dims[0]];
}

function flattenToViewVolume(data: Float32Array, shape: number[]): Float32Array {
  if (shape.length <= 3) return data;
  const trailing = shape.slice(-2);
  const leading = shape.slice(0, -2);
  const product = leading.reduce((a, b) => a * b, 1);
  const sliceSize = trailing[0] * trailing[1];
  return data.subarray(0, product * sliceSize);
}

function attrsToList(attrs: Record<string, unknown> | null | undefined): Hdf5Attribute[] {
  if (!attrs) return [];
  return Object.keys(attrs).map((name) => ({
    name,
    value: String(attrs[name])
  }));
}

function buildDatasetPreview(path: string, dataset: {
  shape: number[];
  dtype: unknown;
  value: unknown;
  attrs?: Record<string, unknown>;
}): Hdf5DatasetPreview | null {
  const shape = Array.isArray(dataset.shape) ? dataset.shape.map((n) => Number(n)) : [];
  const dataRaw = arrayLikeToFloat32(dataset.value);
  if (!dataRaw || !shape.length) return null;

  const data = flattenToViewVolume(dataRaw, shape);
  const viewDims = toViewDims(shape);
  const { min: dataMin, max: dataMax } = minMaxVolume(data);

  return {
    path,
    shape,
    dtype: dtypeLabel(dataset.dtype),
    rank: shape.length,
    data,
    viewDims,
    dataMin,
    dataMax,
    attributes: attrsToList(dataset.attrs)
  };
}

function walkTree(file: H5FileHandle, prefix = ''): { tree: Hdf5TreeNode[]; datasets: Hdf5DatasetPreview[] } {
  const tree: Hdf5TreeNode[] = [];
  const datasets: Hdf5DatasetPreview[] = [];

  const keys = file.keys ?? [];
  for (const key of keys) {
    const child = file.get(String(key));
    const path = prefix ? `${prefix}/${key}` : String(key);
    if (!child) continue;

    if (child.constructor?.name === 'Dataset' || (typeof child === 'object' && child !== null && 'shape' in child)) {
      const ds = child as { shape: number[]; dtype: unknown; value: unknown; attrs?: Record<string, unknown> };
      const preview = buildDatasetPreview(path, ds);
      tree.push({
        path,
        name: String(key),
        kind: 'dataset',
        shape: Array.isArray(ds.shape) ? [...ds.shape] : [],
        dtype: dtypeLabel(ds.dtype),
        size: preview?.data.length ?? 0
      });
      if (preview) datasets.push(preview);
    } else {
      const group = child as H5FileHandle;
      const nested = walkTree(group, path);
      tree.push({
        path,
        name: String(key),
        kind: 'group',
        children: nested.tree
      });
      datasets.push(...nested.datasets);
    }
  }

  return { tree, datasets };
}

function pickDefaultDataset(datasets: Hdf5DatasetPreview[]): string {
  const multi = datasets.filter((d) => d.rank >= 2);
  const pool = multi.length ? multi : datasets;
  pool.sort((a, b) => b.data.length - a.data.length);
  return pool[0]?.path ?? datasets[0]?.path ?? '';
}

export function parseHdf5Bytes(bytes: Uint8Array, filename = 'upload.h5'): Hdf5ParsedFile {
  const warnings: string[] = [];
  const buffer = toArrayBuffer(bytes);
  const file = new H5File(buffer, filename);
  const { tree, datasets } = walkTree(file);

  if (!datasets.length) {
    warnings.push('No numeric datasets decoded — tree metadata is still available.');
  }

  const defaultDatasetPath = pickDefaultDataset(datasets);
  const preview = datasets.find((d) => d.path === defaultDatasetPath) ?? datasets[0] ?? null;

  return {
    filename,
    tree,
    datasets,
    defaultDatasetPath,
    preview,
    warnings
  };
}

export function readHdf5Dataset(bytes: Uint8Array, path: string, filename = 'upload.h5'): Hdf5DatasetPreview | null {
  const buffer = toArrayBuffer(bytes);
  const file = new H5File(buffer, filename);
  const normalized = normalizePath(path);
  const dataset = file.get(normalized) as { shape: number[]; dtype: unknown; value: unknown; attrs?: Record<string, unknown> } | null;
  if (!dataset || !('shape' in dataset)) return null;
  return buildDatasetPreview(normalized, dataset);
}

export function flattenTree(nodes: Hdf5TreeNode[]): Hdf5TreeNode[] {
  const out: Hdf5TreeNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) {
      out.push(...flattenTree(node.children));
    }
  }
  return out;
}
