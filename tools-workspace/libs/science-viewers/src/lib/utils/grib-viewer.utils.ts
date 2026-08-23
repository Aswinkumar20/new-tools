import {
  GRIB_MAX_FILE_BYTES,
  GRIB_SAMPLE_BASE64,
  GRIB_SUPPORTED_EXTENSIONS
} from '../constants/grib-viewer.constants';
import type {
  GribHistogramBar,
  GribLoadedFile,
  GribMessageField,
  GribMetadataRow,
  GribParsedFile,
  GribSuggestion
} from '../types/grib-viewer.types';
import { buildSampleGrib2Bytes } from './grib2-build.utils';
import { parseGribBytes, readGribMessage } from './grib2-parse.utils';
import {
  base64ToUint8Array,
  formatScienceFileSize,
  getFileExtension
} from './science-file.utils';
import { computeVolumeHistogram } from './volume-slice.utils';

export {
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatScienceFileSize as formatGribFileSize,
  readFileBytes as readGribFileBytes
} from './science-file.utils';

export { buildSampleGrib2Bytes } from './grib2-build.utils';
export { parseGribBytes, readGribMessage } from './grib2-parse.utils';

export function isSupportedGribFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (GRIB_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateGribFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > GRIB_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(GRIB_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidGribFiles(files: FileList | File[]): {
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
    if (!isSupportedGribFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .grib / .grib2)' });
      continue;
    }
    const sizeError = validateGribFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleGribFile(): File {
  let bytes: Uint8Array;
  try {
    bytes = base64ToUint8Array(GRIB_SAMPLE_BASE64);
  } catch {
    bytes = buildSampleGrib2Bytes();
  }
  return new File([bytes as BlobPart], 'sample-weather.grib2', {
    type: 'application/octet-stream',
    lastModified: 0
  });
}

export function createGribFileRecord(file: File, bytes: Uint8Array): GribLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: GribParsedFile | null = null;
  let softFail = false;
  try {
    parsed = parseGribBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.messages.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse GRIB');
  }
  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportGrib(file: GribLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function defaultWindowForField(field: GribMessageField): { center: number; width: number } {
  const { dataMin: min, dataMax: max } = field;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return { center: 0, width: 1 };
  return { center: (min + max) / 2, width: max - min };
}

export function buildGribMetadataRows(field: GribMessageField): GribMetadataRow[] {
  return [
    { key: 'Parameter', value: field.parameterName },
    { key: 'Category', value: String(field.category) },
    { key: 'Number', value: String(field.parameterNumber) },
    { key: 'Grid', value: `${field.ni} × ${field.nj}` },
    { key: 'Lat range', value: `${field.lat1.toFixed(2)}° – ${field.lat2.toFixed(2)}°` },
    { key: 'Lon range', value: `${field.lon1.toFixed(2)}° – ${field.lon2.toFixed(2)}°` },
    { key: 'Level type', value: String(field.levelType) },
    { key: 'Level', value: String(field.levelValue) }
  ];
}

export function buildGribHistogramBars(field: GribMessageField): GribHistogramBar[] {
  const hist = computeVolumeHistogram(field.data, 12);
  const maxCount = Math.max(...hist.counts, 1);
  return hist.counts.map((count, i) => ({
    label: hist.binEdges[i].toFixed(1),
    count,
    heightPct: Math.round((count / maxCount) * 100)
  }));
}

export function exportGribSummaryJson(file: GribLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed GRIB data');
  return JSON.stringify(
    {
      file: file.name,
      edition: parsed.edition,
      messages: parsed.messages.map((m) => ({
        index: m.index,
        parameterName: m.parameterName,
        shape: m.shape,
        dataMin: m.dataMin,
        dataMax: m.dataMax
      }))
    },
    null,
    2
  );
}

export function exportGribMessagesJson(file: GribLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed GRIB data');
  return JSON.stringify(parsed.messages.map((m) => ({
    index: m.index,
    parameterName: m.parameterName,
    category: m.category,
    parameterNumber: m.parameterNumber,
    ni: m.ni,
    nj: m.nj,
    lat1: m.lat1,
    lon1: m.lon1,
    lat2: m.lat2,
    lon2: m.lon2,
    levelType: m.levelType,
    levelValue: m.levelValue
  })), null, 2);
}

export function exportGribFieldCsv(field: GribMessageField): string {
  const lines = ['i,j,value'];
  const [ni, nj] = field.shape;
  for (let j = 0; j < nj; j++) {
    for (let i = 0; i < ni; i++) {
      lines.push(`${i},${j},${field.data[j * ni + i]}`);
    }
  }
  return lines.join('\n');
}

export function resolveGribSuggestion(opts: { hasFiles: boolean; hasError: boolean }): GribSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample weather grid',
      reason: 'Load the embedded 8×8 GRIB2 temperature field to verify field browser and heatmap preview.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-grib',
      title: 'Upload a GRIB2 file',
      reason: 'GRIB files stay in your browser — browse messages and preview scalar fields as heatmaps.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}

export function getMessageField(file: GribLoadedFile, messageIndex: number): GribMessageField | null {
  if (!file.parsed) return null;
  return readGribMessage(file.bytes, file.parsed, messageIndex) ?? file.parsed.messages.find((m) => m.index === messageIndex) ?? null;
}
