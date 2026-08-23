import type { GribMessageField, GribParsedFile } from '../types/grib-viewer.types';
import { minMaxVolume } from './volume-slice.utils';

const PARAM_NAMES: Record<string, string> = {
  '0:0': 'Temperature',
  '0:2': 'U component of wind',
  '0:3': 'V component of wind',
  '0:6': 'Geopotential height',
  '0:7': 'Geopotential',
  '0:10': 'Total column water',
  '0:61': 'Total precipitation'
};

function readU1(bytes: Uint8Array, pos: number): number {
  return bytes[pos];
}

function readU2(bytes: Uint8Array, pos: number): number {
  return (bytes[pos] << 8) | bytes[pos + 1];
}

function readU4(bytes: Uint8Array, pos: number): number {
  return (
    ((bytes[pos] << 24) >>> 0) |
    (bytes[pos + 1] << 16) |
    (bytes[pos + 2] << 8) |
    bytes[pos + 3]
  );
}

function readI4(bytes: Uint8Array, pos: number): number {
  const v = readU4(bytes, pos);
  return v > 0x7fffffff ? v - 0x100000000 : v;
}

function readF4(bytes: Uint8Array, pos: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getFloat32(0, false);
}

function parameterName(category: number, parameterNumber: number): string {
  return PARAM_NAMES[`${category}:${parameterNumber}`] ?? `param ${category}.${parameterNumber}`;
}

function parseSection(bytes: Uint8Array, pos: number): { num: number; len: number; body: Uint8Array; next: number } | null {
  if (pos + 5 > bytes.length) return null;
  const len = readU4(bytes, pos);
  if (len < 5) return null;
  const num = readU1(bytes, pos + 4);
  const body = bytes.subarray(pos + 5, pos + len);
  return { num, len, body, next: pos + len };
}

function parseGridTemplate30(body: Uint8Array): {
  ni: number;
  nj: number;
  lat1: number;
  lon1: number;
  lat2: number;
  lon2: number;
} {
  const count = readU4(body, 2);
  const lat1 = readI4(body, 6) / 1000;
  const lon1 = readU4(body, 10) / 1000;
  const lat2 = readI4(body, 15) / 1000;
  const lon2 = readU4(body, 19) / 1000;
  const di = readU4(body, 23) / 1000;
  const dj = readU4(body, 27) / 1000;
  let ni = Math.max(1, Math.round(Math.abs(lon2 - lon1) / Math.max(di, 1e-6)) + 1);
  let nj = Math.max(1, Math.round(Math.abs(lat2 - lat1) / Math.max(dj, 1e-6)) + 1);
  if (count > 0) {
    if (ni * nj !== count) {
      const root = Math.round(Math.sqrt(count));
      if (root * root === count) {
        ni = root;
        nj = root;
      } else if (count % ni === 0) {
        nj = count / ni;
      } else {
        ni = count;
        nj = 1;
      }
    }
  }
  return { ni, nj, lat1, lon1, lat2, lon2 };
}

function parseProductTemplate40(body: Uint8Array): {
  category: number;
  parameterNumber: number;
  levelType: number;
  levelValue: number;
} {
  const category = readU1(body, 2);
  const parameterNumber = readU1(body, 3);
  const levelType = readU1(body, 14);
  const levelValue = readI4(body, 15) / 100;
  return { category, parameterNumber, levelType, levelValue };
}

function readGrib2Message(bytes: Uint8Array, start: number, index: number, warnings: string[]): GribMessageField | null {
  if (readAscii(bytes, start, 4) !== 'GRIB') return null;
  const discipline = readU1(bytes, start + 6);
  const edition = readU1(bytes, start + 7);
  if (edition !== 2) {
    warnings.push(`Message ${index}: GRIB edition ${edition} not supported (GRIB2 only).`);
    return null;
  }

  let pos = start + 16;
  let category = 0;
  let parameterNumber = 0;
  let levelType = 0;
  let levelValue = 0;
  let ni = 0;
  let nj = 0;
  let lat1 = 0;
  let lon1 = 0;
  let lat2 = 0;
  let lon2 = 0;
  let dataTemplate = 0;
  let dataBytes: Uint8Array | null = null;

  while (pos + 5 <= bytes.length) {
    if (readAscii(bytes, pos, 4) === '7777') break;
    const sec = parseSection(bytes, pos);
    if (!sec) break;
    pos = sec.next;

    if (sec.num === 1) {
      // identification parsed via defaults
    } else if (sec.num === 3) {
      const template = readU2(sec.body, 0);
      if (template === 0) {
        const grid = parseGridTemplate30(sec.body);
        ni = grid.ni;
        nj = grid.nj;
        lat1 = grid.lat1;
        lon1 = grid.lon1;
        lat2 = grid.lat2;
        lon2 = grid.lon2;
      } else {
        warnings.push(`Message ${index}: grid template ${template} not fully decoded.`);
      }
    } else if (sec.num === 4) {
      const prod = parseProductTemplate40(sec.body);
      category = prod.category;
      parameterNumber = prod.parameterNumber;
      levelType = prod.levelType;
      levelValue = prod.levelValue;
    } else if (sec.num === 5) {
      dataTemplate = readU2(sec.body, 0);
    } else if (sec.num === 7) {
      dataBytes = sec.body;
    }
  }

  if (!dataBytes || !ni || !nj) {
    warnings.push(`Message ${index}: missing grid data.`);
    return null;
  }

  const count = ni * nj;
  const data = new Float32Array(count);
  if (dataTemplate === 4) {
    for (let i = 0; i < count; i++) {
      data[i] = readF4(dataBytes, i * 4);
    }
  } else if (dataTemplate === 0) {
    warnings.push(`Message ${index}: simple packing not decoded — use IEEE float GRIB2.`);
    return null;
  } else {
    warnings.push(`Message ${index}: data template ${dataTemplate} not supported.`);
    return null;
  }

  const { min: dataMin, max: dataMax } = minMaxVolume(data);
  return {
    index,
    discipline,
    category,
    parameterNumber,
    parameterName: parameterName(category, parameterNumber),
    levelType,
    levelValue,
    ni,
    nj,
    lat1,
    lon1,
    lat2,
    lon2,
    data,
    dataMin,
    dataMax,
    shape: [ni, nj]
  };
}

function readAscii(bytes: Uint8Array, pos: number, len: number): string {
  return new TextDecoder('ascii').decode(bytes.subarray(pos, pos + len));
}

function readGrib2MessageLength(bytes: Uint8Array, start: number): number {
  let length = 0;
  for (let i = 0; i < 8; i++) {
    length = length * 256 + bytes[start + 8 + i];
  }
  return length;
}

export function parseGribBytes(bytes: Uint8Array): GribParsedFile {
  const warnings: string[] = [];
  const messages: GribMessageField[] = [];
  let pos = 0;
  let index = 0;

  while (pos + 16 <= bytes.length) {
    if (readAscii(bytes, pos, 4) !== 'GRIB') {
      pos += 1;
      continue;
    }
    const messageLength = readGrib2MessageLength(bytes, pos);
    const msg = readGrib2Message(bytes, pos, index, warnings);
    if (msg) {
      messages.push(msg);
      index += 1;
    }
    if (messageLength > 16 && pos + messageLength <= bytes.length) {
      pos += messageLength;
    } else {
      let next = pos + 16;
      while (next + 4 <= bytes.length && readAscii(bytes, next, 4) !== '7777') {
        const sec = parseSection(bytes, next);
        if (!sec) break;
        next = sec.next;
      }
      pos = next + 4;
    }
  }

  if (!messages.length) {
    throw new Error('No GRIB2 messages decoded — GRIB1 and packed templates may be unsupported.');
  }

  const preview = messages[0];
  return {
    edition: 2,
    messages,
    defaultMessageIndex: 0,
    preview,
    warnings
  };
}

export function readGribMessage(bytes: Uint8Array, parsed: GribParsedFile, messageIndex: number): GribMessageField | null {
  return parsed.messages.find((m) => m.index === messageIndex) ?? null;
}
