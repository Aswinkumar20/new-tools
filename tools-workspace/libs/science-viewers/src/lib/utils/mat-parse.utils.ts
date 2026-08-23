import type { MatParsedFile, MatVariable, MatVariablePreview } from '../types/matlab-mat-viewer.types';
import { minMaxVolume } from './volume-slice.utils';

// @ts-expect-error jsfive ships no TypeScript types
import * as jsfiveNs from 'jsfive';

const H5File = (jsfiveNs as unknown as { File: new (buffer: ArrayBuffer, filename?: string) => {
  keys?: Iterable<string> | string[];
  get(key: string): unknown;
  attrs?: Record<string, unknown>;
} }).File;

const MI_INT8 = 1;
const MI_UINT8 = 2;
const MI_INT16 = 3;
const MI_UINT16 = 4;
const MI_INT32 = 5;
const MI_UINT32 = 6;
const MI_SINGLE = 7;
const MI_DOUBLE = 9;
const MI_MATRIX = 14;
const MI_COMPRESSED = 15;

const MX_DOUBLE_CLASS = 6;
const MX_SINGLE_CLASS = 7;
const MX_INT8_CLASS = 8;
const MX_UINT8_CLASS = 9;
const MX_INT16_CLASS = 10;
const MX_UINT16_CLASS = 11;
const MX_INT32_CLASS = 12;
const MX_UINT32_CLASS = 13;
const MX_CHAR_CLASS = 4;

const CLASS_LABELS: Record<number, string> = {
  [MX_CHAR_CLASS]: 'char',
  [MX_DOUBLE_CLASS]: 'double',
  [MX_SINGLE_CLASS]: 'single',
  [MX_INT8_CLASS]: 'int8',
  [MX_UINT8_CLASS]: 'uint8',
  [MX_INT16_CLASS]: 'int16',
  [MX_UINT16_CLASS]: 'uint16',
  [MX_INT32_CLASS]: 'int32',
  [MX_UINT32_CLASS]: 'uint32'
};

function align8(n: number): number {
  return (8 - (n % 8)) % 8;
}

function readI32(bytes: Uint8Array, pos: number, le: boolean): number {
  return new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getInt32(0, le);
}

function readU32(bytes: Uint8Array, pos: number, le: boolean): number {
  return new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getUint32(0, le);
}

function readF32(bytes: Uint8Array, pos: number, le: boolean): number {
  return new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getFloat32(0, le);
}

function readF64(bytes: Uint8Array, pos: number, le: boolean): number {
  return new DataView(bytes.buffer, bytes.byteOffset + pos, 8).getFloat64(0, le);
}

function toViewDims(shape: number[]): [number, number, number] {
  const dims = [...shape];
  while (dims.length < 3) dims.unshift(1);
  if (dims.length > 3) {
    const leading = dims.slice(0, dims.length - 2);
    const product = leading.reduce((a, b) => a * b, 1);
    return [dims[dims.length - 1], dims[dims.length - 2], product];
  }
  if (dims.length === 3) return [dims[2], dims[1], dims[0]];
  if (dims.length === 2) return [dims[1], dims[0], 1];
  return [1, 1, dims[0]];
}

function isMatV73(bytes: Uint8Array): boolean {
  const head = new TextDecoder('ascii').decode(bytes.subarray(0, 128));
  if (head.includes('MATLAB 7.3')) return true;
  return bytes[0] === 0x89 && bytes[1] === 0x48 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function isLittleEndian(bytes: Uint8Array): boolean {
  return bytes[126] === 0 && bytes[127] === 1;
}

interface Element {
  dtype: number;
  data: Uint8Array;
  next: number;
}

function readElement(bytes: Uint8Array, pos: number, le: boolean): Element | null {
  if (pos + 8 > bytes.length) return null;
  const dtype = readI32(bytes, pos, le);
  const nbytes = readU32(bytes, pos + 4, le);
  const dataStart = pos + 8;
  if (nbytes === 0) return { dtype, data: new Uint8Array(0), next: pos + 8 };
  if (nbytes <= 4) {
    return { dtype, data: bytes.subarray(dataStart, dataStart + nbytes), next: pos + 8 };
  }
  const data = bytes.subarray(dataStart, dataStart + nbytes);
  return { dtype, data, next: dataStart + nbytes + align8(nbytes) };
}

function numericToFloat32(data: Uint8Array, dtype: number, count: number, le: boolean): Float32Array | null {
  const out = new Float32Array(count);
  if (dtype === MI_DOUBLE) {
    for (let i = 0; i < count; i++) out[i] = readF64(data, i * 8, le);
    return out;
  }
  if (dtype === MI_SINGLE) {
    for (let i = 0; i < count; i++) out[i] = readF32(data, i * 4, le);
    return out;
  }
  if (dtype === MI_INT8) {
    for (let i = 0; i < count; i++) out[i] = new Int8Array(data.buffer, data.byteOffset + i, 1)[0];
    return out;
  }
  if (dtype === MI_UINT8) {
    for (let i = 0; i < count; i++) out[i] = data[i];
    return out;
  }
  if (dtype === MI_INT16) {
    for (let i = 0; i < count; i++) {
      out[i] = new DataView(data.buffer, data.byteOffset + i * 2, 2).getInt16(0, le);
    }
    return out;
  }
  if (dtype === MI_UINT16) {
    for (let i = 0; i < count; i++) {
      out[i] = new DataView(data.buffer, data.byteOffset + i * 2, 2).getUint16(0, le);
    }
    return out;
  }
  if (dtype === MI_INT32) {
    for (let i = 0; i < count; i++) out[i] = readI32(data, i * 4, le);
    return out;
  }
  if (dtype === MI_UINT32) {
    for (let i = 0; i < count; i++) out[i] = readU32(data, i * 4, le);
    return out;
  }
  return null;
}

function parseMatrixElement(body: Uint8Array, le: boolean, warnings: string[]): {
  name: string;
  className: string;
  shape: number[];
  data: Float32Array | null;
} | null {
  let cursor = 0;
  const flagsEl = readElement(body, cursor, le);
  if (!flagsEl || flagsEl.dtype !== MI_UINT32 || flagsEl.data.length < 4) return null;
  const mxClass = readU32(flagsEl.data, 0, le);
  cursor = flagsEl.next;

  const dimsEl = readElement(body, cursor, le);
  if (!dimsEl || dimsEl.dtype !== MI_INT32) return null;
  const ndims = readI32(dimsEl.data, 0, le);
  const shape: number[] = [];
  for (let i = 0; i < ndims; i++) shape.push(readI32(dimsEl.data, 4 + i * 4, le));
  cursor = dimsEl.next;

  const nameEl = readElement(body, cursor, le);
  if (!nameEl || nameEl.dtype !== MI_INT8) return null;
  const name = new TextDecoder('ascii').decode(nameEl.data).replace(/\0/g, '');
  cursor = nameEl.next;

  const dataEl = readElement(body, cursor, le);
  if (!dataEl) return null;

  const className = CLASS_LABELS[mxClass] ?? `class-${mxClass}`;
  if (mxClass === MX_CHAR_CLASS) {
    warnings.push(`Variable "${name}" is char/text — preview skipped.`);
    return { name, className, shape, data: null };
  }

  const count = shape.reduce((a, b) => a * Math.max(1, b), 1);
  const data = numericToFloat32(dataEl.data, dataEl.dtype, count, le);
  if (!data) {
    warnings.push(`Variable "${name}" (${className}) uses unsupported storage type ${dataEl.dtype}.`);
    return { name, className, shape, data: null };
  }
  return { name, className, shape, data };
}

function buildPreview(
  name: string,
  variables: MatVariable[],
  dataMap: Map<string, Float32Array>
): MatVariablePreview | null {
  const variable = variables.find((v) => v.name === name);
  const data = dataMap.get(name);
  if (!variable || !data) return null;
  const shape = variable.shape.length ? variable.shape : [data.length];
  const { min: dataMin, max: dataMax } = minMaxVolume(data);
  return {
    variableName: name,
    rank: shape.length,
    shape,
    data,
    viewDims: toViewDims(shape),
    dataMin,
    dataMax,
    sliceAxisLabel: shape.length >= 3 ? 'z' : shape.length === 2 ? 'y' : 'x'
  };
}

function parseMatV5(bytes: Uint8Array, warnings: string[]): MatParsedFile {
  const le = isLittleEndian(bytes);
  const header = new TextDecoder('ascii').decode(bytes.subarray(0, 116)).trim();
  const variables: MatVariable[] = [];
  const dataMap = new Map<string, Float32Array>();
  let pos = 128;

  while (pos + 8 <= bytes.length) {
    const el = readElement(bytes, pos, le);
    if (!el) break;
    pos = el.next;
    if (el.dtype === MI_COMPRESSED) {
      warnings.push('Compressed MAT variables are not decoded — re-save without compression or use HDF5 Viewer for v7.3.');
      continue;
    }
    if (el.dtype !== MI_MATRIX) continue;
    const parsed = parseMatrixElement(el.data, le, warnings);
    if (!parsed) continue;
    variables.push({
      name: parsed.name,
      className: parsed.className,
      shape: parsed.shape,
      rank: parsed.shape.length,
      dtype: parsed.className
    });
    if (parsed.data) dataMap.set(parsed.name, parsed.data);
  }

  if (!variables.length) {
    throw new Error('No MATLAB variables found in MAT v5 file.');
  }

  const defaultVariableName = variables.find((v) => dataMap.has(v.name))?.name ?? variables[0].name;
  const variableData: Record<string, Float32Array> = {};
  dataMap.forEach((v, k) => {
    variableData[k] = v;
  });
  return {
    format: 'mat-v5',
    matVersion: header,
    variables,
    defaultVariableName,
    preview: buildPreview(defaultVariableName, variables, dataMap),
    variableData,
    warnings
  };
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
  return Number.isFinite(n) ? new Float32Array([n]) : null;
}

function parseMatV73(bytes: Uint8Array, warnings: string[]): MatParsedFile {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const file = new H5File(buf);
  const variables: MatVariable[] = [];
  const dataMap = new Map<string, Float32Array>();

  const visit = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    const record = obj as {
      keys?: () => string[];
      get?: (k: string) => unknown;
      shape?: number[];
      dtype?: unknown;
      value?: unknown;
    };
    if (typeof record.keys === 'function' && typeof record.get === 'function') {
      for (const key of record.keys()) {
        if (key === '#refs#') continue;
        const child = record.get(key);
        if (child && typeof child === 'object' && 'shape' in (child as object)) {
          const ds = child as { shape?: number[]; dtype?: unknown; value?: unknown };
          const shape = Array.isArray(ds.shape) ? ds.shape.map((n) => Number(n)) : [1];
          const data = arrayLikeToFloat32(ds.value);
          variables.push({
            name: key,
            className: String(ds.dtype ?? 'dataset'),
            shape,
            rank: shape.length,
            dtype: String(ds.dtype ?? 'unknown')
          });
          if (data) dataMap.set(key, data);
        } else {
          visit(child);
        }
      }
    }
  };

  visit(file);
  if (!variables.length) {
    warnings.push('MAT v7.3 opened as HDF5 but no numeric datasets were found at the top level.');
  }

  const defaultVariableName = variables.find((v) => dataMap.has(v.name))?.name ?? variables[0]?.name ?? '';
  const variableData: Record<string, Float32Array> = {};
  dataMap.forEach((v, k) => {
    variableData[k] = v;
  });
  return {
    format: 'mat-v73',
    matVersion: 'MATLAB 7.3 MAT-file (HDF5)',
    variables,
    defaultVariableName,
    preview: defaultVariableName ? buildPreview(defaultVariableName, variables, dataMap) : null,
    variableData,
    warnings
  };
}

export function parseMatBytes(bytes: Uint8Array): MatParsedFile {
  const warnings: string[] = [];
  if (isMatV73(bytes)) {
    try {
      return parseMatV73(bytes, warnings);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'MAT v7.3 HDF5 parse failed');
      throw new Error('Failed to parse MATLAB 7.3 MAT-file — try the HDF5 Viewer for raw dataset access.');
    }
  }
  return parseMatV5(bytes, warnings);
}

export function readMatVariableData(
  _bytes: Uint8Array,
  parsed: MatParsedFile,
  variableName: string
): MatVariablePreview | null {
  const data = parsed.variableData[variableName];
  if (!data) return null;
  const variable = parsed.variables.find((v) => v.name === variableName);
  if (!variable) return null;
  const shape = variable.shape.length ? variable.shape : [data.length];
  const { min: dataMin, max: dataMax } = minMaxVolume(data);
  return {
    variableName,
    rank: shape.length,
    shape,
    data,
    viewDims: toViewDims(shape),
    dataMin,
    dataMax,
    sliceAxisLabel: shape.length >= 3 ? 'z' : shape.length === 2 ? 'y' : 'x'
  };
}
