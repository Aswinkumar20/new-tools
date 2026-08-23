import type { DicomMetadataRow, DicomParsedImage } from '../types/dicom-viewer.types';

const EXPLICIT_LE = '1.2.840.10008.1.2.1';
const IMPLICIT_LE = '1.2.840.10008.1.2';
const COMPRESSED_PREFIXES = [
  '1.2.840.10008.1.2.4', // JPEG / JPEG-LS / JPEG2000 family
  '1.2.840.10008.1.2.5', // RLE
  '1.2.840.10008.1.2.99'
];

const LONG_VR = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'OD', 'OL', 'UC', 'UR', 'OV']);

const TAG_KEYWORDS: Record<string, string> = {
  '0002,0010': 'TransferSyntaxUID',
  '0008,0060': 'Modality',
  '0008,0016': 'SOPClassUID',
  '0008,0018': 'SOPInstanceUID',
  '0008,0070': 'Manufacturer',
  '0010,0010': 'PatientName',
  '0010,0020': 'PatientID',
  '0008,103E': 'SeriesDescription',
  '0018,1030': 'ProtocolName',
  '0020,000D': 'StudyInstanceUID',
  '0020,000E': 'SeriesInstanceUID',
  '0020,0062': 'ImageLaterality',
  '0018,5101': 'ViewPosition',
  '0054,1001': 'Units',
  '0020,0032': 'ImagePositionPatient',
  '0028,0002': 'SamplesPerPixel',
  '0028,0004': 'PhotometricInterpretation',
  '0028,0008': 'NumberOfFrames',
  '0028,0010': 'Rows',
  '0028,0011': 'Columns',
  '0028,0030': 'PixelSpacing',
  '0028,0100': 'BitsAllocated',
  '0028,0101': 'BitsStored',
  '0028,0102': 'HighBit',
  '0028,0103': 'PixelRepresentation',
  '0028,1050': 'WindowCenter',
  '0028,1051': 'WindowWidth',
  '0028,1052': 'RescaleIntercept',
  '0028,1053': 'RescaleSlope',
  '7FE0,0010': 'PixelData'
};

interface RawElement {
  group: number;
  element: number;
  vr: string;
  value: Uint8Array;
}

function tagKey(group: number, element: number): string {
  return `${group.toString(16).padStart(4, '0').toUpperCase()},${element
    .toString(16)
    .padStart(4, '0')
    .toUpperCase()}`;
}

function readAscii(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out.trim();
}

function readU16LE(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readU32LE(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function parseDsMulti(text: string): number[] {
  return text
    .split('\\')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n));
}

function firstDs(text: string, fallback: number | null): number | null {
  const parts = parseDsMulti(text);
  return parts.length ? parts[0] : fallback;
}

function isCompressedTransferSyntax(uid: string): boolean {
  const u = uid.trim();
  if (!u || u === EXPLICIT_LE || u === IMPLICIT_LE || u === '1.2.840.10008.1.2.2') {
    return false;
  }
  return COMPRESSED_PREFIXES.some((p) => u.indexOf(p) === 0) || u.indexOf('1.2.840.10008.1.2.4') === 0;
}

function hasDicmPreamble(bytes: Uint8Array): boolean {
  if (bytes.length < 132) return false;
  return (
    bytes[128] === 0x44 &&
    bytes[129] === 0x49 &&
    bytes[130] === 0x43 &&
    bytes[131] === 0x4d
  );
}

function decodeElementValue(el: RawElement): string {
  const vr = el.vr;
  const v = el.value;
  if (!v.length) return '';
  if (vr === 'US' && v.length >= 2) {
    return String(new DataView(v.buffer, v.byteOffset, v.byteLength).getUint16(0, true));
  }
  if (vr === 'SS' && v.length >= 2) {
    return String(new DataView(v.buffer, v.byteOffset, v.byteLength).getInt16(0, true));
  }
  if (vr === 'UL' && v.length >= 4) {
    return String(new DataView(v.buffer, v.byteOffset, v.byteLength).getUint32(0, true));
  }
  if (vr === 'SL' && v.length >= 4) {
    return String(new DataView(v.buffer, v.byteOffset, v.byteLength).getInt32(0, true));
  }
  if (vr === 'FL' && v.length >= 4) {
    return String(new DataView(v.buffer, v.byteOffset, v.byteLength).getFloat32(0, true));
  }
  if (vr === 'FD' && v.length >= 8) {
    return String(new DataView(v.buffer, v.byteOffset, v.byteLength).getFloat64(0, true));
  }
  if (vr === 'OB' || vr === 'OW' || vr === 'OF' || vr === 'UN') {
    return `<${v.length} bytes>`;
  }
  return readAscii(v);
}

function readExplicitElements(bytes: Uint8Array, start: number): RawElement[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const elements: RawElement[] = [];
  let offset = start;

  while (offset + 8 <= bytes.length) {
    const group = readU16LE(view, offset);
    const element = readU16LE(view, offset + 2);
    offset += 4;

    if (offset + 2 > bytes.length) break;
    const vr = String.fromCharCode(bytes[offset], bytes[offset + 1]);
    offset += 2;

    let length: number;
    if (LONG_VR.has(vr)) {
      if (offset + 6 > bytes.length) break;
      offset += 2; // reserved
      length = readU32LE(view, offset);
      offset += 4;
    } else {
      if (offset + 2 > bytes.length) break;
      length = readU16LE(view, offset);
      offset += 2;
    }

    if (length === 0xffffffff) {
      // Undefined length — stop (SQ / encapsulated pixel data)
      break;
    }
    if (offset + length > bytes.length) {
      break;
    }
    const value = bytes.subarray(offset, offset + length);
    offset += length;
    elements.push({ group, element, vr, value });

    if (group === 0x7fe0 && element === 0x0010) {
      break;
    }
  }
  return elements;
}

/** Best-effort Implicit VR Little Endian (no VR in stream). */
function readImplicitElements(bytes: Uint8Array, start: number): RawElement[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const elements: RawElement[] = [];
  let offset = start;
  const knownLengths: Record<string, number> = {
    '0028,0010': 2,
    '0028,0011': 2,
    '0028,0100': 2,
    '0028,0101': 2,
    '0028,0102': 2,
    '0028,0103': 2,
    '0028,0002': 2
  };

  while (offset + 8 <= bytes.length) {
    const group = readU16LE(view, offset);
    const element = readU16LE(view, offset + 2);
    const length = readU32LE(view, offset + 4);
    offset += 8;
    if (length === 0xffffffff || offset + length > bytes.length) {
      break;
    }
    const key = tagKey(group, element);
    const value = bytes.subarray(offset, offset + length);
    offset += length;
    let vr = 'UN';
    if (knownLengths[key] === 2) vr = 'US';
    else if (key === '7FE0,0010') vr = length % 2 === 0 ? 'OW' : 'OB';
    else vr = 'LO';
    elements.push({ group, element, vr, value });
    if (group === 0x7fe0 && element === 0x0010) break;
  }
  return elements;
}

function findElement(elements: RawElement[], group: number, element: number): RawElement | undefined {
  return elements.find((el) => el.group === group && el.element === element);
}

function extractPixels(
  pixelData: Uint8Array,
  rows: number,
  columns: number,
  bitsAllocated: number,
  pixelRepresentation: number,
  samplesPerPixel: number,
  frames: number
): Float32Array {
  const plane = rows * columns;
  const frameCount = Math.max(1, frames);
  const sampleCount = Math.max(1, samplesPerPixel);
  const out = new Float32Array(plane * frameCount);
  const view = new DataView(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength);

  if (bitsAllocated === 8) {
    const signed = pixelRepresentation === 1;
    for (let f = 0; f < frameCount; f++) {
      const frameOffset = f * plane * sampleCount;
      for (let i = 0; i < plane; i++) {
        const src = frameOffset + i;
        if (src >= pixelData.length) break;
        out[f * plane + i] = signed ? view.getInt8(src) : pixelData[src];
      }
    }
    return out;
  }

  if (bitsAllocated === 16) {
    const signed = pixelRepresentation === 1;
    const maxSamples = Math.floor(pixelData.length / 2);
    for (let f = 0; f < frameCount; f++) {
      const frameOffset = f * plane * sampleCount;
      for (let i = 0; i < plane; i++) {
        const src = frameOffset + i;
        if (src >= maxSamples) break;
        out[f * plane + i] = signed
          ? view.getInt16(src * 2, true)
          : view.getUint16(src * 2, true);
      }
    }
    return out;
  }

  // Fallback: treat as bytes
  const total = plane * frameCount * sampleCount;
  for (let i = 0; i < plane * frameCount && i < pixelData.length && i < total; i++) {
    out[i] = pixelData[i];
  }
  return out;
}

/** Return one frame plane from parsed multi-frame pixel buffer. */
export function getDicomFramePixels(parsed: DicomParsedImage, frameIndex: number): Float32Array {
  const plane = parsed.rows * parsed.columns;
  if (plane <= 0 || !parsed.pixels.length) {
    return new Float32Array(0);
  }
  const maxFrame = Math.max(1, parsed.numberOfFrames);
  const clamped = Math.max(0, Math.min(frameIndex, maxFrame - 1));
  const start = clamped * plane;
  if (parsed.pixels.length >= start + plane) {
    return parsed.pixels.subarray(start, start + plane);
  }
  return parsed.pixels.subarray(0, Math.min(plane, parsed.pixels.length));
}

export function parseDicomBytes(bytes: Uint8Array): DicomParsedImage {
  const warnings: string[] = [];
  if (!bytes?.length) {
    throw new Error('Empty DICOM buffer');
  }

  const hasPreamble = hasDicmPreamble(bytes);
  if (!hasPreamble && bytes.length > 132) {
    warnings.push('Missing DICM preamble — attempting best-effort parse.');
  }

  let start = hasPreamble ? 132 : 0;
  // Some files omit preamble but start at group 0002/0008
  if (!hasPreamble && bytes.length >= 2) {
    const g0 = bytes[0] | (bytes[1] << 8);
    if (g0 !== 0x0002 && g0 !== 0x0008) {
      start = 0;
    }
  }

  let elements = readExplicitElements(bytes, start);
  let transferSyntax = '';
  const tsEl = findElement(elements, 0x0002, 0x0010);
  if (tsEl) {
    transferSyntax = readAscii(tsEl.value);
  }

  if (elements.length < 3 || (!findElement(elements, 0x7fe0, 0x0010) && !findElement(elements, 0x0028, 0x0010))) {
    warnings.push('Explicit VR parse incomplete — trying Implicit VR Little Endian.');
    elements = readImplicitElements(bytes, start);
    if (!transferSyntax) {
      transferSyntax = IMPLICIT_LE;
    }
  }

  if (!transferSyntax) {
    transferSyntax = EXPLICIT_LE;
  }

  const compressed = isCompressedTransferSyntax(transferSyntax);
  if (compressed) {
    warnings.push(
      `Compressed transfer syntax (${transferSyntax}) is not decoded in this viewer. Export metadata only or convert to Explicit VR LE.`
    );
  }

  const getStr = (g: number, e: number, fallback = ''): string => {
    const el = findElement(elements, g, e);
    return el ? decodeElementValue(el) : fallback;
  };
  const getU16 = (g: number, e: number, fallback: number): number => {
    const el = findElement(elements, g, e);
    if (!el || el.value.length < 2) return fallback;
    return new DataView(el.value.buffer, el.value.byteOffset, el.value.byteLength).getUint16(0, true);
  };

  const rows = getU16(0x0028, 0x0010, 0);
  const columns = getU16(0x0028, 0x0011, 0);
  const bitsAllocated = getU16(0x0028, 0x0100, 16);
  const bitsStored = getU16(0x0028, 0x0101, bitsAllocated);
  const highBit = getU16(0x0028, 0x0102, Math.max(0, bitsStored - 1));
  const pixelRepresentation = getU16(0x0028, 0x0103, 0);
  const samplesPerPixel = getU16(0x0028, 0x0002, 1);
  const photometric = getStr(0x0028, 0x0004, 'MONOCHROME2').toUpperCase();
  const framesText = getStr(0x0028, 0x0008, '1');
  const numberOfFrames = Math.max(1, Number(framesText) || 1);

  const slope = firstDs(getStr(0x0028, 0x1053, '1'), 1) ?? 1;
  const intercept = firstDs(getStr(0x0028, 0x1052, '0'), 0) ?? 0;
  const windowCenter = firstDs(getStr(0x0028, 0x1050, ''), null);
  const windowWidth = firstDs(getStr(0x0028, 0x1051, ''), null);

  if (windowCenter == null || windowWidth == null) {
    warnings.push('Window Center/Width missing — using data min/max for display.');
  }

  if (photometric.indexOf('MONOCHROME') !== 0 && photometric !== 'MONOCHROME1' && photometric !== 'MONOCHROME2') {
    warnings.push(
      `PhotometricInterpretation ${photometric} has limited support (grayscale path used when possible).`
    );
  }

  if (pixelRepresentation === 1) {
    warnings.push('Signed pixel data detected — values are interpreted as signed.');
  }

  const instanceRaw = getStr(0x0020, 0x0013, '');
  const instanceNumber = instanceRaw ? Number(instanceRaw) : null;

  const spacingParts = parseDsMulti(getStr(0x0028, 0x0030, ''));
  const pixelSpacing: [number, number] | null =
    spacingParts.length >= 2 ? [spacingParts[0], spacingParts[1]] : null;

  const ippParts = parseDsMulti(getStr(0x0020, 0x0032, ''));
  const imagePositionPatient: [number, number, number] | null =
    ippParts.length >= 3 ? [ippParts[0], ippParts[1], ippParts[2]] : null;

  const seriesDescription = getStr(0x0008, 0x103e, '');
  const protocolName = getStr(0x0018, 0x1030, '');
  const viewPosition = getStr(0x0018, 0x5101, '');
  const imageLaterality = getStr(0x0020, 0x0062, '');
  const units = getStr(0x0054, 0x1001, '');

  const metadataRows: DicomMetadataRow[] = [];
  for (const el of elements) {
    const key = tagKey(el.group, el.element);
    const keyword = TAG_KEYWORDS[key] ?? `Tag${key}`;
    metadataRows.push({
      keyword,
      tag: `(${key})`,
      value: decodeElementValue(el)
    });
  }

  let pixels = new Float32Array(0);
  const pixelEl = findElement(elements, 0x7fe0, 0x0010);
  if (!compressed && pixelEl && rows > 0 && columns > 0) {
    const extracted = extractPixels(
      pixelEl.value,
      rows,
      columns,
      bitsAllocated,
      pixelRepresentation,
      samplesPerPixel,
      numberOfFrames
    );
    pixels = new Float32Array(extracted);
    if (photometric === 'MONOCHROME1') {
      // Invert stored values for display convention later via invert flag preference;
      // leave raw; UI invert covers MONOCHROME1 when applied as default.
    }
  } else if (!compressed && (!rows || !columns)) {
    throw new Error('DICOM image geometry (Rows/Columns) is missing');
  } else if (!compressed && !pixelEl) {
    throw new Error('Pixel Data (7FE0,0010) not found');
  }

  return {
    rows,
    columns,
    bitsAllocated,
    bitsStored,
    highBit,
    pixelRepresentation,
    samplesPerPixel,
    photometricInterpretation: photometric,
    rescaleSlope: slope,
    rescaleIntercept: intercept,
    windowCenter,
    windowWidth,
    numberOfFrames,
    transferSyntaxUid: transferSyntax,
    patientName: getStr(0x0010, 0x0010, ''),
    patientId: getStr(0x0010, 0x0020, ''),
    modality: getStr(0x0008, 0x0060, ''),
    studyInstanceUid: getStr(0x0020, 0x000d, ''),
    seriesInstanceUid: getStr(0x0020, 0x000e, ''),
    sopInstanceUid: getStr(0x0008, 0x0018, ''),
    instanceNumber: Number.isFinite(instanceNumber as number) ? (instanceNumber as number) : null,
    pixelSpacing,
    imagePositionPatient,
    seriesDescription,
    protocolName,
    viewPosition,
    imageLaterality,
    units,
    pixels,
    metadataRows,
    warnings,
    compressed
  };
}

export function hasDicomMagic(bytes: Uint8Array): boolean {
  return hasDicmPreamble(bytes);
}
