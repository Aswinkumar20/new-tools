import { GML_GRAPHML_SAMPLE } from '../constants/graphml-viewer-sample.data';
import { GML_MAX_FILE_BYTES, GML_SUPPORTED_EXTENSIONS } from '../constants/graphml-viewer.constants';
import type {
  GmlCommunity,
  GmlDataset,
  GmlEdge,
  GmlLoadedFile,
  GmlMetadataRow,
  GmlNode,
  GmlSuggestion
} from '../types/graphml-viewer.types';
import { parseGraphmlBytes } from './graphml-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatGmlFileSize,
  readFileBytes as readGmlFileBytes
} from './diagram-file.utils';

export {
  filterGmlEdges,
  filterGmlNodes,
  parseGraphmlBytes,
  parseGraphmlText,
  relayoutGml
} from './graphml-viewer-parse.utils';
export {
  gmlCommunityColor,
  gmlNodeColor,
  renderGmlCommunities,
  renderGmlDiagram,
  renderGmlEdges,
  renderGmlLayout
} from './graphml-viewer-render.utils';

export function isSupportedGmlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (GML_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateGmlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > GML_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(GML_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidGmlFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed GraphML files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedGmlFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .graphml, .xml, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateGmlFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleGmlFile(): File {
  return new File([GML_GRAPHML_SAMPLE], 'sample-shop.graphml', { type: 'application/xml', lastModified: 0 });
}

export function createGmlFileRecord(file: File, bytes: Uint8Array): GmlLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: GmlDataset | null = null;
  let softFail = false;
  try {
    parsed = parseGraphmlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse GraphML');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportGml(file: GmlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildGmlMetadataRows(dataset: GmlDataset): GmlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Directed', value: dataset.directed ? 'yes' : 'no' },
    { key: 'Nodes', value: String(dataset.nodes.length) },
    { key: 'Edges', value: String(dataset.edges.length) },
    { key: 'Communities', value: String(dataset.communities.length) }
  ];
}

export function buildGmlNodeMetadata(node: GmlNode): GmlMetadataRow[] {
  return [
    { key: 'Id', value: node.id },
    { key: 'Label', value: node.label },
    { key: 'Community', value: node.community || '—' },
    { key: 'Rank', value: String(node.rank) }
  ];
}

export function buildGmlEdgeMetadata(edge: GmlEdge): GmlMetadataRow[] {
  return [
    { key: 'From', value: edge.sourceName || edge.source },
    { key: 'To', value: edge.targetName || edge.target },
    { key: 'Label', value: edge.label || '—' },
    { key: 'Weight', value: String(edge.weight) }
  ];
}

export function buildGmlCommunityMetadata(community: GmlCommunity): GmlMetadataRow[] {
  return [
    { key: 'Name', value: community.name },
    { key: 'Size', value: String(community.size) },
    { key: 'Nodes', value: community.nodeIds.join(', ') }
  ];
}

export function exportGmlSummaryJson(file: GmlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed GraphML network');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      directed: parsed.directed,
      nodes: parsed.nodes.map((n) => ({ id: n.id, label: n.label, community: n.community, rank: n.rank })),
      edges: parsed.edges.map((e) => ({ source: e.source, target: e.target, label: e.label, weight: e.weight })),
      communities: parsed.communities.map((c) => ({ name: c.name, size: c.size, nodeIds: c.nodeIds }))
    },
    null,
    2
  );
}

export function exportGmlNodesCsv(dataset: GmlDataset): string {
  const lines = ['index,id,label,community,rank'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, csv(n.id), csv(n.label), csv(n.community), n.rank].join(','));
  }
  return lines.join('\n');
}

export function exportGmlEdgesCsv(dataset: GmlDataset): string {
  const lines = ['index,source,target,label,weight'];
  for (const e of dataset.edges) {
    lines.push([e.index + 1, csv(e.source), csv(e.target), csv(e.label), e.weight].join(','));
  }
  return lines.join('\n');
}

export function resolveGmlSuggestion(state: { hasFiles: boolean; hasError: boolean }): GmlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop GraphML sample',
      reason: 'Load a local network with shoppers and checkout communities.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a GraphML network',
      reason: 'Drop .graphml, JSON, or Markdown — or load the sample shop graph.',
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
