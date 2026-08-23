import { GVZ_DOT_SAMPLE } from '../constants/graphviz-dot-viewer-sample.data';
import { GVZ_MAX_FILE_BYTES, GVZ_SUPPORTED_EXTENSIONS } from '../constants/graphviz-dot-viewer.constants';
import type {
  GvzDataset,
  GvzEdge,
  GvzLayout,
  GvzLoadedFile,
  GvzMetadataRow,
  GvzNode,
  GvzSuggestion
} from '../types/graphviz-dot-viewer.types';
import { applyGvzLayout, parseDotBytes } from './graphviz-dot-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatGvzFileSize,
  readFileBytes as readGvzFileBytes
} from './diagram-file.utils';

export { applyGvzLayout, filterGvzEdges, filterGvzNodes, parseDotBytes, parseDotText } from './graphviz-dot-parse.utils';
export { exportGvzSvg, gvzNodeColor, renderGvzEdges, renderGvzGraph, renderGvzNodes } from './graphviz-dot-render.utils';

export function isSupportedGvzFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (GVZ_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateGvzFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > GVZ_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(GVZ_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidGvzFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed DOT files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedGvzFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .dot, .gv, .md, .txt, or .json)' });
      continue;
    }
    const sizeError = validateGvzFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleGvzFile(): File {
  return new File([GVZ_DOT_SAMPLE], 'sample-checkout.dot', { type: 'text/vnd.graphviz', lastModified: 0 });
}

export function createGvzFileRecord(file: File, bytes: Uint8Array): GvzLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: GvzDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDotBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DOT graph');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportGvz(file: GvzLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function relayoutGvz(dataset: GvzDataset, layout: GvzLayout): void {
  dataset.layout = layout;
  applyGvzLayout(dataset.nodes, dataset.edges, layout, dataset.rankdir);
}

export function buildGvzMetadataRows(dataset: GvzDataset): GvzMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Directed', value: dataset.directed ? 'yes' : 'no' },
    { key: 'Layout', value: dataset.layout },
    { key: 'Rankdir', value: dataset.rankdir },
    { key: 'Nodes', value: String(dataset.nodes.length) },
    { key: 'Edges', value: String(dataset.edges.length) }
  ];
}

export function buildGvzNodeMetadata(node: GvzNode): GvzMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Name', value: node.name },
    { key: 'Shape', value: node.shape },
    { key: 'Group', value: node.group || '—' }
  ];
}

export function buildGvzEdgeMetadata(edge: GvzEdge): GvzMetadataRow[] {
  return [
    { key: 'From', value: edge.sourceName },
    { key: 'To', value: edge.targetName },
    { key: 'Label', value: edge.label || '—' },
    { key: 'Directed', value: edge.directed ? 'yes' : 'no' }
  ];
}

export function exportGvzSummaryJson(file: GvzLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed DOT graph');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      directed: parsed.directed,
      layout: parsed.layout,
      rankdir: parsed.rankdir,
      nodes: parsed.nodes.map((n) => ({ id: n.id, name: n.name, shape: n.shape, group: n.group })),
      edges: parsed.edges.map((e) => ({ source: e.source, target: e.target, label: e.label, directed: e.directed }))
    },
    null,
    2
  );
}

export function exportGvzNodesCsv(dataset: GvzDataset): string {
  const lines = ['index,id,name,shape,group'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, csv(n.id), csv(n.name), n.shape, csv(n.group)].join(','));
  }
  return lines.join('\n');
}

export function exportGvzEdgesCsv(dataset: GvzDataset): string {
  const lines = ['index,source,target,label,directed'];
  for (const e of dataset.edges) {
    lines.push([e.index + 1, csv(e.source), csv(e.target), csv(e.label), e.directed ? 'yes' : 'no'].join(','));
  }
  return lines.join('\n');
}

export function resolveGvzSuggestion(state: { hasFiles: boolean; hasError: boolean }): GvzSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the checkout DOT sample',
      reason: 'Load a local Graphviz digraph with LR rankdir and labeled edges.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Graphviz DOT graph',
      reason: 'Drop .dot, .gv, Markdown, or JSON — or load the sample checkout graph.',
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
