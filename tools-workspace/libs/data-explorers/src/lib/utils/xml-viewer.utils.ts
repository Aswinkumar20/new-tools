import { XM_MAX_FILE_BYTES, XM_SUPPORTED_EXTENSIONS } from '../constants/xml-viewer.constants';
import type {
  XmAttribute,
  XmDataset,
  XmLoadedFile,
  XmMetadataRow,
  XmNode,
  XmSuggestion
} from '../types/xml-viewer.types';
import { buildSampleXmlBytes, parseXmlBytes } from './xml-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatXmFileSize,
  readFileBytes as readXmFileBytes
} from './data-file.utils';

export {
  buildSampleXmlBytes,
  filterXmAttributes,
  filterXmNodes,
  filterXmRows,
  parseXmlBytes,
  parseXmlText
} from './xml-viewer-parse.utils';
export { renderXmAttributes, renderXmNodes, renderXmPreview, xmNodeColor } from './xml-viewer-render.utils';

export function isSupportedXmFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (XM_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateXmFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > XM_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(XM_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidXmFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed XML files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedXmFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .xml, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateXmFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleXmFile(): File {
  return new File([dataBytesToBlobPart(buildSampleXmlBytes())], 'catalog-feed.xml', { type: 'application/xml', lastModified: 0 });
}

export function createXmFileRecord(file: File, bytes: Uint8Array): XmLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: XmDataset | null = null;
  let softFail = false;
  try {
    parsed = parseXmlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse XML');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportXm(file: XmLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildXmMetadataRows(dataset: XmDataset): XmMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Root', value: dataset.rootName || '—' },
    { key: 'Encoding', value: dataset.encoding || '—' },
    { key: 'Nodes', value: String(dataset.nodeCount) },
    { key: 'Attributes', value: String(dataset.attrCount) },
    { key: 'Depth', value: String(dataset.maxDepth) },
    { key: 'Rows', value: String(dataset.rows.length) }
  ];
}

export function buildXmNodeMetadata(node: XmNode): XmMetadataRow[] {
  return [
    { key: 'Name', value: node.name },
    { key: 'Path', value: node.path },
    { key: 'Text', value: node.text || '—' },
    { key: 'Depth', value: String(node.depth) },
    { key: 'Children', value: String(node.childCount) },
    { key: 'Attributes', value: String(node.attrCount) }
  ];
}

export function buildXmAttributeMetadata(attr: XmAttribute): XmMetadataRow[] {
  return [
    { key: 'Name', value: attr.name },
    { key: 'Value', value: attr.value },
    { key: 'Owner', value: attr.ownerName },
    { key: 'Path', value: attr.owner }
  ];
}

export function exportXmSummaryJson(file: XmLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed XML document');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      root: parsed.rootName,
      encoding: parsed.encoding,
      nodeCount: parsed.nodeCount,
      attrCount: parsed.attrCount,
      nodes: parsed.nodes,
      attributes: parsed.attributes,
      schema: parsed.schema,
      columns: parsed.columns,
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportXmSchemaCsv(dataset: XmDataset): string {
  const lines = ['path,name,attrCount,childCount,sample'];
  for (const s of dataset.schema) {
    lines.push([csv(s.path), csv(s.name), s.attrCount, s.childCount, csv(s.sample)].join(','));
  }
  return lines.join('\n');
}

export function exportXmRowsCsv(dataset: XmDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveXmSuggestion(state: { hasFiles: boolean; hasError: boolean }): XmSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the catalog feed sample',
      reason: 'Load a local XML document with catalog items, attributes, and notes.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an XML document',
      reason: 'Drop a .xml file, JSON dump, or CSV — or load the catalog feed sample.',
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
