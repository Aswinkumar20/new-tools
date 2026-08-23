import type {
  RootHistogram,
  RootObject,
  RootParsedFile,
  RootTreePreview
} from '../types/root-file-viewer.types';
import { minMaxVolume } from './volume-slice.utils';

function readI32(bytes: Uint8Array, pos: number): number {
  return (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
}

function readI16(bytes: Uint8Array, pos: number): number {
  const v = (bytes[pos] << 8) | bytes[pos + 1];
  return v > 0x7fff ? v - 0x10000 : v;
}

function readF64(bytes: Uint8Array, pos: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + pos, 8).getFloat64(0, false);
}

function readTString(bytes: Uint8Array, pos: number): { value: string; next: number } {
  if (pos >= bytes.length) return { value: '', next: pos };
  let n = bytes[pos];
  let p = pos + 1;
  if (n === 255) {
    n = readI32(bytes, p);
    p += 4;
  }
  const value = new TextDecoder('ascii').decode(bytes.subarray(p, p + Math.max(0, n - 1)));
  p += n;
  while (p % 4) p += 1;
  return { value, next: p };
}

function parseHistObject(bytes: Uint8Array, offset: number): RootHistogram | null {
  const magic = new TextDecoder('ascii').decode(bytes.subarray(offset, offset + 4));
  if (magic !== 'HIST') return null;
  let pos = offset + 4;
  const version = readI32(bytes, pos);
  pos += 4;
  if (version !== 1) return null;
  const nbins = readI32(bytes, pos);
  pos += 4;
  const xmin = readF64(bytes, pos);
  pos += 8;
  const xmax = readF64(bytes, pos);
  pos += 8;
  const count = readI32(bytes, pos);
  pos += 4;
  const values = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    values[i] = readF64(bytes, pos);
    pos += 8;
  }
  const inner = values.subarray(1, Math.max(1, values.length - 1));
  const { min: dataMin, max: dataMax } = minMaxVolume(inner);
  return { nbins, xmin, xmax, values, dataMin, dataMax };
}

function parseTreeObject(bytes: Uint8Array, offset: number): RootTreePreview | null {
  const magic = new TextDecoder('ascii').decode(bytes.subarray(offset, offset + 4));
  if (magic !== 'TREE') return null;
  let pos = offset + 4;
  const version = readI32(bytes, pos);
  pos += 4;
  if (version !== 1) return null;
  const jsonLen = readI32(bytes, pos);
  pos += 4;
  const jsonText = new TextDecoder('utf-8').decode(bytes.subarray(pos, pos + jsonLen));
  try {
    const parsed = JSON.parse(jsonText) as {
      branches?: Array<{ name: string; type: string }>;
      rows?: string[][];
    };
    const branches = parsed.branches ?? [];
    const rows = parsed.rows ?? [];
    return {
      branches,
      rowCount: rows.length,
      columns: branches.map((b) => b.name),
      rows
    };
  } catch {
    return null;
  }
}

function readKey(bytes: Uint8Array, pos: number): {
  keylen: number;
  className: string;
  name: string;
  title: string;
  seekObj: number;
  objlen: number;
  objectOffset: number;
} | null {
  if (pos + 32 > bytes.length) return null;
  const fNbytes = readI32(bytes, pos);
  if (fNbytes <= 0 || fNbytes > bytes.length) return null;
  const fObjlen = readI16(bytes, pos + 6);
  const fSeekObj = readI32(bytes, pos + 24);
  let p = pos + 32;
  const cls = readTString(bytes, p);
  p = cls.next;
  const name = readTString(bytes, p);
  p = name.next;
  const title = readTString(bytes, p);
  const objectOffset = title.next;
  return {
    keylen: fNbytes,
    className: cls.value,
    name: name.value,
    title: title.value,
    seekObj: fSeekObj,
    objlen: fObjlen,
    objectOffset
  };
}

function classifyObject(className: string): RootObject['kind'] {
  if (className.startsWith('TH1') || className.startsWith('TH2') || className.startsWith('TH3')) return 'histogram';
  if (className === 'TTree' || className === 'TNtuple') return 'tree';
  return 'other';
}

export function parseRootBytes(bytes: Uint8Array): RootParsedFile {
  const warnings: string[] = [];
  const magic = new TextDecoder('ascii').decode(bytes.subarray(0, 4));
  if (magic !== 'root') {
    throw new Error('Not a ROOT file — expected "root" magic at byte 0.');
  }

  const rootVersion = readI32(bytes, 4);
  const fBEGIN = readI32(bytes, 12);
  const objects: RootObject[] = [];
  let pos = fBEGIN > 0 && fBEGIN < bytes.length ? fBEGIN : 100;
  let index = 0;
  const maxKeys = 64;

  while (pos + 32 < bytes.length && index < maxKeys) {
    const key = readKey(bytes, pos);
    if (!key || key.keylen < 32) break;
    const kind = classifyObject(key.className);
    const entry: RootObject = {
      index,
      className: key.className,
      name: key.name,
      title: key.title,
      kind
    };

    if (kind === 'histogram') {
      const offset = key.objectOffset > 0 ? key.objectOffset : key.seekObj;
      if (offset > 0 && offset < bytes.length) {
        const hist = parseHistObject(bytes, offset);
        if (hist) entry.histogram = hist;
        else warnings.push(`Histogram "${key.name}" could not be decoded — compressed ROOT objects may be unsupported.`);
      }
    } else if (kind === 'tree') {
      const offset = key.objectOffset > 0 ? key.objectOffset : key.seekObj;
      if (offset > 0 && offset < bytes.length) {
        const tree = parseTreeObject(bytes, offset);
        if (tree) entry.tree = tree;
        else warnings.push(`Tree "${key.name}" metadata could not be decoded.`);
      }
    } else if (kind === 'other') {
      warnings.push(`Object "${key.name}" (${key.className}) is listed but not previewed.`);
    }

    objects.push(entry);
    pos += key.keylen;
    index += 1;
    if (pos >= bytes.length - 32) break;
  }

  if (!objects.length) {
    throw new Error('No ROOT objects found — compressed or streamer-dependent files may be unsupported.');
  }

  const preview =
    objects.find((o) => o.kind === 'histogram' && o.histogram) ??
    objects.find((o) => o.kind === 'tree' && o.tree) ??
    objects[0];

  return {
    rootVersion,
    objects,
    defaultObjectIndex: preview.index,
    preview,
    warnings
  };
}

export function readRootObject(_bytes: Uint8Array, parsed: RootParsedFile, objectIndex: number): RootObject | null {
  return parsed.objects.find((o) => o.index === objectIndex) ?? null;
}
