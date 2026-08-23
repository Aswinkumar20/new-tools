import { MA_MAX_FILE_BYTES, MA_SUPPORTED_EXTENSIONS } from '../constants/model-architecture-viewer.constants';
import type { MaBlock, MaDataset, MaLoadedFile, MaMetadataRow, MaParam, MaSuggestion } from '../types/model-architecture-viewer.types';
import { buildSampleMaBytes, parseMaBytes } from './model-architecture-viewer-parse.utils';
import { bytesToText, formatMlFileSize, getMlFileExtension } from './ml-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatMlFileSize as formatMaFileSize,
  readFileBytes as readMaFileBytes
} from './ml-file.utils';

export {
  buildSampleMaBytes,
  buildSampleMaJson,
  filterMaBlocks,
  filterMaParams,
  filterMaRows,
  parseMaBytes,
  parseMaText
} from './model-architecture-viewer-parse.utils';
export { maTypeColor, renderMaBlocks, renderMaParams, renderMaPreview } from './model-architecture-viewer-render.utils';

export function isSupportedMaFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (MA_SUPPORTED_EXTENSIONS as readonly string[]).includes(getMlFileExtension(file.name));
}

export function validateMaFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > MA_MAX_FILE_BYTES) return `File is too large (max ${formatMlFileSize(MA_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidMaFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed architecture files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedMaFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .arch, .spec, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateMaFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleMaFile(): File {
  return new File([buildSampleMaBytes() as BlobPart], 'sample-shop-ranker.arch', { type: 'application/octet-stream', lastModified: 0 });
}

export function createMaFileRecord(file: File, bytes: Uint8Array): MaLoadedFile {
  const extension = getMlFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: MaDataset | null = null;
  let softFail = false;
  try {
    parsed = parseMaBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.blocks.length && !parsed.params.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse model architecture');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportMa(file: MaLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildMaMetadataRows(dataset: MaDataset): MaMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Family', value: dataset.family },
    { key: 'Blocks', value: String(dataset.blockCount) },
    { key: 'Params', value: String(dataset.paramCount) },
    { key: 'Total', value: String(dataset.totalParams) }
  ];
}

export function buildMaBlockMetadata(block: MaBlock): MaMetadataRow[] {
  return [
    { key: 'Name', value: block.name },
    { key: 'Type', value: block.type },
    { key: 'Role', value: block.role },
    { key: 'In', value: block.inFeatures || '—' },
    { key: 'Out', value: block.outFeatures || '—' },
    { key: 'Params', value: String(block.paramCount) }
  ];
}

export function buildMaParamMetadata(param: MaParam): MaMetadataRow[] {
  return [
    { key: 'Name', value: param.name },
    { key: 'Block', value: param.block || '—' },
    { key: 'Kind', value: param.kind },
    { key: 'DType', value: param.dtype },
    { key: 'Shape', value: param.shapeLabel },
    { key: 'Numel', value: String(param.numel) }
  ];
}

export function exportMaSummaryJson(file: MaLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed model architecture');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      family: parsed.family,
      totalParams: parsed.totalParams,
      blocks: parsed.blocks.map((b) => ({
        name: b.name,
        type: b.type,
        role: b.role,
        inFeatures: b.inFeatures,
        outFeatures: b.outFeatures,
        paramCount: b.paramCount
      })),
      params: parsed.params.map((p) => ({
        name: p.name,
        block: p.block,
        kind: p.kind,
        dtype: p.dtype,
        shape: p.shape,
        numel: p.numel
      })),
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportMaSchemaCsv(dataset: MaDataset): string {
  const lines = ['kind,name,type,shape,numel,block'];
  for (const b of dataset.blocks) {
    lines.push(['block', csv(b.name), csv(b.type), '', String(b.paramCount), csv(b.role)].join(','));
  }
  for (const p of dataset.params) {
    lines.push(['param', csv(p.name), csv(p.kind), csv(p.shapeLabel), String(p.numel), csv(p.block)].join(','));
  }
  return lines.join('\n');
}

export function exportMaRowsCsv(dataset: MaDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveMaSuggestion(state: { hasFiles: boolean; hasError: boolean }): MaSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the ShopRanker architecture sample',
      reason: 'Load a tiny stem → encoder → head MLP with weight and bias params.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a model architecture',
      reason: 'Drop a .arch / JSON dump or CSV block list — or load the sample ranker.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  return null;
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
