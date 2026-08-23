import { CMAP_CXL_SAMPLE } from '../constants/concept-map-viewer-sample.data';
import { CMAP_MAX_FILE_BYTES, CMAP_SUPPORTED_EXTENSIONS } from '../constants/concept-map-viewer.constants';
import type {
  CmapDataset,
  CmapLink,
  CmapLoadedFile,
  CmapMetadataRow,
  CmapNode,
  CmapSuggestion
} from '../types/concept-map-viewer.types';
import { parseConceptMapBytes } from './concept-map-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatCmapFileSize,
  readFileBytes as readCmapFileBytes
} from './diagram-file.utils';

export {
  filterCmapLinks,
  filterCmapNodes,
  parseConceptMapBytes,
  parseConceptMapText
} from './concept-map-viewer-parse.utils';
export { cmapNodeColor, renderCmapDiagram, renderCmapLinks, renderCmapNodes } from './concept-map-viewer-render.utils';

export function isSupportedCmapFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (CMAP_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateCmapFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > CMAP_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(CMAP_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidCmapFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed concept map files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedCmapFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .cxl, .cmap, .xml, .json, .md, .txt, or .dot)' });
      continue;
    }
    const sizeError = validateCmapFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleCmapFile(): File {
  return new File([CMAP_CXL_SAMPLE], 'sample-shop-concept.cxl', { type: 'text/xml', lastModified: 0 });
}

export function createCmapFileRecord(file: File, bytes: Uint8Array): CmapLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: CmapDataset | null = null;
  let softFail = false;
  try {
    parsed = parseConceptMapBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse concept map');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportCmap(file: CmapLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildCmapMetadataRows(dataset: CmapDataset): CmapMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Nodes', value: String(dataset.nodes.length) },
    { key: 'Links', value: String(dataset.links.length) }
  ];
}

export function buildCmapNodeMetadata(node: CmapNode): CmapMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Label', value: node.label },
    { key: 'Note', value: node.note || '—' }
  ];
}

export function buildCmapLinkMetadata(link: CmapLink): CmapMetadataRow[] {
  return [
    { key: 'From', value: link.sourceName || link.source },
    { key: 'To', value: link.targetName || link.target },
    { key: 'Relation', value: link.label || '—' }
  ];
}

export function exportCmapSummaryJson(file: CmapLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed concept map');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      nodes: parsed.nodes.map((n) => ({ id: n.id, label: n.label, note: n.note })),
      links: parsed.links.map((l) => ({ source: l.source, target: l.target, label: l.label }))
    },
    null,
    2
  );
}

export function exportCmapNodesCsv(dataset: CmapDataset): string {
  const lines = ['index,id,label,note'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, csv(n.id), csv(n.label), csv(n.note)].join(','));
  }
  return lines.join('\n');
}

export function exportCmapLinksCsv(dataset: CmapDataset): string {
  const lines = ['index,source,target,label'];
  for (const l of dataset.links) {
    lines.push([l.index + 1, csv(l.source), csv(l.target), csv(l.label)].join(','));
  }
  return lines.join('\n');
}

export function resolveCmapSuggestion(state: { hasFiles: boolean; hasError: boolean }): CmapSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop concept map sample',
      reason: 'Load a local node-and-link view of Customer, Cart, Checkout, and Payment.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a concept map',
      reason: 'Drop CmapTools CXL, JSON, Markdown, or DOT — or load the sample shop concept map.',
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
