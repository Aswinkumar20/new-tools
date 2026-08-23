import type {
  FitsHdu,
  FitsHduPreview,
  FitsHeaderCard,
  FitsParsedFile,
  FitsWcsInfo
} from '../types/fits-viewer.types';
import { minMaxVolume } from './volume-slice.utils';

const HEADER_BLOCK = 2880;
const CARD_LEN = 80;

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return new TextDecoder('ascii').decode(bytes.subarray(offset, offset + length));
}

function parseCard(line: string): FitsHeaderCard {
  const keyword = line.slice(0, 8).trim();
  const rest = line.slice(8).trim();
  if (!rest.startsWith('=')) {
    return { keyword, value: '', comment: rest };
  }
  const valuePart = rest.slice(1).trim();
  const slash = valuePart.indexOf('/');
  const rawValue = slash >= 0 ? valuePart.slice(0, slash).trim() : valuePart;
  const comment = slash >= 0 ? valuePart.slice(slash + 1).trim() : '';
  let value = rawValue;
  if ((rawValue.startsWith("'") && rawValue.endsWith("'")) || (rawValue.startsWith('"') && rawValue.endsWith('"'))) {
    value = rawValue.slice(1, -1).replace(/''/g, "'");
  }
  return { keyword, value, comment };
}

function parseHeaderValue(value: string): string | number | boolean {
  if (value === 'T') return true;
  if (value === 'F') return false;
  if (/^[+-]?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^[+-]?\d*\.\d+([eE][+-]?\d+)?$/.test(value) || /^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(value)) {
    return Number.parseFloat(value);
  }
  return value;
}

function readHeaderBlocks(bytes: Uint8Array, start: number): { cards: FitsHeaderCard[]; headerEnd: number; text: string } {
  const cards: FitsHeaderCard[] = [];
  let pos = start;
  let text = '';
  let ended = false;

  while (!ended && pos + CARD_LEN <= bytes.length) {
    const blockEnd = Math.min(bytes.length, pos + HEADER_BLOCK);
    while (pos + CARD_LEN <= blockEnd) {
      const line = readAscii(bytes, pos, CARD_LEN);
      text += line + '\n';
      const card = parseCard(line);
      cards.push(card);
      pos += CARD_LEN;
      if (card.keyword === 'END') {
        ended = true;
        break;
      }
    }
    if (!ended) {
      // continue to next 2880 block
      pos = blockEnd;
    }
  }

  const headerEnd = Math.ceil((pos - start) / HEADER_BLOCK) * HEADER_BLOCK + start;
  return { cards, headerEnd, text };
}

function cardValue(cards: FitsHeaderCard[], keyword: string): string | number | boolean | undefined {
  const card = cards.find((c) => c.keyword === keyword);
  return card ? parseHeaderValue(card.value) : undefined;
}

function extractWcs(cards: FitsHeaderCard[]): FitsWcsInfo {
  const notes: string[] = [];
  const ctype1 = String(cardValue(cards, 'CTYPE1') ?? '');
  const ctype2 = String(cardValue(cards, 'CTYPE2') ?? '');
  const crval1 = Number(cardValue(cards, 'CRVAL1'));
  const crval2 = Number(cardValue(cards, 'CRVAL2'));
  const cdelt1 = Number(cardValue(cards, 'CDELT1'));
  const cdelt2 = Number(cardValue(cards, 'CDELT2'));
  const crpix1 = Number(cardValue(cards, 'CRPIX1'));
  const crpix2 = Number(cardValue(cards, 'CRPIX2'));

  if (ctype1 || ctype2) notes.push('WCS keywords detected — preview uses pixel grid, not sky projection.');
  return {
    ctype1: ctype1 || undefined,
    ctype2: ctype2 || undefined,
    crval1: Number.isFinite(crval1) ? crval1 : undefined,
    crval2: Number.isFinite(crval2) ? crval2 : undefined,
    cdelt1: Number.isFinite(cdelt1) ? cdelt1 : undefined,
    cdelt2: Number.isFinite(cdelt2) ? cdelt2 : undefined,
    crpix1: Number.isFinite(crpix1) ? crpix1 : undefined,
    crpix2: Number.isFinite(crpix2) ? crpix2 : undefined,
    notes
  };
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

function readHduData(
  bytes: Uint8Array,
  offset: number,
  bitpix: number,
  count: number,
  bscale: number,
  bzero: number,
  blank?: number
): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(count);
  let pos = offset;

  for (let i = 0; i < count; i++) {
    let raw: number;
    if (bitpix === 8) {
      raw = view.getUint8(pos);
      pos += 1;
    } else if (bitpix === 16) {
      raw = view.getInt16(pos, false);
      pos += 2;
    } else if (bitpix === 32) {
      raw = view.getInt32(pos, false);
      pos += 4;
    } else if (bitpix === -32) {
      out[i] = view.getFloat32(pos, false);
      pos += 4;
      continue;
    } else if (bitpix === -64) {
      out[i] = view.getFloat64(pos, false);
      pos += 8;
      continue;
    } else {
      throw new Error(`Unsupported FITS BITPIX ${bitpix}`);
    }
    if (blank != null && raw === blank) {
      out[i] = NaN;
    } else {
      out[i] = raw * bscale + bzero;
    }
  }
  return out;
}

function bytesPerValue(bitpix: number): number {
  const abs = Math.abs(bitpix);
  if (abs === 8) return 1;
  if (abs === 16) return 2;
  if (abs === 32) return 4;
  if (abs === 64) return 8;
  return 4;
}

function buildPreview(
  hdu: Omit<FitsHdu, 'preview'>,
  bytes: Uint8Array,
  warnings: string[]
): FitsHduPreview | null {
  if (!hdu.isImage || !hdu.shape.length) return null;
  const count = hdu.shape.reduce((a, b) => a * b, 1);
  if (!count || hdu.dataOffset + count * bytesPerValue(hdu.bitpix) > bytes.length) {
    warnings.push(`HDU ${hdu.index}: data section truncated or missing.`);
    return null;
  }
  try {
    const data = readHduData(bytes, hdu.dataOffset, hdu.bitpix, count, hdu.bscale, hdu.bzero, hdu.blank);
    const viewDims = toViewDims(hdu.shape);
    const { min: dataMin, max: dataMax } = minMaxVolume(data);
    return {
      index: hdu.index,
      name: hdu.name,
      bitpix: hdu.bitpix,
      naxis: hdu.naxis,
      shape: hdu.shape,
      data,
      viewDims,
      dataMin,
      dataMax,
      bscale: hdu.bscale,
      bzero: hdu.bzero
    };
  } catch (error) {
    warnings.push(`HDU ${hdu.index}: ${error instanceof Error ? error.message : 'Failed to read data'}`);
    return null;
  }
}

function parseHdu(bytes: Uint8Array, offset: number, index: number, warnings: string[]): { hdu: FitsHdu; next: number } {
  const { cards, headerEnd, text } = readHeaderBlocks(bytes, offset);
  const bitpix = Number(cardValue(cards, 'BITPIX') ?? 0);
  const naxis = Number(cardValue(cards, 'NAXIS') ?? 0);
  const shape: number[] = [];
  for (let i = 1; i <= naxis; i++) {
    shape.push(Number(cardValue(cards, `NAXIS${i}`) ?? 1));
  }
  const bscale = Number(cardValue(cards, 'BSCALE') ?? 1);
  const bzero = Number(cardValue(cards, 'BZERO') ?? 0);
  const blankRaw = cardValue(cards, 'BLANK');
  const blank = blankRaw != null ? Number(blankRaw) : undefined;
  const xtension = String(cardValue(cards, 'XTENSION') ?? '');
  const isImage = index === 0 ? bitpix !== 0 : xtension.toUpperCase() === 'IMAGE';
  const extname = String(cardValue(cards, 'EXTNAME') ?? '');
  const name = index === 0 ? 'PRIMARY' : extname || `HDU ${index}`;
  const count = shape.reduce((a, b) => a * b, 1);
  const dataLength = count * bytesPerValue(bitpix || 8);

  const base: Omit<FitsHdu, 'preview'> = {
    index,
    name,
    isImage,
    headerText: text,
    cards,
    bitpix,
    naxis,
    shape,
    bscale,
    bzero,
    blank: Number.isFinite(blank) ? blank : undefined,
    wcs: extractWcs(cards),
    dataOffset: headerEnd,
    dataLength
  };

  const preview = buildPreview(base, bytes, warnings);
  const paddedDataEnd = headerEnd + Math.ceil(dataLength / HEADER_BLOCK) * HEADER_BLOCK;

  return { hdu: { ...base, preview }, next: paddedDataEnd };
}

export function parseFitsBytes(bytes: Uint8Array): FitsParsedFile {
  const warnings: string[] = [];
  if (bytes.length < HEADER_BLOCK) {
    throw new Error('File too small for FITS');
  }
  if (!readAscii(bytes, 0, 6).startsWith('SIMPLE')) {
    throw new Error('Not a FITS file (expected SIMPLE=T in first card)');
  }

  const hdus: FitsHdu[] = [];
  let offset = 0;
  let index = 0;
  while (offset < bytes.length - CARD_LEN) {
    const keyword = readAscii(bytes, offset, 8).trim();
    if (index > 0 && keyword !== 'XTENSION' && keyword !== 'SIMPLE') {
      break;
    }
    const { hdu, next } = parseHdu(bytes, offset, index, warnings);
    hdus.push(hdu);
    if (next <= offset) break;
    offset = next;
    index += 1;
    if (index > 64) {
      warnings.push('Stopped after 64 HDUs.');
      break;
    }
  }

  if (!hdus.length) {
    throw new Error('No FITS HDUs found');
  }

  const defaultHdu = hdus.find((h) => h.preview) ?? hdus[0];
  return {
    hdus,
    defaultHduIndex: defaultHdu.index,
    preview: defaultHdu.preview,
    warnings
  };
}

export function readFitsHduPreview(bytes: Uint8Array, parsed: FitsParsedFile, hduIndex: number): FitsHduPreview | null {
  const hdu = parsed.hdus.find((h) => h.index === hduIndex);
  if (!hdu) return null;
  if (hdu.preview) return hdu.preview;
  const warnings: string[] = [];
  const base = { ...hdu, preview: null as FitsHduPreview | null };
  return buildPreview(base, bytes, warnings);
}
