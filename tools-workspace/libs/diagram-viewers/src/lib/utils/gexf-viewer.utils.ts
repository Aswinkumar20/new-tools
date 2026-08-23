import { GXF_GEXF_SAMPLE } from '../constants/gexf-viewer-sample.data';
import { GXF_MAX_FILE_BYTES, GXF_SUPPORTED_EXTENSIONS } from '../constants/gexf-viewer.constants';
import type {
  GxfCommunity,
  GxfDataset,
  GxfEdge,
  GxfLoadedFile,
  GxfMetadataRow,
  GxfNode,
  GxfSuggestion
} from '../types/gexf-viewer.types';
import { parseGexfBytes } from './gexf-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatGxfFileSize,
  readFileBytes as readGxfFileBytes
} from './diagram-file.utils';

export { filterGxfEdges, filterGxfNodes, isGxfActive, parseGexfBytes, parseGexfText } from './gexf-viewer-parse.utils';
export { gxfCommunityColor, gxfNodeColor, renderGxfCommunities, renderGxfDiagram, renderGxfEdges, renderGxfTimeline } from './gexf-viewer-render.utils';

export function isSupportedGxfFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (GXF_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateGxfFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > GXF_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(GXF_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidGxfFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed GEXF files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedGxfFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .gexf, .xml, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateGxfFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleGxfFile(): File {
  return new File([GXF_GEXF_SAMPLE], 'sample-shop.gexf', { type: 'application/xml', lastModified: 0 });
}

export function createGxfFileRecord(file: File, bytes: Uint8Array): GxfLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: GxfDataset | null = null;
  let softFail = false;
  try {
    parsed = parseGexfBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse GEXF');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportGxf(file: GxfLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildGxfMetadataRows(dataset: GxfDataset): GxfMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Mode', value: dataset.mode },
    { key: 'Directed', value: dataset.directed ? 'yes' : 'no' },
    { key: 'Time', value: dataset.mode === 'dynamic' ? `${dataset.timeMin}–${dataset.timeMax}` : '—' },
    { key: 'Nodes', value: String(dataset.nodes.length) },
    { key: 'Edges', value: String(dataset.edges.length) },
    { key: 'Communities', value: String(dataset.communities.length) }
  ];
}

export function buildGxfNodeMetadata(node: GxfNode): GxfMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Label', value: node.label },
    { key: 'Community', value: node.community || '—' },
    { key: 'Start', value: node.start || '—' },
    { key: 'End', value: node.end || '—' }
  ];
}

export function buildGxfEdgeMetadata(edge: GxfEdge): GxfMetadataRow[] {
  return [
    { key: 'From', value: edge.sourceName || edge.source },
    { key: 'To', value: edge.targetName || edge.target },
    { key: 'Label', value: edge.label || '—' },
    { key: 'Weight', value: String(edge.weight) },
    { key: 'Start', value: edge.start || '—' },
    { key: 'End', value: edge.end || '—' }
  ];
}

export function buildGxfCommunityMetadata(community: GxfCommunity): GxfMetadataRow[] {
  return [
    { key: 'Name', value: community.name },
    { key: 'Size', value: String(community.size) },
    { key: 'Nodes', value: community.nodeIds.join(', ') }
  ];
}

export function exportGxfSummaryJson(file: GxfLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed GEXF network');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      directed: parsed.directed,
      mode: parsed.mode,
      timeMin: parsed.timeMin,
      timeMax: parsed.timeMax,
      nodes: parsed.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        community: n.community,
        start: n.start,
        end: n.end
      })),
      edges: parsed.edges.map((e) => ({
        source: e.source,
        target: e.target,
        label: e.label,
        weight: e.weight,
        start: e.start,
        end: e.end
      })),
      communities: parsed.communities.map((c) => ({ name: c.name, size: c.size, nodeIds: c.nodeIds }))
    },
    null,
    2
  );
}

export function exportGxfNodesCsv(dataset: GxfDataset): string {
  const lines = ['index,id,label,community,start,end'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, csv(n.id), csv(n.label), csv(n.community), csv(n.start), csv(n.end)].join(','));
  }
  return lines.join('\n');
}

export function exportGxfEdgesCsv(dataset: GxfDataset): string {
  const lines = ['index,source,target,label,weight,start,end'];
  for (const e of dataset.edges) {
    lines.push([e.index + 1, csv(e.source), csv(e.target), csv(e.label), e.weight, csv(e.start), csv(e.end)].join(','));
  }
  return lines.join('\n');
}

export function resolveGxfSuggestion(state: { hasFiles: boolean; hasError: boolean }): GxfSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop GEXF sample',
      reason: 'Load a local dynamic network with shoppers and checkout communities.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a GEXF network',
      reason: 'Drop .gexf, JSON, or Markdown — or load the sample shop graph.',
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
