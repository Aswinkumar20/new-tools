import { SEGY_MAX_SAMPLES, SEGY_MAX_TRACES } from '../constants/seg-y-viewer.constants';
import type {
  ParsedSegy,
  SegySampleFormat,
  SegyTextCard,
  SegyTraceHeader
} from '../types/seg-y-viewer.types';

const EBCDIC: number[] = [
  0, 1, 2, 3, 156, 9, 134, 127, 151, 141, 142, 11, 12, 13, 14, 15, 16, 17, 18, 19, 157, 133, 8, 135, 24, 25, 146, 143,
  28, 29, 30, 31, 128, 129, 130, 131, 132, 10, 23, 27, 136, 137, 138, 139, 140, 5, 6, 7, 144, 145, 22, 147, 148, 149,
  150, 4, 152, 153, 154, 155, 20, 21, 158, 26, 32, 160, 161, 162, 163, 164, 165, 166, 167, 168, 91, 46, 60, 40, 43, 33,
  38, 169, 170, 171, 172, 173, 174, 175, 176, 177, 93, 36, 42, 41, 59, 94, 45, 47, 178, 179, 180, 181, 182, 183, 184,
  185, 124, 44, 37, 95, 62, 63, 186, 187, 188, 189, 190, 191, 192, 193, 194, 96, 58, 35, 64, 39, 61, 34, 195, 97, 98,
  99, 100, 101, 102, 103, 104, 105, 196, 197, 198, 199, 200, 201, 202, 106, 107, 108, 109, 110, 111, 112, 113, 114, 203,
  204, 205, 206, 207, 208, 209, 126, 115, 116, 117, 118, 119, 120, 121, 122, 210, 211, 212, 213, 214, 215, 216, 217,
  218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 123, 65, 66, 67, 68, 69, 70, 71, 72, 73, 232,
  233, 234, 235, 236, 237, 125, 74, 75, 76, 77, 78, 79, 80, 81, 82, 238, 239, 240, 241, 242, 243, 92, 159, 83, 84, 85,
  86, 87, 88, 89, 90, 244, 245, 246, 247, 248, 249, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 250, 251, 252, 253, 254, 255
];

function decodeEbcdic(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(EBCDIC[bytes[i]] ?? 32);
  return out;
}

function printableRatio(text: string): number {
  if (!text.length) return 0;
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10 || c === 13 || c === 9 || (c >= 32 && c < 127)) n += 1;
  }
  return n / text.length;
}

function decodeTextHeader(bytes: Uint8Array): { text: string; encoding: 'ascii' | 'ebcdic'; cards: SegyTextCard[] } {
  const ascii = new TextDecoder('latin1').decode(bytes);
  const ebcdic = decodeEbcdic(bytes);
  const encoding: 'ascii' | 'ebcdic' = printableRatio(ascii) >= printableRatio(ebcdic) ? 'ascii' : 'ebcdic';
  const text = encoding === 'ascii' ? ascii : ebcdic;
  const cards: SegyTextCard[] = [];
  for (let i = 0; i < 40; i++) {
    const line = text.slice(i * 80, (i + 1) * 80).trimEnd();
    if (line) cards.push({ index: i + 1, text: line });
  }
  return { text, encoding, cards };
}

function readI16(bytes: Uint8Array, offset: number, le: boolean): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getInt16(0, le);
}

function readI32(bytes: Uint8Array, offset: number, le: boolean): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getInt32(0, le);
}

function ibmToNumber(u32: number): number {
  if (!u32) return 0;
  const sign = u32 >>> 31 ? -1 : 1;
  const exp = ((u32 >>> 24) & 0x7f) - 64;
  const frac = (u32 & 0x00ffffff) / 0x1000000;
  return sign * frac * Math.pow(16, exp);
}

function formatFromCode(code: number): { kind: SegySampleFormat; bytes: number } {
  if (code === 1) return { kind: 'ibm-f32', bytes: 4 };
  if (code === 2) return { kind: 'i32', bytes: 4 };
  if (code === 3) return { kind: 'i16', bytes: 2 };
  if (code === 5) return { kind: 'ieee-f32', bytes: 4 };
  if (code === 8) return { kind: 'i8', bytes: 1 };
  return { kind: 'unsupported', bytes: 0 };
}

function readSample(bytes: Uint8Array, offset: number, kind: SegySampleFormat, le: boolean): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
  if (kind === 'ieee-f32') return view.getFloat32(0, le);
  if (kind === 'i32') return view.getInt32(0, le);
  if (kind === 'i16') return view.getInt16(0, le);
  if (kind === 'i8') return view.getInt8(0);
  if (kind === 'ibm-f32') return ibmToNumber(view.getUint32(0, false));
  return Number.NaN;
}

export function parseSegyBytes(bytes: Uint8Array): ParsedSegy {
  const warnings: string[] = [];
  if (!bytes.length) throw new Error('File is empty');
  if (bytes.length < 3600) throw new Error('Not a SEG-Y file — need at least 3600 header bytes.');

  const { text, encoding, cards } = decodeTextHeader(bytes.subarray(0, 3200));
  let littleEndian = false;
  let dtUs = readI16(bytes, 3216, false);
  let samplesPerTrace = readI16(bytes, 3220, false);
  let formatCode = readI16(bytes, 3224, false);
  let jobId = readI32(bytes, 3200, false);
  let revisionWord = readI16(bytes, 3500, false);

  const looksBad =
    samplesPerTrace <= 0 ||
    samplesPerTrace > 100_000 ||
    formatCode < 1 ||
    formatCode > 8 ||
    dtUs < 0;

  if (looksBad) {
    const dtLe = readI16(bytes, 3216, true);
    const nsLe = readI16(bytes, 3220, true);
    const fmtLe = readI16(bytes, 3224, true);
    if (nsLe > 0 && nsLe <= 100_000 && fmtLe >= 1 && fmtLe <= 8) {
      littleEndian = true;
      dtUs = dtLe;
      samplesPerTrace = nsLe;
      formatCode = fmtLe;
      jobId = readI32(bytes, 3200, true);
      revisionWord = readI16(bytes, 3500, true);
      warnings.push('Binary header looks little-endian — parsed as PC SEG-Y.');
    }
  }

  if (bytes.length >= 3840) {
    const thNs = readI16(bytes, 3600 + 114, littleEndian);
    if ((!samplesPerTrace || samplesPerTrace > 50_000) && thNs > 0 && thNs < 50_000) {
      samplesPerTrace = thNs;
      warnings.push('Sample count taken from the first trace header.');
    }
    const thDt = readI16(bytes, 3600 + 116, littleEndian);
    if ((!dtUs || dtUs < 0) && thDt > 0) dtUs = thDt;
  }

  const fmt = formatFromCode(formatCode);
  if (fmt.kind === 'unsupported') {
    warnings.push(`Sample format code ${formatCode} is not decoded — headers only.`);
  }
  if (formatCode === 1) warnings.push('IBM 32-bit floats were converted for preview.');

  const revision = revisionWord === 0x0100 || revisionWord === 1 ? '1.0' : revisionWord === 0x0200 || revisionWord === 2 ? '2.0' : revisionWord ? String(revisionWord) : '0';

  let previewSamples = Math.max(1, samplesPerTrace || 1);
  if (previewSamples > SEGY_MAX_SAMPLES) {
    previewSamples = SEGY_MAX_SAMPLES;
    warnings.push(`Only the first ${SEGY_MAX_SAMPLES} samples per trace are previewed.`);
  }

  const bytesPerSample = fmt.bytes || 4;
  const traceStride = 240 + Math.max(1, samplesPerTrace) * (fmt.bytes || 0);
  let traceCount = fmt.kind === 'unsupported' || !fmt.bytes ? 0 : Math.floor((bytes.length - 3600) / traceStride);
  if (traceCount < 0) traceCount = 0;
  if (fmt.kind !== 'unsupported' && (bytes.length - 3600) % traceStride !== 0) {
    warnings.push('Trailing bytes after the last complete trace were ignored.');
  }

  let previewTraces = traceCount;
  if (previewTraces > SEGY_MAX_TRACES) {
    previewTraces = SEGY_MAX_TRACES;
    warnings.push(`Only the first ${SEGY_MAX_TRACES} traces are previewed.`);
  }

  const traces: SegyTraceHeader[] = [];
  const amplitudes = new Float32Array(previewTraces * previewSamples);
  let minAmp = Infinity;
  let maxAmp = -Infinity;
  let sumSq = 0;
  let ampCount = 0;

  for (let t = 0; t < previewTraces; t++) {
    const offset = 3600 + t * traceStride;
    const header: SegyTraceHeader = {
      index: t,
      offset,
      seqLine: readI32(bytes, offset, littleEndian),
      fieldRecord: readI32(bytes, offset + 8, littleEndian),
      cdp: readI32(bytes, offset + 20, littleEndian),
      inline: readI32(bytes, offset + 188, littleEndian),
      xline: readI32(bytes, offset + 192, littleEndian),
      sourceX: readI32(bytes, offset + 72, littleEndian),
      sourceY: readI32(bytes, offset + 76, littleEndian),
      groupX: readI32(bytes, offset + 80, littleEndian),
      groupY: readI32(bytes, offset + 84, littleEndian),
      samples: readI16(bytes, offset + 114, littleEndian) || samplesPerTrace,
      dtUs: readI16(bytes, offset + 116, littleEndian) || dtUs
    };
    traces.push(header);
    if (fmt.kind === 'unsupported') continue;
    for (let s = 0; s < previewSamples; s++) {
      const v = readSample(bytes, offset + 240 + s * bytesPerSample, fmt.kind, littleEndian);
      amplitudes[t * previewSamples + s] = v;
      if (!Number.isFinite(v)) continue;
      if (v < minAmp) minAmp = v;
      if (v > maxAmp) maxAmp = v;
      sumSq += v * v;
      ampCount += 1;
    }
  }

  if (!Number.isFinite(minAmp)) {
    minAmp = 0;
    maxAmp = 0;
  }
  if (!previewTraces) warnings.push('No traces decoded — check format code and sample interval.');

  return {
    textEncoding: encoding,
    textHeader: text,
    cards,
    littleEndian,
    sampleFormat: fmt.kind,
    formatCode,
    revision,
    dtUs: dtUs || 0,
    samplesPerTrace,
    bytesPerSample: fmt.bytes,
    traceCount,
    previewTraces,
    previewSamples,
    jobId,
    traces,
    amplitudes,
    minAmp,
    maxAmp,
    rmsAmp: ampCount ? Math.sqrt(sumSq / ampCount) : 0,
    warnings
  };
}
