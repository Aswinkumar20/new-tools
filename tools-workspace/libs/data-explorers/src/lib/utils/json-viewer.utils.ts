import { JN_MAX_FILE_BYTES, JN_SUPPORTED_EXTENSIONS } from '../constants/json-viewer.constants';
import type {
  JnColumn,
  JnDataset,
  JnLoadedFile,
  JnMetadataRow,
  JnNode,
  JnSchemaEntry,
  JnSuggestion
} from '../types/json-viewer.types';
import { buildSampleJsonBytes, parseJsonBytes } from './json-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatJnFileSize,
  readFileBytes as readJnFileBytes
} from './data-file.utils';

export {
  buildSampleJsonBytes,
  filterJnNodes,
  filterJnRows,
  filterJnSchema,
  parseJsonBytes,
  parseJsonText
} from './json-viewer-parse.utils';
export { jnTypeColor, renderJnPreview, renderJnSchema, renderJnTree } from './json-viewer-render.utils';

export function isSupportedJnFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (JN_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateJnFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > JN_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(JN_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidJnFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed JSON files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedJnFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .jsonl, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateJnFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleJnFile(): File {
  return new File([dataBytesToBlobPart(buildSampleJsonBytes())], 'api-users.json', { type: 'application/json', lastModified: 0 });
}

export function createJnFileRecord(file: File, bytes: Uint8Array): JnLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: JnDataset | null = null;
  let softFail = false;
  try {
    parsed = parseJsonBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse JSON');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportJn(file: JnLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildJnMetadataRows(dataset: JnDataset): JnMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Root type', value: dataset.rootType },
    { key: 'Encoding', value: dataset.encoding || '—' },
    { key: 'Nodes', value: String(dataset.nodeCount) },
    { key: 'Depth', value: String(dataset.maxDepth) },
    { key: 'Schema paths', value: String(dataset.schema.length) },
    { key: 'Rows', value: String(dataset.rows.length) }
  ];
}

export function buildJnNodeMetadata(node: JnNode): JnMetadataRow[] {
  return [
    { key: 'Name', value: node.name },
    { key: 'Path', value: node.path },
    { key: 'Type', value: node.type },
    { key: 'Value', value: node.value || '—' },
    { key: 'Depth', value: String(node.depth) },
    { key: 'Children', value: String(node.childCount) }
  ];
}

export function buildJnSchemaMetadata(entry: JnSchemaEntry): JnMetadataRow[] {
  return [
    { key: 'Path', value: entry.path },
    { key: 'Name', value: entry.name },
    { key: 'Type', value: entry.type },
    { key: 'Nullable', value: entry.nullable ? 'yes' : 'no' },
    { key: 'Children', value: String(entry.childCount) },
    { key: 'Sample', value: entry.sample || '—' }
  ];
}

export function buildJnColumnMetadata(column: JnColumn): JnMetadataRow[] {
  return [
    { key: 'Name', value: column.name },
    { key: 'Type', value: column.type }
  ];
}

export function exportJnSummaryJson(file: JnLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed JSON document');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      rootType: parsed.rootType,
      nodeCount: parsed.nodeCount,
      maxDepth: parsed.maxDepth,
      schema: parsed.schema,
      columns: parsed.columns,
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportJnSchemaCsv(dataset: JnDataset): string {
  const lines = ['path,name,type,nullable,childCount,sample'];
  for (const s of dataset.schema) {
    lines.push([csv(s.path), csv(s.name), csv(s.type), s.nullable ? 'yes' : 'no', s.childCount, csv(s.sample)].join(','));
  }
  return lines.join('\n');
}

export function exportJnRowsCsv(dataset: JnDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveJnSuggestion(state: { hasFiles: boolean; hasError: boolean }): JnSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the API users sample',
      reason: 'Load a local JSON document with orders, nested objects, and a null note.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a JSON document',
      reason: 'Drop a .json / .jsonl file, CSV dump, or Markdown — or load the API users sample.',
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
