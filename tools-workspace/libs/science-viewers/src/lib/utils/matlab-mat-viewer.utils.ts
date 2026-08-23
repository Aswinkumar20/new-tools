import {
  MAT_MAX_FILE_BYTES,
  MAT_SAMPLE_BASE64,
  MAT_SUPPORTED_EXTENSIONS
} from '../constants/matlab-mat-viewer.constants';
import type {
  MatHistogramBar,
  MatLoadedFile,
  MatMetadataRow,
  MatParsedFile,
  MatSuggestion,
  MatVariablePreview
} from '../types/matlab-mat-viewer.types';
import { buildSampleMatV5Bytes } from './mat-build.utils';
import { parseMatBytes, readMatVariableData } from './mat-parse.utils';
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
  formatScienceFileSize as formatMatFileSize,
  readFileBytes as readMatFileBytes
} from './science-file.utils';

export { extractVolumeSlice as extractMatSlice, maxVolumeSliceIndex as maxMatSliceIndex } from './volume-slice.utils';
export { buildSampleMatV5Bytes } from './mat-build.utils';
export { parseMatBytes, readMatVariableData } from './mat-parse.utils';

export function isSupportedMatFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (MAT_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateMatFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > MAT_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(MAT_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidMatFiles(files: FileList | File[]): {
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
    if (!isSupportedMatFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .mat)' });
      continue;
    }
    const sizeError = validateMatFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleMatFile(): File {
  let bytes: Uint8Array;
  try {
    bytes = base64ToUint8Array(MAT_SAMPLE_BASE64);
  } catch {
    bytes = buildSampleMatV5Bytes();
  }
  return new File([bytes as BlobPart], 'sample-lab.mat', {
    type: 'application/matlab',
    lastModified: 0
  });
}

export function createMatFileRecord(file: File, bytes: Uint8Array): MatLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: MatParsedFile | null = null;
  let softFail = false;
  try {
    parsed = parseMatBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.variables.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse MAT file');
  }
  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportMat(file: MatLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function defaultWindowForPreview(preview: MatVariablePreview): { center: number; width: number } {
  const { dataMin: min, dataMax: max } = preview;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return { center: 0, width: 1 };
  return { center: (min + max) / 2, width: max - min };
}

export function buildMatMetadataRows(parsed: MatParsedFile): MatMetadataRow[] {
  return [
    { key: 'Format', value: parsed.format },
    { key: 'Header', value: parsed.matVersion },
    { key: 'Variables', value: String(parsed.variables.length) },
    { key: 'Default variable', value: parsed.defaultVariableName }
  ];
}

export function buildMatHistogramBars(preview: MatVariablePreview): MatHistogramBar[] {
  const hist = computeVolumeHistogram(preview.data, 12);
  const maxCount = Math.max(...hist.counts, 1);
  return hist.counts.map((count, i) => ({
    label: hist.binEdges[i].toFixed(1),
    count,
    heightPct: Math.round((count / maxCount) * 100)
  }));
}

export function exportMatSummaryJson(file: MatLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed MAT data');
  return JSON.stringify(
    {
      file: file.name,
      format: parsed.format,
      matVersion: parsed.matVersion,
      variables: parsed.variables.map((v) => ({
        name: v.name,
        className: v.className,
        shape: v.shape,
        dtype: v.dtype
      })),
      defaultVariable: parsed.defaultVariableName
    },
    null,
    2
  );
}

export function exportMatVariablesJson(file: MatLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed MAT data');
  return JSON.stringify(parsed.variables, null, 2);
}

export function exportMatVariableCsv(preview: MatVariablePreview): string {
  const lines = ['index,value'];
  for (let i = 0; i < preview.data.length; i++) {
    lines.push(`${i},${preview.data[i]}`);
  }
  return lines.join('\n');
}

export function resolveMatSuggestion(opts: { hasFiles: boolean; hasError: boolean }): MatSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample lab MAT file',
      reason: 'Load the embedded 8×8 grid and 1×16 series to verify variable browser and slice preview.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-mat',
      title: 'Upload a MATLAB MAT file',
      reason: 'MAT files stay in your browser — browse variables and preview numeric arrays as heatmaps or line charts.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}

export function getVariablePreview(file: MatLoadedFile, variableName: string): MatVariablePreview | null {
  if (!file.parsed) return null;
  if (variableName === file.parsed.defaultVariableName && file.parsed.preview) {
    return file.parsed.preview;
  }
  return readMatVariableData(file.bytes, file.parsed, variableName);
}
