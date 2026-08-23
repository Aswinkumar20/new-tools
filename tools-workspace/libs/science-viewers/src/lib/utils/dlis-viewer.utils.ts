import { DLIS_MAX_FILE_BYTES, DLIS_SUPPORTED_EXTENSIONS } from '../constants/dlis-viewer.constants';
import type {
  DlisLoadedFile,
  DlisMetadataRow,
  DlisSuggestion,
  ParsedDlis
} from '../types/dlis-viewer.types';
import type { WellLogCurve } from '../types/well-log.types';
import { buildSampleDlisBytes } from './dlis-build.utils';
import { parseDlisBytes } from './dlis-parse.utils';
import { formatScienceFileSize, getFileExtension } from './science-file.utils';
import { curveHistogram } from './well-log-render.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatDlisFileSize,
  readFileBytes as readDlisFileBytes
} from './science-file.utils';

export { buildSampleDlisBytes } from './dlis-build.utils';
export { parseDlisBytes } from './dlis-parse.utils';
export { curveColor, curveHistogram, renderWellCrossplot, renderWellLogTracks } from './well-log-render.utils';

export function isSupportedDlisFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DLIS_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateDlisFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DLIS_MAX_FILE_BYTES) return `File is too large (max ${formatScienceFileSize(DLIS_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDlisFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const file of Array.from(files)) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) {
      rejected.push({ name: file.name, reason: 'Duplicate file in this selection' });
      continue;
    }
    seen.add(key);
    if (/\.gz$/i.test(file.name)) {
      rejected.push({ name: file.name, reason: 'Compressed DLIS is not supported — decompress first' });
      continue;
    }
    if (!isSupportedDlisFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .dlis)' });
      continue;
    }
    const sizeError = validateDlisFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDlisFile(): File {
  return new File([buildSampleDlisBytes() as BlobPart], 'sample-well.dlis', {
    type: 'application/octet-stream',
    lastModified: 0
  });
}

export function createDlisFileRecord(file: File, bytes: Uint8Array): DlisLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: ParsedDlis | null = null;
  let softFail = false;
  try {
    parsed = parseDlisBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.sul) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DLIS');
  }
  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportDlis(file: DlisLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDlisMetadataRows(parsed: ParsedDlis): DlisMetadataRow[] {
  return [
    { key: 'Version', value: parsed.sul?.version || '—' },
    { key: 'Structure', value: parsed.sul?.structure || '—' },
    { key: 'File ID', value: parsed.fileId || '—' },
    { key: 'Well', value: parsed.well || '—' },
    { key: 'Company', value: parsed.company || '—' },
    { key: 'Field', value: parsed.field || '—' },
    { key: 'Frame', value: parsed.frameName || '—' },
    { key: 'Records', value: String(parsed.records.length) },
    { key: 'Channels', value: String(parsed.channels.length) },
    { key: 'Samples', value: String(parsed.depth.length) }
  ];
}

export function buildDlisCurveMetadata(curve: WellLogCurve): DlisMetadataRow[] {
  return [
    { key: 'Mnemonic', value: curve.mnemonic },
    { key: 'Unit', value: curve.unit || '—' },
    { key: 'Min', value: curve.min.toFixed(3) },
    { key: 'Max', value: curve.max.toFixed(3) },
    { key: 'Mean', value: curve.mean.toFixed(3) },
    { key: 'Nulls', value: String(curve.nullCount) },
    { key: 'Description', value: curve.description || '—' }
  ];
}

export function filterDlisChannels(
  channels: ParsedDlis['channels'],
  query: string
): ParsedDlis['channels'] {
  const q = query.trim().toLowerCase();
  if (!q) return channels;
  return channels.filter(
    (c) =>
      c.mnemonic.toLowerCase().includes(q) ||
      c.unit.toLowerCase().includes(q) ||
      c.longName.toLowerCase().includes(q)
  );
}

export function exportDlisSummaryJson(file: DlisLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed DLIS');
  return JSON.stringify(
    {
      file: file.name,
      sul: parsed.sul,
      fileId: parsed.fileId,
      well: parsed.well,
      company: parsed.company,
      field: parsed.field,
      frameName: parsed.frameName,
      records: parsed.records.length,
      channels: parsed.channels,
      samples: parsed.depth.length
    },
    null,
    2
  );
}

export function exportDlisChannelsCsv(parsed: ParsedDlis): string {
  const lines = ['mnemonic,unit,longName,representation'];
  for (const ch of parsed.channels) {
    lines.push(`${ch.mnemonic},${ch.unit},"${ch.longName.replace(/"/g, '""')}",${ch.representation}`);
  }
  return lines.join('\n');
}

export function exportDlisFrameCsv(parsed: ParsedDlis, mnemonics: string[]): string {
  const selected = parsed.curves.filter((c) => mnemonics.includes(c.mnemonic));
  const header = [parsed.indexChannel || 'DEPT', ...selected.map((c) => c.mnemonic)].join(',');
  const lines = [header];
  for (let i = 0; i < parsed.depth.length; i++) {
    lines.push(
      [parsed.depth[i], ...selected.map((c) => (Number.isFinite(c.values[i]) ? c.values[i] : ''))].join(',')
    );
  }
  return lines.join('\n');
}

export function dlisHistogram(curve: WellLogCurve) {
  return curveHistogram(curve);
}

export function resolveDlisSuggestion(opts: { hasFiles: boolean; hasError: boolean }): DlisSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample DLIS well',
      reason: 'Load the synthetic RP66-like file to verify SUL, channels, and depth-track preview.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-dlis',
      title: 'Upload a DLIS file',
      reason: 'DLIS stays in your browser — inspect records, channels, and export locally.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}
