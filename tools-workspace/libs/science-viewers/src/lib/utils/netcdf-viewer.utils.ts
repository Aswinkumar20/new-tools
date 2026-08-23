import {
  NETCDF_MAX_FILE_BYTES,
  NETCDF_SAMPLE_BASE64,
  NETCDF_SUPPORTED_EXTENSIONS
} from '../constants/netcdf-viewer.constants';
import type {
  NetCdfHistogramBar,
  NetCdfLoadedFile,
  NetCdfMetadataRow,
  NetCdfParsedFile,
  NetCdfSuggestion,
  NetCdfVariablePreview
} from '../types/netcdf-viewer.types';
import { parseNetCdfBytes, readNetCdfVariableData } from './netcdf-parse.utils';
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
  formatScienceFileSize as formatNetCdfFileSize,
  readFileBytes as readNetCdfFileBytes
} from './science-file.utils';

export { extractVolumeSlice as extractNetCdfSlice, maxVolumeSliceIndex as maxNetCdfSliceIndex } from './volume-slice.utils';
export { parseNetCdfBytes, readNetCdfVariableData } from './netcdf-parse.utils';

export function isSupportedNetCdfFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (NETCDF_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateNetCdfFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > NETCDF_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(NETCDF_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidNetCdfFiles(files: FileList | File[]): {
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
    if (!isSupportedNetCdfFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .nc NetCDF classic)' });
      continue;
    }
    const sizeError = validateNetCdfFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleNetCdfFile(): File {
  const bytes = base64ToUint8Array(NETCDF_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-grid.nc', {
    type: 'application/netcdf',
    lastModified: 0
  });
}

export function createNetCdfFileRecord(file: File, bytes: Uint8Array): NetCdfLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: NetCdfParsedFile | null = null;
  let softFail = false;

  try {
    parsed = parseNetCdfBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.variables.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse NetCDF');
  }

  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportNetCdf(file: NetCdfLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function defaultWindowForPreview(preview: NetCdfVariablePreview): { center: number; width: number } {
  const min = preview.dataMin;
  const max = preview.dataMax;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { center: 0, width: 1 };
  }
  return { center: (min + max) / 2, width: max - min };
}

export function buildNetCdfMetadataRows(parsed: NetCdfParsedFile): NetCdfMetadataRow[] {
  return [
    { key: 'NetCDF version', value: String(parsed.netcdfVersion) },
    { key: 'Dimensions', value: String(parsed.dimensions.length) },
    { key: 'Variables', value: String(parsed.variables.length) },
    { key: 'Default variable', value: parsed.defaultVariableName },
    ...parsed.globalAttributes.map((a) => ({ key: a.name, value: a.value }))
  ];
}

export function buildNetCdfHistogramBars(preview: NetCdfVariablePreview): NetCdfHistogramBar[] {
  const hist = computeVolumeHistogram(preview.data, 12);
  const maxCount = Math.max(...hist.counts, 1);
  return hist.counts.map((count, i) => ({
    label: hist.binEdges[i].toFixed(1),
    count,
    heightPct: Math.round((count / maxCount) * 100)
  }));
}

export function exportNetCdfSummaryJson(file: NetCdfLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed NetCDF data');
  return JSON.stringify(
    {
      file: file.name,
      netcdfVersion: parsed.netcdfVersion,
      dimensions: parsed.dimensions,
      variables: parsed.variables.map((v) => ({
        name: v.name,
        type: v.typeLabel,
        shape: v.shape,
        dimNames: v.dimNames,
        attributes: v.attributes
      })),
      globalAttributes: parsed.globalAttributes,
      defaultVariable: parsed.defaultVariableName
    },
    null,
    2
  );
}

export function exportNetCdfVariablesJson(file: NetCdfLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed NetCDF data');
  return JSON.stringify(parsed.variables, null, 2);
}

export function exportNetCdfVariableCsv(preview: NetCdfVariablePreview): string {
  const lines = ['index,value'];
  for (let i = 0; i < preview.data.length; i++) {
    lines.push(`${i},${preview.data[i]}`);
  }
  return lines.join('\n');
}

export function resolveNetCdfSuggestion(opts: {
  hasFiles: boolean;
  hasError: boolean;
}): NetCdfSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample climate grid',
      reason: 'Load the embedded 4×8×8 temperature variable to verify slice preview and variable browser.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-nc',
      title: 'Upload a NetCDF classic file',
      reason: 'NetCDF classic (.nc) files stay in your browser — NetCDF-4/HDF5 should use the HDF5 Viewer.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}

export function getVariablePreview(
  file: NetCdfLoadedFile,
  variableName: string
): NetCdfVariablePreview | null {
  if (!file.parsed) return null;
  if (variableName === file.parsed.defaultVariableName && file.parsed.preview) {
    return file.parsed.preview;
  }
  return readNetCdfVariableData(file.bytes, file.parsed, variableName);
}
