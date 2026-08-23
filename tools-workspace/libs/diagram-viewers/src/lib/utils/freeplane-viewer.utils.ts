import { FP_MM_SAMPLE } from '../constants/freeplane-viewer-sample.data';
import { FP_MAX_FILE_BYTES, FP_SUPPORTED_EXTENSIONS } from '../constants/freeplane-viewer.constants';
import type {
  FpDataset,
  FpIconGroup,
  FpLoadedFile,
  FpMetadataRow,
  FpNode,
  FpSuggestion
} from '../types/freeplane-viewer.types';
import { parseFreeplaneBytes } from './freeplane-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatFpFileSize,
  readFileBytes as readFpFileBytes
} from './diagram-file.utils';

export {
  expandFpMatches,
  filterFpNodes,
  hiddenByFpCollapse,
  parseFreeplaneBytes,
  parseFreeplaneText,
  setFpCollapsedAll,
  toggleFpCollapsed,
  visibleFpNodes
} from './freeplane-viewer-parse.utils';
export { fpDepthColor, fpIconColor, renderFpDiagram, renderFpIcons } from './freeplane-viewer-render.utils';

export function isSupportedFpFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (FP_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateFpFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > FP_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(FP_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidFpFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Freeplane files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedFpFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .mm, .xml, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateFpFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleFpFile(): File {
  return new File([FP_MM_SAMPLE], 'sample-shop-freeplane.mm', { type: 'application/xml', lastModified: 0 });
}

export function createFpFileRecord(file: File, bytes: Uint8Array): FpLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: FpDataset | null = null;
  let softFail = false;
  try {
    parsed = parseFreeplaneBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Freeplane map');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportFp(file: FpLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildFpMetadataRows(dataset: FpDataset): FpMetadataRow[] {
  const iconCount = dataset.nodes.reduce((m, n) => m + n.icons.length, 0);
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Nodes', value: String(dataset.nodes.length) },
    { key: 'Icons', value: String(iconCount) },
    { key: 'Icon types', value: String(dataset.icons.length) }
  ];
}

export function buildFpNodeMetadata(node: FpNode): FpMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Label', value: node.label },
    { key: 'Depth', value: String(node.depth) },
    { key: 'Icons', value: node.icons.join(', ') || '—' },
    { key: 'Attributes', value: node.attributes.map((a) => `${a.name}=${a.value}`).join(', ') || '—' },
    { key: 'Note', value: node.note || '—' }
  ];
}

export function buildFpIconMetadata(icon: FpIconGroup): FpMetadataRow[] {
  return [
    { key: 'Icon', value: icon.name },
    { key: 'Count', value: String(icon.count) },
    { key: 'Nodes', value: icon.nodeIds.join(', ') }
  ];
}

export function exportFpSummaryJson(file: FpLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Freeplane map');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      version: parsed.version,
      rootId: parsed.rootId,
      nodes: parsed.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        icons: n.icons,
        attributes: n.attributes,
        note: n.note,
        depth: n.depth,
        parentId: n.parentId
      })),
      icons: parsed.icons.map((i) => ({ name: i.name, count: i.count, nodeIds: i.nodeIds }))
    },
    null,
    2
  );
}

export function exportFpNodesCsv(dataset: FpDataset): string {
  const lines = ['index,id,label,depth,icons,attributes,note'];
  for (const n of dataset.nodes) {
    lines.push(
      [
        n.index + 1,
        csv(n.id),
        csv(n.label),
        n.depth,
        csv(n.icons.join('|')),
        csv(n.attributes.map((a) => `${a.name}=${a.value}`).join('|')),
        csv(n.note)
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function exportFpIconsCsv(dataset: FpDataset): string {
  const lines = ['index,icon,count,nodes'];
  for (const icon of dataset.icons) {
    lines.push([icon.index + 1, csv(icon.name), icon.count, csv(icon.nodeIds.join('|'))].join(','));
  }
  return lines.join('\n');
}

export function resolveFpSuggestion(state: { hasFiles: boolean; hasError: boolean }): FpSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop Freeplane sample',
      reason: 'Load a local .mm map with folder, idea, and checkout icons.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a Freeplane map',
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
