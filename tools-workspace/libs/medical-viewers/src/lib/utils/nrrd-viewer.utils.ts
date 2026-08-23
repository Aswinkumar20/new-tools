import {
  NRRD_MAX_FILE_BYTES,
  NRRD_SAMPLE_BASE64,
  NRRD_SUPPORTED_EXTENSIONS,
  NRRD_HISTOGRAM_BINS
} from '../constants/nrrd-viewer.constants';
import type {
  NrrdHistogramBar,
  NrrdLoadedFile,
  NrrdParsedVolume,
  NrrdSuggestion
} from '../types/nrrd-viewer.types';
import {
  base64ToUint8Array,
  formatMedicalFileSize,
  getFileExtension
} from './medical-file.utils';
import { parseNrrdBytes } from './nrrd-parse.utils';
import {
  computeVolumeHistogram,
  extractVolumeSlice,
  maxVolumeSliceIndex
} from './volume-slice.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  downloadDataUrl,
  formatMedicalFileSize as formatNrrdFileSize,
  readFileBytes as readNrrdFileBytes
} from './medical-file.utils';

export { parseNrrdBytes } from './nrrd-parse.utils';
export { extractVolumeSlice as extractNrrdSlice, maxVolumeSliceIndex as maxNrrdSliceIndex } from './volume-slice.utils';

export function isSupportedNrrdFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (NRRD_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateNrrdFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > NRRD_MAX_FILE_BYTES) {
    return `File is too large (max ${formatMedicalFileSize(NRRD_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidNrrdFiles(files: FileList | File[]): {
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
    if (!isSupportedNrrdFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .nrrd / .nhdr)' });
      continue;
    }
    const sizeError = validateNrrdFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleNrrdFile(): File {
  const bytes = base64ToUint8Array(NRRD_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-volume.nrrd', {
    type: 'application/octet-stream',
    lastModified: 0
  });
}

export function createNrrdFileRecord(file: File, bytes: Uint8Array): NrrdLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: NrrdParsedVolume | null = null;
  let softFail = false;

  try {
    parsed = parseNrrdBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.data.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse NRRD');
  }

  return {
    id,
    name: file.name,
    size: file.size,
    extension,
    bytes,
    parsed,
    warnings,
    softFail
  };
}

export function defaultWindowForNrrd(parsed: NrrdParsedVolume): { center: number; width: number } {
  const min = parsed.dataMin;
  const max = parsed.dataMax;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { center: 0, width: 1 };
  }
  return { center: (min + max) / 2, width: max - min };
}

export function buildNrrdHistogramBars(parsed: NrrdParsedVolume): NrrdHistogramBar[] {
  const hist = computeVolumeHistogram(parsed.data, NRRD_HISTOGRAM_BINS);
  const total = hist.counts.reduce((a, b) => a + b, 0) || 1;
  return hist.counts.map((count, i) => ({
    label: `${hist.binEdges[i].toFixed(1)}–${hist.binEdges[i + 1].toFixed(1)}`,
    count,
    fraction: count / total
  }));
}

export function exportNrrdHeaderJson(file: NrrdLoadedFile): string {
  return JSON.stringify({ name: file.name, size: file.size, header: file.parsed?.header ?? null }, null, 2);
}

export function exportNrrdSummaryJson(file: NrrdLoadedFile): string {
  const p = file.parsed;
  return JSON.stringify(
    {
      name: file.name,
      size: file.size,
      dims: p?.dims ?? null,
      voxelSize: p?.voxelSize ?? null,
      type: p?.header.type ?? null,
      encoding: p?.header.encoding ?? null,
      space: p?.header.space ?? null,
      dataMin: p?.dataMin ?? null,
      dataMax: p?.dataMax ?? null,
      warnings: file.warnings,
      note: 'Local private preview for education/research — not for diagnostic use.'
    },
    null,
    2
  );
}

export function canExportNrrd(file: NrrdLoadedFile | null): boolean {
  return !!file;
}

export function resolveNrrdSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
}): NrrdSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample NRRD volume',
      reason: 'Load the embedded 8×8×4 float NRRD to verify slices and histogram.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/nrrd-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload',
      title: 'Open an NRRD locally',
      reason: 'Volumes stay in your browser. Preview is for education/research, not diagnosis.',
      actionLabel: 'Upload',
      path: '/medical-viewers/nrrd-viewer'
    };
  }
  return null;
}
