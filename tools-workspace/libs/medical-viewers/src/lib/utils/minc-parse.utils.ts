import type { MincHeaderInfo, MincParsedVolume } from '../types/minc-viewer.types';
import { minMaxVolume } from './volume-slice.utils';

const NC_DIMENSION = 10;
const NC_VARIABLE = 11;
const NC_ATTRIBUTE = 12;

const NC_BYTE = 1;
const NC_SHORT = 3;
const NC_INT = 4;
const NC_FLOAT = 5;
const NC_DOUBLE = 6;

interface NetCdfDimension {
  name: string;
  size: number;
}

interface NetCdfVariable {
  name: string;
  dimIds: number[];
  type: number;
  vsize: number;
  begin: number;
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

function skipAttributeData(view: DataView, bytes: Uint8Array, offset: number): number {
  const name = readPaddedString(bytes, offset);
  let pos = name.next;
  const type = readBEInt32(view, pos);
  pos += 4;
  const nelems = readBEInt32(view, pos);
  pos += 4;
  const elSize =
    type === NC_DOUBLE ? 8 : type === NC_FLOAT || type === NC_INT ? 4 : type === NC_SHORT ? 2 : 1;
  const valueBytes = nelems * elSize;
  pos += Math.ceil(valueBytes / 4) * 4;
  return pos;
}

function parseVariableRecord(data: Uint8Array): NetCdfVariable {
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

  while (pos + 8 <= data.length) {
    const tag = readBEInt32(view, pos);
    if (tag !== NC_ATTRIBUTE) break;
    pos += 4;
    const attrLen = readBEInt32(view, pos);
    pos += 4;
    const attrEnd = pos + attrLen;
    pos = skipAttributeData(view, data, pos);
    if (pos < attrEnd) pos = attrEnd;
  }

  const type = readBEInt32(view, pos);
  pos += 4;
  const vsize = readBEInt32(view, pos);
  pos += 4;
  const begin = readBEInt32(view, pos);

  return { name: name.value, dimIds, type, vsize, begin };
}

function parseDimensionRecord(data: Uint8Array): NetCdfDimension {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const name = readPaddedString(data, 0);
  const size = readBEInt32(view, name.next);
  return { name: name.value, size };
}

function readVolumeFromVariable(
  bytes: Uint8Array,
  variable: NetCdfVariable,
  dimensions: NetCdfDimension[]
): { data: Float32Array; dims: [number, number, number]; warnings: string[] } {
  const warnings: string[] = [];
  const dimSizes = variable.dimIds.map((id) => dimensions[id]?.size ?? 1);
  while (dimSizes.length < 3) dimSizes.push(1);
  if (dimSizes.length > 3) {
    warnings.push(`${dimSizes.length}D MINC volume truncated to first 3 dimensions.`);
  }
  const nx = Math.max(1, dimSizes[0]);
  const ny = Math.max(1, dimSizes[1]);
  const nz = Math.max(1, dimSizes[2]);
  const count = nx * ny * nz;
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

  return { data, dims: [nx, ny, nz], warnings };
}

function pickImageVariable(variables: NetCdfVariable[]): NetCdfVariable | null {
  const priority = ['image', 'MRimage', 'PETimage', 'CTimage'];
  for (const name of priority) {
    const found = variables.find((v) => v.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  return variables.find((v) => v.name.toLowerCase().includes('image')) ?? variables[0] ?? null;
}

export function parseMincBytes(bytes: Uint8Array): MincParsedVolume {
  const warnings: string[] = [];

  if (isHdf5(bytes)) {
    throw new Error('MINC 2 / HDF5 (.mnc) is not decoded in this viewer — convert to MINC 1 / NetCDF classic.');
  }

  if (bytes.length < 8 || bytes[0] !== 0x43 || bytes[1] !== 0x44 || bytes[2] !== 0x46) {
    throw new Error('Not a NetCDF classic MINC file (expected CDF magic)');
  }

  const version = bytes[3];
  if (version !== 0x01 && version !== 0x02) {
    throw new Error(`Unsupported NetCDF version byte (${version})`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 4;
  readBEInt32(view, pos); // numrecs
  pos += 4;

  const dimensions: NetCdfDimension[] = [];
  const variables: NetCdfVariable[] = [];

  while (pos + 8 <= bytes.length) {
    const tag = readBEInt32(view, pos);
    pos += 4;
    const len = readBEInt32(view, pos);
    pos += 4;
    const record = bytes.subarray(pos, pos + len);
    pos += len;

    if (tag === NC_DIMENSION) {
      dimensions.push(parseDimensionRecord(record));
    } else if (tag === NC_VARIABLE) {
      variables.push(parseVariableRecord(record));
    } else if (tag === NC_ATTRIBUTE) {
      // global attribute — already consumed via len
    } else if (tag === 0) {
      break;
    }
  }

  const imageVar = pickImageVariable(variables);
  if (!imageVar) {
    throw new Error('No image variable found in MINC / NetCDF file');
  }

  const { data, dims, warnings: readWarnings } = readVolumeFromVariable(bytes, imageVar, dimensions);
  warnings.push(...readWarnings);

  const dimNames = imageVar.dimIds.map((id) => dimensions[id]?.name ?? `dim${id}`);
  const { min: dataMin, max: dataMax } = minMaxVolume(data);

  const header: MincHeaderInfo = {
    netcdfVersion: version,
    dimensions: dimensions.map((d) => ({ name: d.name, size: d.size })),
    variableName: imageVar.name,
    variableType: imageVar.type,
    dimNames,
    notes: [
      'MINC 1 / NetCDF classic preview — education/research only.',
      dimNames.length ? `Image dims: ${dimNames.join(', ')}` : 'Image dimensions parsed from NetCDF'
    ]
  };

  return {
    header,
    dims,
    voxelSize: [1, 1, 1],
    data,
    dataMin,
    dataMax,
    warnings,
    compressedSource: false
  };
}
