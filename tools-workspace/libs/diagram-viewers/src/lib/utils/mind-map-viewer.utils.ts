import { MMAP_MARKDOWN_SAMPLE } from '../constants/mind-map-viewer-sample.data';
import { MMAP_MAX_FILE_BYTES, MMAP_SUPPORTED_EXTENSIONS } from '../constants/mind-map-viewer.constants';
import type { MmapDataset, MmapLoadedFile, MmapMetadataRow, MmapNode, MmapSuggestion } from '../types/mind-map-viewer.types';
import { parseMindMapBytes } from './mind-map-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatMmapFileSize,
  readFileBytes as readMmapFileBytes
} from './diagram-file.utils';

export {
  expandMmapMatches,
  filterMmapNodes,
  hiddenByCollapse,
  parseMindMapBytes,
  parseMindMapText,
  setMmapCollapsedAll,
  toggleMmapCollapsed,
  visibleMmapNodes
} from './mind-map-viewer-parse.utils';
export { mmapDepthColor, renderMmapDiagram } from './mind-map-viewer-render.utils';

export function isSupportedMmapFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (MMAP_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateMmapFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > MMAP_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(MMAP_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidMmapFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed mind map files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedMmapFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .md, .mmd, .opml, .json, .txt, or .xml)' });
      continue;
    }
    const sizeError = validateMmapFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleMmapFile(): File {
  return new File([MMAP_MARKDOWN_SAMPLE], 'sample-shop-mind.md', { type: 'text/markdown', lastModified: 0 });
}

export function createMmapFileRecord(file: File, bytes: Uint8Array): MmapLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: MmapDataset | null = null;
  let softFail = false;
  try {
    parsed = parseMindMapBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse mind map');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportMmap(file: MmapLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildMmapMetadataRows(dataset: MmapDataset): MmapMetadataRow[] {
  const maxDepth = dataset.nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const branches = dataset.nodes.filter((n) => n.childIds.length).length;
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Topics', value: String(dataset.nodes.length) },
    { key: 'Branches', value: String(branches) },
    { key: 'Max depth', value: String(maxDepth) }
  ];
}

export function buildMmapNodeMetadata(node: MmapNode): MmapMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Label', value: node.label },
    { key: 'Depth', value: String(node.depth) },
    { key: 'Parent', value: node.parentId || '—' },
    { key: 'Children', value: String(node.childIds.length) },
    { key: 'Collapsed', value: node.collapsed ? 'yes' : 'no' },
    { key: 'Note', value: node.note || '—' }
  ];
}

export function exportMmapSummaryJson(file: MmapLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed mind map');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      rootId: parsed.rootId,
      nodes: parsed.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        note: n.note,
        depth: n.depth,
        parentId: n.parentId,
        childIds: n.childIds,
        collapsed: n.collapsed
      }))
    },
    null,
    2
  );
}

export function exportMmapNodesCsv(dataset: MmapDataset): string {
  const lines = ['index,id,label,depth,parent,children,note'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, csv(n.id), csv(n.label), n.depth, csv(n.parentId), n.childIds.length, csv(n.note)].join(','));
  }
  return lines.join('\n');
}

export function exportMmapOutlineTxt(dataset: MmapDataset): string {
  const byId = new Map(dataset.nodes.map((n) => [n.id, n] as const));
  const lines: string[] = [];
  const walk = (id: string): void => {
    const node = byId.get(id);
    if (!node) return;
    lines.push(`${'  '.repeat(node.depth)}${node.label}`);
    if (node.collapsed) return;
    for (const child of node.childIds) walk(child);
  };
  walk(dataset.rootId);
  return lines.join('\n');
}

export function resolveMmapSuggestion(state: { hasFiles: boolean; hasError: boolean }): MmapSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop mind map sample',
      reason: 'Load a local markdown mind map with customer and checkout branches.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a mind map',
      reason: 'Drop Markdown, Mermaid, OPML, or JSON — or load the sample shop map.',
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
