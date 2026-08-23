import { DT_SAMPLE } from '../constants/decision-tree-viewer-sample.data';
import { DT_MAX_FILE_BYTES, DT_SUPPORTED_EXTENSIONS } from '../constants/decision-tree-viewer.constants';
import type { DtDataset, DtLoadedFile, DtMetadataRow, DtNode, DtSuggestion, DtEdge } from '../types/decision-tree-viewer.types';
import { parseDecisionTreeBytes } from './decision-tree-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatDtFileSize,
  readFileBytes as readDtFileBytes
} from './diagram-file.utils';

export {
  filterDtBranches,
  filterDtEdges,
  filterDtLeaves,
  parseDecisionTreeBytes,
  parseDecisionTreeText
} from './decision-tree-viewer-parse.utils';
export { dtNodeColor, renderDtBranches, renderDtDiagram, renderDtLeaves } from './decision-tree-viewer-render.utils';

export function isSupportedDtFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DT_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateDtFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DT_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(DT_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDtFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed decision tree files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedDtFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .xml, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateDtFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDtFile(): File {
  return new File([DT_SAMPLE], 'sample-shop-tree.json', { type: 'application/json', lastModified: 0 });
}

export function createDtFileRecord(file: File, bytes: Uint8Array): DtLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DtDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDecisionTreeBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse decision tree');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDt(file: DtLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDtMetadataRows(dataset: DtDataset): DtMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Root', value: dataset.root || '—' },
    { key: 'Branches', value: String(dataset.branches.length) },
    { key: 'Leaves', value: String(dataset.leaves.length) },
    { key: 'Edges', value: String(dataset.edges.length) }
  ];
}

export function buildDtBranchMetadata(node: DtNode): DtMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Name', value: node.name },
    { key: 'Kind', value: node.kind },
    { key: 'Feature', value: node.feature || '—' },
    { key: 'Operator', value: node.operator || '—' },
    { key: 'Threshold', value: node.threshold || '—' }
  ];
}

export function buildDtLeafMetadata(node: DtNode): DtMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Name', value: node.name },
    { key: 'Value', value: node.value || node.name },
    { key: 'Samples', value: node.samples || '—' }
  ];
}

export function buildDtEdgeMetadata(edge: DtEdge): DtMetadataRow[] {
  return [
    { key: 'From', value: edge.sourceName || edge.source },
    { key: 'Label', value: edge.label || '—' },
    { key: 'To', value: edge.targetName || edge.target }
  ];
}

export function exportDtSummaryJson(file: DtLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed decision tree');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      root: parsed.root,
      branches: parsed.branches.map((n) => ({
        id: n.id,
        name: n.name,
        kind: n.kind,
        feature: n.feature,
        operator: n.operator,
        threshold: n.threshold
      })),
      leaves: parsed.leaves.map((n) => ({ id: n.id, name: n.name, value: n.value })),
      edges: parsed.edges.map((e) => ({ source: e.source, target: e.target, label: e.label }))
    },
    null,
    2
  );
}

export function exportDtBranchesCsv(dataset: DtDataset): string {
  const lines = ['index,id,name,kind,feature,operator,threshold'];
  for (const n of dataset.branches) {
    lines.push([n.index + 1, csv(n.id), csv(n.name), n.kind, csv(n.feature), csv(n.operator), csv(n.threshold)].join(','));
  }
  return lines.join('\n');
}

export function exportDtLeavesCsv(dataset: DtDataset): string {
  const lines = ['index,id,name,value'];
  for (const n of dataset.leaves) {
    lines.push([n.index + 1, csv(n.id), csv(n.name), csv(n.value || n.name)].join(','));
  }
  return lines.join('\n');
}

export function resolveDtSuggestion(state: { hasFiles: boolean; hasError: boolean }): DtSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop checkout sample',
      reason: 'Load a local checkout tree: cartTotal → itemCount → shipping class.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a decision tree',
      reason: 'Drop JSON, XML, CSV, or Markdown — or load the sample checkout tree.',
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
