import {
  HDF5_MAX_FILE_BYTES,
  HDF5_SAMPLE_BASE64,
  HDF5_SUPPORTED_EXTENSIONS
} from '../constants/hdf5-viewer.constants';
import type {
  Hdf5DatasetPreview,
  Hdf5HistogramBar,
  Hdf5LoadedFile,
  Hdf5MetadataRow,
  Hdf5ParsedFile,
  Hdf5Suggestion,
  Hdf5TreeNode
} from '../types/hdf5-viewer.types';
import { flattenTree, parseHdf5Bytes, readHdf5Dataset } from './hdf5-parse.utils';
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
  formatScienceFileSize as formatHdf5FileSize,
  readFileBytes as readHdf5FileBytes
} from './science-file.utils';

export { extractVolumeSlice as extractHdf5Slice, maxVolumeSliceIndex as maxHdf5SliceIndex } from './volume-slice.utils';
export { flattenTree, parseHdf5Bytes, readHdf5Dataset } from './hdf5-parse.utils';

export function isSupportedHdf5File(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (HDF5_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateHdf5FileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > HDF5_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(HDF5_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidHdf5Files(files: FileList | File[]): {
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
    if (!isSupportedHdf5File(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .h5 / .hdf5)' });
      continue;
    }
    const sizeError = validateHdf5FileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleHdf5File(): File {
  const bytes = base64ToUint8Array(HDF5_SAMPLE_BASE64);
  return new File([bytes as BlobPart], 'sample-science.h5', {
    type: 'application/x-hdf5',
    lastModified: 0
  });
}

export function createHdf5FileRecord(file: File, bytes: Uint8Array): Hdf5LoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: Hdf5ParsedFile | null = null;
  let softFail = false;

  try {
    parsed = parseHdf5Bytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.tree.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse HDF5');
  }

  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportHdf5(file: Hdf5LoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function defaultWindowForPreview(preview: Hdf5DatasetPreview): { center: number; width: number } {
  const min = preview.dataMin;
  const max = preview.dataMax;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { center: 0, width: 1 };
  }
  return { center: (min + max) / 2, width: max - min };
}

export function buildHdf5MetadataRows(parsed: Hdf5ParsedFile): Hdf5MetadataRow[] {
  const flat = flattenTree(parsed.tree);
  return [
    { key: 'Groups', value: String(flat.filter((n) => n.kind === 'group').length) },
    { key: 'Datasets', value: String(parsed.datasets.length) },
    { key: 'Default dataset', value: parsed.defaultDatasetPath || '—' },
    { key: 'Decoded arrays', value: String(parsed.datasets.length) }
  ];
}

export function buildHdf5HistogramBars(preview: Hdf5DatasetPreview): Hdf5HistogramBar[] {
  const hist = computeVolumeHistogram(preview.data, 12);
  const maxCount = Math.max(...hist.counts, 1);
  return hist.counts.map((count, i) => ({
    label: hist.binEdges[i].toFixed(1),
    count,
    heightPct: Math.round((count / maxCount) * 100)
  }));
}

export function exportHdf5SummaryJson(file: Hdf5LoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed HDF5 data');
  return JSON.stringify(
    {
      file: file.name,
      datasets: parsed.datasets.map((d) => ({
        path: d.path,
        shape: d.shape,
        dtype: d.dtype,
        dataMin: d.dataMin,
        dataMax: d.dataMax
      })),
      defaultDataset: parsed.defaultDatasetPath,
      warnings: parsed.warnings
    },
    null,
    2
  );
}

export function exportHdf5TreeJson(file: Hdf5LoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed HDF5 data');
  return JSON.stringify(parsed.tree, null, 2);
}

export function exportHdf5DatasetJson(preview: Hdf5DatasetPreview): string {
  return JSON.stringify(
    {
      path: preview.path,
      shape: preview.shape,
      dtype: preview.dtype,
      attributes: preview.attributes,
      values: Array.from(preview.data)
    },
    null,
    2
  );
}

export function exportHdf5DatasetCsv(preview: Hdf5DatasetPreview): string {
  const lines = ['index,value'];
  for (let i = 0; i < preview.data.length; i++) {
    lines.push(`${i},${preview.data[i]}`);
  }
  return lines.join('\n');
}

export function resolveHdf5Suggestion(opts: {
  hasFiles: boolean;
  hasError: boolean;
}): Hdf5Suggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample HDF5 file',
      reason: 'Load the embedded temperature grid and metadata group to explore the tree browser.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-h5',
      title: 'Upload an HDF5 file',
      reason: 'HDF5 files stay in your browser — browse groups, inspect attributes, and preview numeric arrays.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}

export function getDatasetPreview(file: Hdf5LoadedFile, path: string): Hdf5DatasetPreview | null {
  if (!file.parsed) return null;
  const existing = file.parsed.datasets.find((d) => d.path === path);
  if (existing) return existing;
  return readHdf5Dataset(file.bytes, path, file.name);
}

export function filterTreeNodes(nodes: Hdf5TreeNode[], query: string): Hdf5TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return flattenTree(nodes).filter((n) => n.path.toLowerCase().includes(q) || n.name.toLowerCase().includes(q));
}
