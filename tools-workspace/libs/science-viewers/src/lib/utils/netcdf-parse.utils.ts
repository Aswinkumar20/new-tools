import type { NetCdfParsedFile, NetCdfVariable, NetCdfVariablePreview } from '../types/netcdf-viewer.types';
import { minMaxVolume } from './volume-slice.utils';

const NC_DIMENSION = 10;
const NC_VARIABLE = 11;
const NC_ATTRIBUTE = 12;

const NC_BYTE = 1;
const NC_CHAR = 2;
const NC_SHORT = 3;
const NC_INT = 4;
const NC_FLOAT = 5;
const NC_DOUBLE = 6;

const TYPE_LABELS: Record<number, string> = {
  [NC_BYTE]: 'byte',
  [NC_CHAR]: 'char',
  [NC_SHORT]: 'short',
  [NC_INT]: 'int',
  [NC_FLOAT]: 'float',
  [NC_DOUBLE]: 'double'
};

interface NetCdfDimensionRecord {
  name: string;
  size: number;
}

interface NetCdfVariableRecord {
  name: string;
  dimIds: number[];
  type: number;
  vsize: number;
  begin: number;
  attributes: Array<{ name: string; type: number; value: string }>;
}

function readBEInt32(view: DataView, offset: number): number {
  return view.getInt32(offset, false);
}

function readPaddedString(bytes: Uint8Array, offset: number, maxLen?: number): { value: string; next: number } {
  let end = offset;
  const limit = maxLen != null ? Math.min(bytes.length, offset + maxLen) : bytes.length;
  while (end < limit && bytes[end] !== 0) {
    end += 1;
  }
  const value = new TextDecoder('utf-8').decode(bytes.subarray(offset, end));
  const strLen = maxLen != null ? maxLen : end - offset + 1;
  const padded = offset + Math.ceil(strLen / 4) * 4;
  return { value, next: padded };
}

function isHdf5(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x48 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function decodeAttributeValue(type: number, bytes: Uint8Array, offset: number, nelems: number): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === NC_CHAR) {
    return readPaddedString(bytes, offset, nelems).value;
  }
  if (nelems === 1) {
    if (type === NC_FLOAT) return String(view.getFloat32(offset, false));
    if (type === NC_DOUBLE) return String(view.getFloat64(offset, false));
    if (type === NC_INT) return String(view.getInt32(offset, false));
    if (type === NC_SHORT) return String(view.getInt16(offset, false));
    if (type === NC_BYTE) return String(view.getInt8(offset));
  }
  return `[${nelems} values]`;
}

function skipAttributeData(view: DataView, bytes: Uint8Array, offset: number): {
  attribute: { name: string; type: number; value: string };
  next: number;
} {
  const name = readPaddedString(bytes, offset);
  let pos = name.next;
  const type = readBEInt32(view, pos);
  pos += 4;
  const nelems = readBEInt32(view, pos);
  pos += 4;
  const value = decodeAttributeValue(type, bytes, pos, nelems);
  const elSize =
    type === NC_DOUBLE ? 8 : type === NC_FLOAT || type === NC_INT ? 4 : type === NC_SHORT ? 2 : 1;
  const valueBytes = nelems * elSize;
  pos += Math.ceil(valueBytes / 4) * 4;
  return { attribute: { name: name.value, type, value }, next: pos };
}

function parseVariableRecord(data: Uint8Array): NetCdfVariableRecord {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const name = readPaddedString(data, 0);
  let pos = name.next;
  const ndims = readBEInt32(view, pos);
  pos += 4;
  const dimIds: number[] = [];
  for (let d = 0; d < ndims; d++) {
    dimIds.push(readBEInt32(view, pos));
    pos += 4;
  }

  const attributes: NetCdfVariableRecord['attributes'] = [];
  while (pos + 8 <= data.length) {
    const tag = readBEInt32(view, pos);
    if (tag !== NC_ATTRIBUTE) break;
    pos += 4;
    const attrLen = readBEInt32(view, pos);
    pos += 4;
    const attrEnd = pos + attrLen;
    const { attribute, next } = skipAttributeData(view, data, pos);
    attributes.push(attribute);
    pos = next;
    if (pos < attrEnd) pos = attrEnd;
  }

  const type = readBEInt32(view, pos);
  pos += 4;
  const vsize = readBEInt32(view, pos);
  pos += 4;
  const begin = readBEInt32(view, pos);

  return { name: name.value, dimIds, type, vsize, begin, attributes };
}

function parseDimensionBlock(
  bytes: Uint8Array,
  view: DataView,
  pos: number,
  len: number
): { dimensions: NetCdfDimensionRecord[]; next: number } {
  let p = pos;
  const maybeInnerCount = readBEInt32(view, p);
  if (maybeInnerCount === len && p + 4 < bytes.length) {
    p += 4;
  }
  const dims: NetCdfDimensionRecord[] = [];
  for (let i = 0; i < len; i++) {
    if (p + 8 > bytes.length) break;
    const name = readPaddedString(bytes, p);
    if (!name.value || name.next + 4 > bytes.length) break;
    const size = readBEInt32(view, name.next);
    if (size < 0 || size > 1_000_000_000) break;
    dims.push({ name: name.value, size });
    p = name.next + 4;
  }
  if (dims.length === len && len > 0 && len <= 64) {
    return { dimensions: dims, next: p };
  }
  if (pos + len <= bytes.length) {
    return { dimensions: [parseDimensionRecord(bytes.subarray(pos, pos + len))], next: pos + len };
  }
  throw new Error('Invalid NetCDF dimension block');
}

function parseAttributeBlock(bytes: Uint8Array, view: DataView, pos: number, len: number): { next: number } {
  let p = pos;
  for (let i = 0; i < len; i++) {
    if (p + 8 > bytes.length) break;
    const { next } = skipAttributeData(view, bytes, p);
    p = next;
  }
  if (p > pos) return { next: p };
  if (pos + len <= bytes.length) {
    skipAttributeData(view, bytes, pos);
    return { next: pos + len };
  }
  return { next: pos };
}

function parseVariableBlock(bytes: Uint8Array, pos: number, len: number): { variables: NetCdfVariableRecord[]; next: number } {
  let p = pos;
  const vars: NetCdfVariableRecord[] = [];
  for (let i = 0; i < len; i++) {
    if (p + 16 > bytes.length) break;
    const remaining = bytes.subarray(p);
    try {
      vars.push(parseVariableRecord(remaining));
      const consumed = estimateVariableRecordSize(remaining);
      p += consumed;
    } catch {
      break;
    }
  }
  if (vars.length === len && len > 0 && len <= 64) {
    return { variables: vars, next: p };
  }
  if (pos + len <= bytes.length) {
    return { variables: [parseVariableRecord(bytes.subarray(pos, pos + len))], next: pos + len };
  }
  throw new Error('Invalid NetCDF variable block');
}

function estimateVariableRecordSize(data: Uint8Array): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const name = readPaddedString(data, 0);
  const ndims = readBEInt32(view, name.next);
  let pos = name.next + 4 + ndims * 4;
  while (pos + 8 <= data.length) {
    const tag = readBEInt32(view, pos);
    if (tag !== NC_ATTRIBUTE) break;
    pos += 4;
    const attrLen = readBEInt32(view, pos);
    pos += 4;
    const { next } = skipAttributeData(view, data, pos);
    pos = Math.max(next, pos + attrLen);
  }
  return pos + 12;
}

function parseDimensionRecord(data: Uint8Array): NetCdfDimensionRecord {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const name = readPaddedString(data, 0);
  const size = readBEInt32(view, name.next);
  return { name: name.value, size };
}

function readNumericVariable(
  bytes: Uint8Array,
  variable: NetCdfVariableRecord,
  dimensions: NetCdfDimensionRecord[]
): Float32Array {
  const dimSizes = variable.dimIds.map((id) => dimensions[id]?.size ?? 1);
  const count = dimSizes.reduce((a, b) => a * b, 1);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = variable.begin;
  const data = new Float32Array(count);

  if (variable.type === NC_FLOAT) {
    for (let i = 0; i < count; i++) {
      data[i] = view.getFloat32(offset + i * 4, false);
    }
  } else if (variable.type === NC_DOUBLE) {
    for (let i = 0; i < count; i++) {
      data[i] = view.getFloat64(offset + i * 8, false);
    }
  } else if (variable.type === NC_SHORT) {
    for (let i = 0; i < count; i++) {
      data[i] = view.getInt16(offset + i * 2, false);
    }
  } else if (variable.type === NC_INT) {
    for (let i = 0; i < count; i++) {
      data[i] = view.getInt32(offset + i * 4, false);
    }
  } else if (variable.type === NC_BYTE) {
    for (let i = 0; i < count; i++) {
      data[i] = view.getInt8(offset + i);
    }
  } else {
    throw new Error(`Unsupported NetCDF variable type ${variable.type}`);
  }

  return data;
}

function isNumericType(type: number): boolean {
  return type === NC_BYTE || type === NC_SHORT || type === NC_INT || type === NC_FLOAT || type === NC_DOUBLE;
}

function pickDefaultVariable(variables: NetCdfVariable[]): string {
  const numeric = variables.filter((v) => isNumericType(v.typeCode) && v.elementCount > 0);
  const multi = numeric.filter((v) => v.shape.length >= 2);
  const pool = multi.length ? multi : numeric;
  pool.sort((a, b) => b.elementCount - a.elementCount);
  return pool[0]?.name ?? variables[0]?.name ?? '';
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
  if (shape.length <= 3) {
    return data;
  }
  const trailing = shape.slice(-2);
  const leading = shape.slice(0, -2);
  const product = leading.reduce((a, b) => a * b, 1);
  const sliceSize = trailing[0] * trailing[1];
  return data.subarray(0, product * sliceSize);
}

export function buildVariablePreview(
  variable: NetCdfVariable,
  bytes: Uint8Array,
  dimensions: NetCdfDimensionRecord[],
  warnings: string[]
): NetCdfVariablePreview | null {
  if (!isNumericType(variable.typeCode) || variable.elementCount === 0) {
    return null;
  }

  try {
    const record: NetCdfVariableRecord = {
      name: variable.name,
      dimIds: variable.dimIds,
      type: variable.typeCode,
      vsize: 0,
      begin: variable.begin,
      attributes: []
    };
    const raw = readNumericVariable(bytes, record, dimensions);
    const viewDims = toViewDims(variable.shape);
    const data = flattenToViewVolume(raw, variable.shape);
    const { min: dataMin, max: dataMax } = minMaxVolume(data);
    if (variable.shape.length > 3) {
      warnings.push(`${variable.name}: ${variable.shape.length}D variable collapsed to 3D preview.`);
    }
    return {
      variableName: variable.name,
      rank: variable.shape.length,
      shape: variable.shape,
      dimNames: variable.dimNames,
      data,
      viewDims,
      dataMin,
      dataMax,
      sliceAxisLabel: variable.dimNames[variable.dimNames.length - 1] ?? 'slice'
    };
  } catch {
    return null;
  }
}

export function parseNetCdfBytes(bytes: Uint8Array): NetCdfParsedFile {
  const warnings: string[] = [];

  if (isHdf5(bytes)) {
    throw new Error('NetCDF-4 / HDF5 (.nc) is not decoded — export as NetCDF classic or use the HDF5 Viewer.');
  }

  if (bytes.length < 8 || bytes[0] !== 0x43 || bytes[1] !== 0x44 || bytes[2] !== 0x46) {
    throw new Error('Not a NetCDF classic file (expected CDF magic)');
  }

  const version = bytes[3];
  if (version !== 0x01 && version !== 0x02) {
    throw new Error(`Unsupported NetCDF version byte (${version})`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 4;
  readBEInt32(view, pos);
  pos += 4;

  const dimensions: NetCdfDimensionRecord[] = [];
  const variableRecords: NetCdfVariableRecord[] = [];
  const globalAttributes: Array<{ name: string; type: number; value: string }> = [];

  while (pos + 8 <= bytes.length) {
    const tag = readBEInt32(view, pos);
    pos += 4;
    const len = readBEInt32(view, pos);
    pos += 4;
    if (len < 0) break;

    if (tag === NC_DIMENSION) {
      const block = parseDimensionBlock(bytes, view, pos, len);
      dimensions.push(...block.dimensions);
      pos = block.next;
    } else if (tag === NC_VARIABLE) {
      const block = parseVariableBlock(bytes, pos, len);
      variableRecords.push(...block.variables);
      pos = block.next;
    } else if (tag === NC_ATTRIBUTE) {
      const blockStart = pos;
      const block = parseAttributeBlock(bytes, view, pos, len);
      pos = block.next;
      let attrPos = blockStart;
      for (let i = 0; i < len; i++) {
        if (attrPos + 8 > bytes.length) break;
        const { attribute, next } = skipAttributeData(view, bytes, attrPos);
        globalAttributes.push(attribute);
        attrPos = next;
        if (attrPos >= pos) break;
      }
      if (!globalAttributes.length && blockStart + len <= bytes.length) {
        const { attribute } = skipAttributeData(view, bytes, blockStart);
        globalAttributes.push(attribute);
      }
    } else if (tag === 0) {
      break;
    } else {
      if (pos + len > bytes.length) break;
      pos += len;
    }
  }

  const variables: NetCdfVariable[] = variableRecords.map((vr) => {
    const dimNames = vr.dimIds.map((id) => dimensions[id]?.name ?? `dim${id}`);
    const shape = vr.dimIds.map((id) => dimensions[id]?.size ?? 1);
    const elementCount = shape.reduce((a, b) => a * b, 1);
    return {
      name: vr.name,
      typeCode: vr.type,
      typeLabel: TYPE_LABELS[vr.type] ?? `type${vr.type}`,
      dimIds: vr.dimIds,
      dimNames,
      shape,
      attributes: vr.attributes.map((a) => ({
        name: a.name,
        type: TYPE_LABELS[a.type] ?? `type${a.type}`,
        value: a.value
      })),
      begin: vr.begin,
      elementCount
    };
  });

  if (!variables.length) {
    throw new Error('No variables found in NetCDF file');
  }

  const defaultVariableName = pickDefaultVariable(variables);
  const defaultVar = variables.find((v) => v.name === defaultVariableName) ?? variables[0];
  const preview = buildVariablePreview(defaultVar, bytes, dimensions, warnings);

  return {
    netcdfVersion: version,
    dimensions: dimensions.map((d) => ({ name: d.name, size: d.size })),
    variables,
    globalAttributes: globalAttributes.map((a) => ({
      name: a.name,
      type: TYPE_LABELS[a.type] ?? `type${a.type}`,
      value: a.value
    })),
    defaultVariableName: defaultVar.name,
    preview,
    warnings
  };
}

export function readNetCdfVariableData(
  bytes: Uint8Array,
  parsed: NetCdfParsedFile,
  variableName: string
): NetCdfVariablePreview | null {
  const variable = parsed.variables.find((v) => v.name === variableName);
  if (!variable) return null;
  const warnings: string[] = [];
  const dimensions = parsed.dimensions.map((d) => ({ name: d.name, size: d.size }));
  return buildVariablePreview(variable, bytes, dimensions, warnings);
}
