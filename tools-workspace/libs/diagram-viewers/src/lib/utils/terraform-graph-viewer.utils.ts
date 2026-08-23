import { TF_SAMPLE } from '../constants/terraform-graph-viewer-sample.data';
import { TF_MAX_FILE_BYTES, TF_SUPPORTED_EXTENSIONS } from '../constants/terraform-graph-viewer.constants';
import type {
  TfDataset,
  TfEdge,
  TfLoadedFile,
  TfMetadataRow,
  TfResource,
  TfSuggestion
} from '../types/terraform-graph-viewer.types';
import { parseTerraformGraphBytes } from './terraform-graph-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatTfFileSize,
  readFileBytes as readTfFileBytes
} from './diagram-file.utils';

export {
  filterTfEdges,
  filterTfResources,
  parseTerraformGraphBytes,
  parseTerraformGraphText
} from './terraform-graph-viewer-parse.utils';
export { renderTfDiagram, renderTfEdges, renderTfResources, tfResourceColor } from './terraform-graph-viewer-render.utils';

export function isSupportedTfFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (TF_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateTfFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > TF_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(TF_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidTfFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Terraform graph files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedTfFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .dot, .gv, .tfgraph, .json, .xml, .md, or .txt)' });
      continue;
    }
    const sizeError = validateTfFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleTfFile(): File {
  return new File([TF_SAMPLE], 'sample-shop.dot', { type: 'text/vnd.graphviz', lastModified: 0 });
}

export function createTfFileRecord(file: File, bytes: Uint8Array): TfLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: TfDataset | null = null;
  let softFail = false;
  try {
    parsed = parseTerraformGraphBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.resources.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Terraform graph');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportTf(file: TfLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildTfMetadataRows(dataset: TfDataset): TfMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Resources', value: String(dataset.resources.length) },
    { key: 'Edges', value: String(dataset.edges.length) }
  ];
}

export function buildTfResourceMetadata(resource: TfResource): TfMetadataRow[] {
  return [
    { key: 'Id', value: resource.id },
    { key: 'Name', value: resource.name },
    { key: 'Type', value: resource.type },
    { key: 'Provider', value: resource.provider || '—' }
  ];
}

export function buildTfEdgeMetadata(edge: TfEdge): TfMetadataRow[] {
  return [
    { key: 'From', value: edge.sourceName || edge.source },
    { key: 'To', value: edge.targetName || edge.target },
    { key: 'Label', value: edge.label || '—' }
  ];
}

export function exportTfSummaryJson(file: TfLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Terraform graph');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      resources: parsed.resources.map((r) => ({ id: r.id, name: r.name, type: r.type, provider: r.provider })),
      edges: parsed.edges.map((e) => ({ source: e.source, target: e.target, label: e.label }))
    },
    null,
    2
  );
}

export function exportTfResourcesCsv(dataset: TfDataset): string {
  const lines = ['index,id,name,type,provider'];
  for (const r of dataset.resources) {
    lines.push([r.index + 1, csv(r.id), csv(r.name), csv(r.type), csv(r.provider)].join(','));
  }
  return lines.join('\n');
}

export function exportTfEdgesCsv(dataset: TfDataset): string {
  const lines = ['index,source,target,label'];
  for (const e of dataset.edges) {
    lines.push([e.index + 1, csv(e.source), csv(e.target), csv(e.label)].join(','));
  }
  return lines.join('\n');
}

export function resolveTfSuggestion(state: { hasFiles: boolean; hasError: boolean }): TfSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop Terraform sample',
      reason: 'Load a local vpc → subnet → instance dependency graph.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Terraform graph',
      reason: 'Drop `terraform graph` DOT, JSON, or XML — or load the sample shop graph.',
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
