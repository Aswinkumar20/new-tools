import { ungzip } from 'pako';
import type { NrrdHeaderInfo, NrrdParsedVolume } from '../types/nrrd-viewer.types';
import { minMaxVolume } from './volume-slice.utils';

const NRRD_MAGIC = 'NRRD';

interface NrrdHeaderFields {
  type: string;
  dimension: number;
  sizes: number[];
  spacings: number[];
  endian: 'little' | 'big';
  encoding: string;
  space: string;
  dataFile: string | null;
  raw: Record<string, string>;
}

function trimValue(value: string): string {
  return value.trim();
}

function parseHeaderText(text: string): NrrdHeaderFields {
  const lines = text.split(/\r?\n/);
  if (!lines[0]?.startsWith(NRRD_MAGIC)) {
    throw new Error('Missing NRRD magic (expected NRRD0004 or similar)');
  }

  const raw: Record<string, string> = {};
  let dataFile: string | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) break;
    if (line.startsWith('#')) continue;

    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    let value = line.slice(sep + 1).trim();
    if (value.startsWith('=')) {
      value = value.slice(1).trim();
    }
    raw[key] = value;
    if (key === 'data file') {
      dataFile = value.replace(/^\s+|\s+$/g, '');
    }
  }

  const dimension = Math.max(1, Number(raw['dimension'] || '3') || 3);
  const sizes = (raw['sizes'] || '1 1 1')
    .split(/\s+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
  while (sizes.length < dimension) {
    sizes.push(1);
  }

  const spacingsSource = raw['spacings'] || '1 1 1';
  const spacings = spacingsSource
    .split(/\s+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
  const defaultSpacings: number[] = [];
  for (let i = 0; i < dimension; i++) {
    defaultSpacings.push(spacings[i] ?? 1);
  }

  const endianRaw = (raw['endian'] || 'little').toLowerCase();
  const endian: 'little' | 'big' = endianRaw.startsWith('big') ? 'big' : 'little';

  return {
    type: (raw['type'] || 'float').toLowerCase(),
    dimension,
    sizes: sizes.slice(0, dimension),
    spacings: defaultSpacings,
    endian,
    encoding: (raw['encoding'] || 'raw').toLowerCase(),
    space: raw['space'] || '',
    dataFile,
    raw
  };
}

function elementSize(type: string): number {
  switch (type) {
    case 'uchar':
    case 'int8':
    case 'uint8':
      return 1;
    case 'short':
    case 'ushort':
    case 'int16':
    case 'uint16':
      return 2;
    case 'int':
    case 'uint':
    case 'int32':
    case 'uint32':
    case 'float':
      return 4;
    case 'double':
      return 8;
    case 'longlong':
    case 'ulonglong':
    case 'int64':
    case 'uint64':
      return 8;
    default:
      return 0;
  }
}

function readTypedArray(
  bytes: Uint8Array,
  offset: number,
  count: number,
  type: string,
  littleEndian: boolean
): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(count);
  const le = littleEndian;

  if (type === 'uchar' || type === 'uint8') {
    for (let i = 0; i < count; i++) {
      out[i] = view.getUint8(offset + i);
    }
  } else if (type === 'int8') {
    for (let i = 0; i < count; i++) {
      out[i] = view.getInt8(offset + i);
    }
  } else if (type === 'short' || type === 'int16') {
    for (let i = 0; i < count; i++) {
      out[i] = view.getInt16(offset + i * 2, le);
    }
  } else if (type === 'ushort' || type === 'uint16') {
    for (let i = 0; i < count; i++) {
      out[i] = view.getUint16(offset + i * 2, le);
    }
  } else if (type === 'int' || type === 'int32') {
    for (let i = 0; i < count; i++) {
      out[i] = view.getInt32(offset + i * 4, le);
    }
  } else if (type === 'uint' || type === 'uint32') {
    for (let i = 0; i < count; i++) {
      out[i] = view.getUint32(offset + i * 4, le);
    }
  } else if (type === 'float') {
    for (let i = 0; i < count; i++) {
      out[i] = view.getFloat32(offset + i * 4, le);
    }
  } else if (type === 'double') {
    for (let i = 0; i < count; i++) {
      out[i] = view.getFloat64(offset + i * 8, le);
    }
  } else {
    throw new Error(`Unsupported NRRD type "${type}"`);
  }
  return out;
}

function splitHeaderAndData(bytes: Uint8Array): { headerText: string; dataOffset: number } {
  // Header ends at first blank line after magic
  let headerEnd = -1;
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0x0a && bytes[i + 1] === 0x0a) {
      headerEnd = i + 2;
      break;
    }
    if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a && bytes[i + 2] === 0x0d && bytes[i + 3] === 0x0a) {
      headerEnd = i + 4;
      break;
    }
  }
  if (headerEnd < 0) {
    throw new Error('NRRD header terminator (blank line) not found');
  }
  const headerText = new TextDecoder('utf-8').decode(bytes.subarray(0, headerEnd));
  return { headerText, dataOffset: headerEnd };
}

export function parseNrrdBytes(input: Uint8Array): NrrdParsedVolume {
  const warnings: string[] = [];
  const { headerText, dataOffset } = splitHeaderAndData(input);
  const fields = parseHeaderText(headerText);

  if (fields.dataFile && fields.dataFile !== 'LOCAL') {
    warnings.push(
      `Detached data file "${fields.dataFile}" — upload the companion raw file or use attached NRRD.`
    );
    throw new Error(`Detached NRRD data file not loaded (${fields.dataFile})`);
  }

  const elSize = elementSize(fields.type);
  if (!elSize) {
    throw new Error(`Unsupported NRRD type "${fields.type}"`);
  }

  let payload = input.subarray(dataOffset);
  let compressedSource = false;

  if (fields.encoding === 'gzip' || fields.encoding === 'gz') {
    try {
      payload = ungzip(payload);
      compressedSource = true;
    } catch {
      throw new Error('Failed to gunzip NRRD payload');
    }
  } else if (fields.encoding !== 'raw') {
    warnings.push(`Encoding "${fields.encoding}" may not be fully supported — attempting raw read.`);
  }

  const dim = fields.dimension;
  if (dim > 3) {
    warnings.push(`${dim}D data truncated to first 3 dimensions for slice preview.`);
  }

  const nx = Math.max(1, fields.sizes[0] || 1);
  const ny = Math.max(1, fields.sizes[1] || 1);
  const nz = Math.max(1, fields.sizes[2] || 1);
  const count = nx * ny * nz;

  if (payload.length < count * elSize) {
    throw new Error('NRRD data payload is truncated');
  }

  const data = readTypedArray(payload, 0, count, fields.type, fields.endian === 'little');
  const { min: dataMin, max: dataMax } = minMaxVolume(data);

  const header: NrrdHeaderInfo = {
    magic: headerText.split('\n')[0]?.trim() || 'NRRD',
    type: fields.type,
    dimension: fields.dimension,
    sizes: [...fields.sizes],
    spacings: [...fields.spacings],
    endian: fields.endian,
    encoding: fields.encoding,
    space: fields.space,
    rawFields: fields.raw
  };

  const voxelSize: [number, number, number] = [
    fields.spacings[0] ?? 1,
    fields.spacings[1] ?? 1,
    fields.spacings[2] ?? 1
  ];

  return {
    header,
    dims: [nx, ny, nz],
    voxelSize,
    data,
    dataMin,
    dataMax,
    warnings,
    compressedSource
  };
}
