import type {
  DlisChannelInfo,
  DlisStorageLabel,
  DlisVisibleRecord,
  ParsedDlis
} from '../types/dlis-viewer.types';
import { isDepthCurve, summarizeCurve } from './well-log-render.utils';

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  return new TextDecoder('latin1').decode(bytes.subarray(start, start + length));
}

export function parseDlisSul(bytes: Uint8Array): DlisStorageLabel | null {
  if (bytes.length < 80) return null;
  const label = readAscii(bytes, 0, 80);
  const version = label.slice(4, 9).trim();
  const structure = label.slice(9, 15).trim();
  if (!/^V\d/i.test(version) && structure.toUpperCase() !== 'RECORD') return null;
  const maxRaw = Number(label.slice(15, 20).trim());
  return {
    sequence: label.slice(0, 4).trim(),
    version: version || 'V1.00',
    structure: structure || 'RECORD',
    maxRecordLength: Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 8192,
    storageSetId: label.slice(20, 80).trim()
  };
}

function parseKeyValues(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    out[line.slice(0, idx).trim().toUpperCase()] = line.slice(idx + 1).trim();
  }
  return out;
}

function parseChannelBlock(text: string): DlisChannelInfo[] {
  const channels: DlisChannelInfo[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('|')) continue;
    const [mnemonic, unit, longName, representation] = line.split('|').map((p) => p.trim());
    if (!mnemonic || mnemonic.toUpperCase() === 'CHANNEL') continue;
    channels.push({
      mnemonic,
      unit: unit || '',
      longName: longName || '',
      representation: representation || 'F4'
    });
  }
  return channels;
}

function extractPrintableStrings(bytes: Uint8Array, minLen = 4): string[] {
  const text = readAscii(bytes, 0, bytes.length);
  const matches = text.match(/[A-Za-z0-9._-][A-Za-z0-9 .,_/()|-]{3,80}/g) ?? [];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const s = m.trim();
    if (s.length < minLen || seen.has(s)) continue;
    seen.add(s);
    uniq.push(s);
    if (uniq.length >= 40) break;
  }
  return uniq;
}

function decodeF4Frame(payload: Uint8Array, channelCount: number): number[][] | null {
  if (channelCount < 1 || payload.length < channelCount * 4) return null;
  if (payload.length % 4 !== 0) return null;
  const floats = payload.length / 4;
  if (floats % channelCount !== 0) return null;
  const rows = floats / channelCount;
  if (rows < 2 || rows > 50_000) return null;
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const columns: number[][] = Array.from({ length: channelCount }, () => []);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < channelCount; c++) {
      const v = view.getFloat32((r * channelCount + c) * 4, false);
      columns[c].push(Number.isFinite(v) ? v : Number.NaN);
    }
  }
  return columns;
}

export function parseDlisBytes(bytes: Uint8Array): ParsedDlis {
  const warnings: string[] = [];
  if (!bytes.length) throw new Error('File is empty');
  const sul = parseDlisSul(bytes);
  if (!sul) {
    throw new Error('Not a DLIS storage unit — missing 80-byte SUL (V1.00 RECORD).');
  }
  if (!/^V1/i.test(sul.version)) {
    warnings.push(`SUL version “${sul.version}” may not be fully supported.`);
  }

  const records: DlisVisibleRecord[] = [];
  let offset = 80;
  let fileId = sul.storageSetId;
  let well = '';
  let company = '';
  let field = '';
  let frameName = '';
  let indexChannel = 'DEPT';
  let channels: DlisChannelInfo[] = [];
  let depth: number[] = [];
  let curveValues: number[][] = [];
  const extractedStrings: string[] = [];

  while (offset + 4 <= bytes.length) {
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 4 || offset + length > bytes.length) {
      if (bytes.length - offset > 4) warnings.push('Stopped at a truncated or invalid visible record.');
      break;
    }
    const attributes = bytes[offset + 2];
    const type = bytes[offset + 3];
    const payload = bytes.subarray(offset + 4, offset + length);
    const eflr = (attributes & 0x80) !== 0;
    const encrypted = (attributes & 0x40) !== 0;
    let label = eflr ? `EFLR type ${type}` : `IFLR type ${type}`;
    if (encrypted) warnings.push(`Record ${records.length} is marked encrypted and was not decoded.`);

    if (!encrypted && eflr) {
      const text = readAscii(payload, 0, payload.length);
      extractedStrings.push(...extractPrintableStrings(payload));
      const kv = parseKeyValues(text);
      if (type === 0 || /FILE-HEADER/i.test(text)) {
        label = 'File Header';
        fileId = kv['ID'] || kv['FILE-ID'] || fileId;
      } else if (type === 1 || /ORIGIN/i.test(text)) {
        label = 'Origin';
        well = kv['WELL'] || well;
        company = kv['COMPANY'] || company;
        field = kv['FIELD'] || field;
        fileId = kv['FILE-ID'] || fileId;
      } else if (type === 3 || /^CHANNEL\b/im.test(text)) {
        label = 'Channel';
        const parsed = parseChannelBlock(text);
        if (parsed.length) channels = parsed;
      } else if (type === 4 || /^FRAME\b/im.test(text)) {
        label = 'Frame';
        frameName = kv['NAME'] || frameName;
        indexChannel = kv['INDEX'] || indexChannel;
        if (kv['CHANNELS'] && !channels.length) {
          channels = kv['CHANNELS'].split(',').map((m) => ({
            mnemonic: m.trim(),
            unit: '',
            longName: '',
            representation: 'F4'
          }));
        }
      } else {
        label = kv['NAME'] || label;
      }
    } else if (!encrypted && !eflr) {
      const count = channels.length || 0;
      const decoded = decodeF4Frame(payload, count || Math.round(payload.length / 4 / 81) || 0);
      if (decoded && decoded.length) {
        label = 'Frame data';
        if (!channels.length) {
          channels = decoded.map((_, i) => ({
            mnemonic: i === 0 ? 'DEPT' : `CH${i}`,
            unit: '',
            longName: '',
            representation: 'F4'
          }));
        }
        const depthIdx = Math.max(0, channels.findIndex((c) => isDepthCurve(c.mnemonic)));
        depth = decoded[depthIdx] ?? decoded[0];
        curveValues = decoded;
      } else {
        extractedStrings.push(...extractPrintableStrings(payload));
      }
    }

    records.push({
      index: records.length,
      offset,
      length,
      attributes,
      type,
      eflr,
      encrypted,
      label
    });
    offset += length;
    if (records.length > 8000) {
      warnings.push('Visible-record catalog truncated after 8000 records.');
      break;
    }
  }

  if (!records.length) warnings.push('No visible records after the storage unit label.');

  const uniqStrings = [...new Set(extractedStrings.map((s) => s.trim()).filter(Boolean))].slice(0, 40);
  const curves = channels
    .map((ch, i) => summarizeCurve(ch.mnemonic, ch.unit, ch.longName, curveValues[i] ?? []))
    .filter((c, i) => !isDepthCurve(c.mnemonic) && (curveValues[i]?.length ?? 0) > 0);

  if (!curves.length) {
    warnings.push('No numeric frame data decoded — showing SUL, records, and extracted names. Full RP66 templates may be unsupported.');
  }

  return {
    sul,
    records,
    fileId,
    well,
    company,
    field,
    frameName,
    indexChannel,
    channels,
    depth,
    curves,
    extractedStrings: uniqStrings,
    warnings
  };
}
