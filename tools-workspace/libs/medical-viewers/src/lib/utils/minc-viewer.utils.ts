import {
  MINC_MAX_FILE_BYTES,
  MINC_SAMPLE_BASE64,
  MINC_SUPPORTED_EXTENSIONS
} from '../constants/minc-viewer.constants';
import type {
  MincLoadedFile,
  MincMetadataRow,
  MincParsedVolume,
  MincSuggestion
} from '../types/minc-viewer.types';
import {
  base64ToUint8Array,
  formatMedicalFileSize,
  getFileExtension
} from './medical-file.utils';
import { parseMincBytes } from './minc-parse.utils';
import { extractVolumeSlice, maxVolumeSliceIndex } from './volume-slice.utils';

export {
  downloadBinaryFile,
  downloadTextFile,
  downloadDataUrl,
  formatMedicalFileSize as formatMincFileSize,
  readFileBytes as readMincFileBytes
} from './medical-file.utils';

export { parseMincBytes } from './minc-parse.utils';
export { extractVolumeSlice as extractMincSlice, maxVolumeSliceIndex as maxMincSliceIndex } from './volume-slice.utils';

export function isSupportedMincFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (MINC_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateMincFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > MINC_MAX_FILE_BYTES) {
    return `File is too large (max ${formatMedicalFileSize(MINC_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidMincFiles(files: FileList | File[]): {
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
    if (!isSupportedMincFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .mnc / .minc)' });
      continue;
    }
    const sizeError = validateMincFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleMincFile(): File {
  const bytes = base64ToUint8Array(MINC_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-brain.mnc', {
    type: 'application/octet-stream',
    lastModified: 0
  });
}

export function createMincFileRecord(file: File, bytes: Uint8Array): MincLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: MincParsedVolume | null = null;
  let softFail = false;

  try {
    parsed = parseMincBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.data.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse MINC');
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

export function defaultWindowForMinc(parsed: MincParsedVolume): { center: number; width: number } {
  const min = parsed.dataMin;
  const max = parsed.dataMax;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { center: 0, width: 1 };
  }
  return { center: (min + max) / 2, width: max - min };
}

export function buildMincMetadataRows(parsed: MincParsedVolume): MincMetadataRow[] {
  const rows: MincMetadataRow[] = [
    { key: 'Variable', value: parsed.header.variableName },
    { key: 'NetCDF version', value: String(parsed.header.netcdfVersion) },
    { key: 'Dimensions', value: parsed.header.dimensions.map((d) => `${d.name}=${d.size}`).join(', ') },
    { key: 'Image dims', value: parsed.header.dimNames.join(', ') },
    { key: 'Voxel grid', value: parsed.dims.join(' × ') },
    { key: 'Data range', value: `${parsed.dataMin.toFixed(3)} … ${parsed.dataMax.toFixed(3)}` }
  ];
  for (const note of parsed.header.notes) {
    rows.push({ key: 'Note', value: note });
  }
  return rows;
}

export function exportMincHeaderJson(file: MincLoadedFile): string {
  return JSON.stringify({ name: file.name, size: file.size, header: file.parsed?.header ?? null }, null, 2);
}

export function exportMincSummaryJson(file: MincLoadedFile): string {
  const p = file.parsed;
  return JSON.stringify(
    {
      name: file.name,
      size: file.size,
      dims: p?.dims ?? null,
      variable: p?.header.variableName ?? null,
      dimensions: p?.header.dimensions ?? null,
      dataMin: p?.dataMin ?? null,
      dataMax: p?.dataMax ?? null,
      warnings: file.warnings,
      note: 'Local private preview for education/research — not for diagnostic use.'
    },
    null,
    2
  );
}

export function canExportMinc(file: MincLoadedFile | null): boolean {
  return !!file;
}

export function resolveMincSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
}): MincSuggestion | null {
  if (state.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample MINC volume',
      reason: 'Load the embedded 8×8×4 NetCDF classic MINC to verify ortho slices.',
      actionLabel: 'Open sample',
      path: '/medical-viewers/minc-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload',
      title: 'Open a MINC file locally',
      reason: 'MINC 1 / NetCDF classic only. Volumes stay in your browser — not for diagnosis.',
      actionLabel: 'Upload',
      path: '/medical-viewers/minc-viewer'
    };
  }
  return null;
}
