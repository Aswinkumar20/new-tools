import { FM_MM_SAMPLE } from '../constants/freemind-viewer-sample.data';
import { FM_MAX_FILE_BYTES, FM_SUPPORTED_EXTENSIONS } from '../constants/freemind-viewer.constants';
import type { FmDataset, FmLoadedFile, FmMetadataRow, FmNode, FmSuggestion } from '../types/freemind-viewer.types';
import { parseFreemindBytes } from './freemind-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatFmFileSize,
  readFileBytes as readFmFileBytes
} from './diagram-file.utils';

export {
  expandFmMatches,
  filterFmNodes,
  hiddenByFmCollapse,
  parseFreemindBytes,
  parseFreemindText,
  setFmCollapsedAll,
  toggleFmCollapsed,
  visibleFmNodes
} from './freemind-viewer-parse.utils';
export { fmDepthColor, renderFmDiagram } from './freemind-viewer-render.utils';

export function isSupportedFmFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (FM_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateFmFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > FM_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(FM_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidFmFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed FreeMind files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedFmFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .mm, .xml, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateFmFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleFmFile(): File {
  return new File([FM_MM_SAMPLE], 'sample-shop.mm', { type: 'application/xml', lastModified: 0 });
}

export function createFmFileRecord(file: File, bytes: Uint8Array): FmLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: FmDataset | null = null;
  let softFail = false;
  try {
    parsed = parseFreemindBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse FreeMind map');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportFm(file: FmLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildFmMetadataRows(dataset: FmDataset): FmMetadataRow[] {
  const notes = dataset.nodes.filter((n) => !!n.note).length;
  const maxDepth = dataset.nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Topics', value: String(dataset.nodes.length) },
    { key: 'Notes', value: String(notes) },
    { key: 'Max depth', value: String(maxDepth) }
  ];
}

export function buildFmNodeMetadata(node: FmNode): FmMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Label', value: node.label },
    { key: 'Depth', value: String(node.depth) },
    { key: 'Position', value: node.position || '—' },
    { key: 'Parent', value: node.parentId || '—' },
    { key: 'Children', value: String(node.childIds.length) },
    { key: 'Note', value: node.note || '—' }
  ];
}

export function exportFmSummaryJson(file: FmLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed FreeMind map');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      rootId: parsed.rootId,
      nodes: parsed.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        note: n.note,
        position: n.position,
        depth: n.depth,
        parentId: n.parentId,
        childIds: n.childIds
      }))
    },
    null,
    2
  );
}

export function exportFmNodesCsv(dataset: FmDataset): string {
  const lines = ['index,id,label,depth,position,parent,note'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, csv(n.id), csv(n.label), n.depth, csv(n.position), csv(n.parentId), csv(n.note)].join(','));
  }
  return lines.join('\n');
}

export function exportFmNotesTxt(dataset: FmDataset): string {
  const lines = dataset.nodes.filter((n) => n.note).map((n) => `${n.label}\n${n.note}`);
  return lines.join('\n\n') || 'No notes.';
}

export function resolveFmSuggestion(state: { hasFiles: boolean; hasError: boolean }): FmSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop FreeMind sample',
      reason: 'Load a local .mm map with customer notes and a checkout branch.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a FreeMind map',
      reason: 'Drop a .mm, JSON, or Markdown file — or load the sample shop map.',
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
