import {
  ROOT_MAX_FILE_BYTES,
  ROOT_SAMPLE_BASE64,
  ROOT_SUPPORTED_EXTENSIONS
} from '../constants/root-file-viewer.constants';
import type {
  RootHistogram,
  RootHistogramBar,
  RootLoadedFile,
  RootMetadataRow,
  RootObject,
  RootParsedFile,
  RootSuggestion
} from '../types/root-file-viewer.types';
import { buildSampleRootBytes } from './root-build.utils';
import { parseRootBytes, readRootObject } from './root-parse.utils';
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
  formatScienceFileSize as formatRootFileSize,
  readFileBytes as readRootFileBytes
} from './science-file.utils';

export { buildSampleRootBytes } from './root-build.utils';
export { parseRootBytes, readRootObject } from './root-parse.utils';

export function isSupportedRootFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (ROOT_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateRootFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > ROOT_MAX_FILE_BYTES) {
    return `File is too large (max ${formatScienceFileSize(ROOT_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidRootFiles(files: FileList | File[]): {
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
    if (!isSupportedRootFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .root)' });
      continue;
    }
    const sizeError = validateRootFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleRootFile(): File {
  let bytes: Uint8Array;
  try {
    bytes = base64ToUint8Array(ROOT_SAMPLE_BASE64);
  } catch {
    bytes = buildSampleRootBytes();
  }
  return new File([bytes as BlobPart], 'sample-physics.root', {
    type: 'application/octet-stream',
    lastModified: 0
  });
}

export function createRootFileRecord(file: File, bytes: Uint8Array): RootLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const warnings: string[] = [];
  let parsed: RootParsedFile | null = null;
  let softFail = false;
  try {
    parsed = parseRootBytes(bytes);
    warnings.push(...parsed.warnings);
    if (!parsed.objects.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse ROOT file');
  }
  return { id, name: file.name, size: file.size, extension, bytes, parsed, warnings, softFail };
}

export function canExportRoot(file: RootLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildRootMetadataRows(obj: RootObject): RootMetadataRow[] {
  const rows: RootMetadataRow[] = [
    { key: 'Class', value: obj.className },
    { key: 'Name', value: obj.name },
    { key: 'Title', value: obj.title || '—' },
    { key: 'Kind', value: obj.kind }
  ];
  if (obj.histogram) {
    rows.push(
      { key: 'Bins', value: String(obj.histogram.nbins) },
      { key: 'X range', value: `${obj.histogram.xmin} – ${obj.histogram.xmax}` }
    );
  }
  if (obj.tree) {
    rows.push(
      { key: 'Branches', value: String(obj.tree.branches.length) },
      { key: 'Rows (preview)', value: String(obj.tree.rowCount) }
    );
  }
  return rows;
}

export function buildRootFileMetadataRows(parsed: RootParsedFile): RootMetadataRow[] {
  return [
    { key: 'ROOT version', value: String(parsed.rootVersion) },
    { key: 'Objects', value: String(parsed.objects.length) },
    { key: 'Default object', value: parsed.preview?.name ?? '—' }
  ];
}

export function buildRootHistogramBars(hist: RootHistogram): RootHistogramBar[] {
  const inner = hist.values.subarray(1, Math.max(1, hist.values.length - 1));
  const float = new Float32Array(inner.length);
  for (let i = 0; i < inner.length; i++) float[i] = inner[i];
  const histData = computeVolumeHistogram(float, 12);
  const maxCount = Math.max(...histData.counts, 1);
  return histData.counts.map((count, i) => ({
    label: histData.binEdges[i].toFixed(1),
    count,
    heightPct: Math.round((count / maxCount) * 100)
  }));
}

export function exportRootSummaryJson(file: RootLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed ROOT data');
  return JSON.stringify(
    {
      file: file.name,
      rootVersion: parsed.rootVersion,
      objects: parsed.objects.map((o) => ({
        index: o.index,
        className: o.className,
        name: o.name,
        title: o.title,
        kind: o.kind
      }))
    },
    null,
    2
  );
}

export function exportRootObjectsJson(file: RootLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed ROOT data');
  return JSON.stringify(parsed.objects, null, 2);
}

export function exportRootHistogramCsv(hist: RootHistogram): string {
  const lines = ['bin,value'];
  for (let i = 0; i < hist.values.length; i++) {
    lines.push(`${i},${hist.values[i]}`);
  }
  return lines.join('\n');
}

export function resolveRootSuggestion(opts: { hasFiles: boolean; hasError: boolean }): RootSuggestion | null {
  if (opts.hasError) {
    return {
      id: 'try-sample',
      title: 'Try the sample physics ROOT file',
      reason: 'Load the embedded TH1D energy spectrum and TTree preview to verify object browser.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!opts.hasFiles) {
    return {
      id: 'upload-root',
      title: 'Upload a ROOT file',
      reason: 'ROOT files stay in your browser — browse histograms and tree branches with soft warnings for compressed objects.',
      actionLabel: 'Choose file',
      action: 'upload'
    };
  }
  return null;
}

export function getRootObject(file: RootLoadedFile, objectIndex: number): RootObject | null {
  if (!file.parsed) return null;
  return readRootObject(file.bytes, file.parsed, objectIndex) ?? file.parsed.objects.find((o) => o.index === objectIndex) ?? null;
}
