import { MMD_FLOWCHART_SAMPLE } from '../constants/mermaid-diagram-viewer-sample.data';
import { MMD_MAX_FILE_BYTES, MMD_SUPPORTED_EXTENSIONS } from '../constants/mermaid-diagram-viewer.constants';
import type {
  MmdDataset,
  MmdEdge,
  MmdLoadedFile,
  MmdMetadataRow,
  MmdNode,
  MmdSuggestion
} from '../types/mermaid-diagram-viewer.types';
import { parseMermaidBytes } from './mermaid-diagram-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatMmdFileSize,
  readFileBytes as readMmdFileBytes
} from './diagram-file.utils';

export { filterMmdEdges, filterMmdNodes, parseMermaidBytes, parseMermaidText } from './mermaid-diagram-parse.utils';
export { mmdNodeColor, renderMmdDiagram, renderMmdEdges, renderMmdNodes } from './mermaid-diagram-render.utils';

export function isSupportedMmdFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (MMD_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateMmdFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > MMD_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(MMD_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidMmdFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed mermaid files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedMmdFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .mmd, .mermaid, .md, .txt, or .json)' });
      continue;
    }
    const sizeError = validateMmdFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleMmdFile(): File {
  return new File([MMD_FLOWCHART_SAMPLE], 'sample-checkout-flow.mmd', { type: 'text/plain', lastModified: 0 });
}

export function createMmdFileRecord(file: File, bytes: Uint8Array): MmdLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: MmdDataset | null = null;
  let softFail = false;
  try {
    parsed = parseMermaidBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Mermaid diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportMmd(file: MmdLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildMmdMetadataRows(dataset: MmdDataset): MmdMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Kind', value: dataset.kind },
    { key: 'Direction', value: dataset.direction },
    { key: 'Nodes', value: String(dataset.nodes.length) },
    { key: 'Edges', value: String(dataset.edges.length) }
  ];
}

export function buildMmdNodeMetadata(node: MmdNode): MmdMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Name', value: node.name },
    { key: 'Shape', value: node.shape },
    { key: 'Group', value: node.group || '—' }
  ];
}

export function buildMmdEdgeMetadata(edge: MmdEdge): MmdMetadataRow[] {
  return [
    { key: 'From', value: edge.sourceName },
    { key: 'To', value: edge.targetName },
    { key: 'Label', value: edge.label || '—' },
    { key: 'Style', value: edge.style }
  ];
}

export function exportMmdSummaryJson(file: MmdLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Mermaid diagram');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      kind: parsed.kind,
      direction: parsed.direction,
      nodes: parsed.nodes.map((n) => ({ id: n.id, name: n.name, shape: n.shape, group: n.group })),
      edges: parsed.edges.map((e) => ({ source: e.source, target: e.target, label: e.label, style: e.style }))
    },
    null,
    2
  );
}

export function exportMmdNodesCsv(dataset: MmdDataset): string {
  const lines = ['index,id,name,shape,group'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, csv(n.id), csv(n.name), n.shape, csv(n.group)].join(','));
  }
  return lines.join('\n');
}

export function exportMmdEdgesCsv(dataset: MmdDataset): string {
  const lines = ['index,source,target,label,style'];
  for (const e of dataset.edges) {
    lines.push([e.index + 1, csv(e.source), csv(e.target), csv(e.label), e.style].join(','));
  }
  return lines.join('\n');
}

export function resolveMmdSuggestion(state: { hasFiles: boolean; hasError: boolean }): MmdSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the checkout flowchart sample',
      reason: 'Load a local Mermaid flowchart with a payment decision.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Mermaid diagram',
      reason: 'Drop .mmd, Markdown, or JSON — or load the sample checkout flow.',
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
