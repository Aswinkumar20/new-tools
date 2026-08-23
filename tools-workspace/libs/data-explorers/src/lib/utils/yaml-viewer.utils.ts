import { YL_MAX_FILE_BYTES, YL_SUPPORTED_EXTENSIONS } from '../constants/yaml-viewer.constants';
import type { YlDataset, YlIssue, YlLoadedFile, YlMetadataRow, YlNode, YlSuggestion } from '../types/yaml-viewer.types';
import { buildSampleYamlBytes, parseYamlBytes } from './yaml-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatYlFileSize,
  readFileBytes as readYlFileBytes
} from './data-file.utils';

export {
  buildSampleYamlBytes,
  filterYlIssues,
  filterYlNodes,
  filterYlRows,
  parseYamlBytes,
  parseYamlText
} from './yaml-viewer-parse.utils';
export { renderYlPreview, renderYlTree, renderYlValidate, ylTypeColor } from './yaml-viewer-render.utils';

export function isSupportedYlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (YL_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateYlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > YL_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(YL_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidYlFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed YAML files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedYlFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .yaml, .yml, .json, .csv, .md, or .txt)' });
      continue;
    }
    const sizeError = validateYlFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleYlFile(): File {
  return new File([dataBytesToBlobPart(buildSampleYamlBytes())], 'k8s-deploy.yaml', { type: 'text/yaml', lastModified: 0 });
}

export function createYlFileRecord(file: File, bytes: Uint8Array): YlLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: YlDataset | null = null;
  let softFail = false;
  try {
    parsed = parseYamlBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse YAML');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportYl(file: YlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildYlMetadataRows(dataset: YlDataset): YlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Root type', value: dataset.rootType },
    { key: 'Valid', value: dataset.valid ? 'yes' : 'no' },
    { key: 'Issues', value: String(dataset.issues.length) },
    { key: 'Nodes', value: String(dataset.nodeCount) },
    { key: 'Depth', value: String(dataset.maxDepth) },
    { key: 'Rows', value: String(dataset.rows.length) }
  ];
}

export function buildYlNodeMetadata(node: YlNode): YlMetadataRow[] {
  return [
    { key: 'Name', value: node.name },
    { key: 'Path', value: node.path },
    { key: 'Type', value: node.type },
    { key: 'Value', value: node.value || '—' },
    { key: 'Depth', value: String(node.depth) },
    { key: 'Children', value: String(node.childCount) }
  ];
}

export function buildYlIssueMetadata(issue: YlIssue): YlMetadataRow[] {
  return [
    { key: 'Severity', value: issue.severity },
    { key: 'Code', value: issue.code },
    { key: 'Line', value: issue.line ? String(issue.line) : '—' },
    { key: 'Path', value: issue.path || '—' },
    { key: 'Message', value: issue.message }
  ];
}

export function exportYlSummaryJson(file: YlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed YAML document');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      rootType: parsed.rootType,
      valid: parsed.valid,
      nodeCount: parsed.nodeCount,
      issues: parsed.issues,
      schema: parsed.schema,
      columns: parsed.columns,
      rows: parsed.rows
    },
    null,
    2
  );
}

export function exportYlSchemaCsv(dataset: YlDataset): string {
  const lines = ['path,name,type,nullable,childCount,sample'];
  for (const s of dataset.schema) {
    lines.push([csv(s.path), csv(s.name), csv(s.type), s.nullable ? 'yes' : 'no', s.childCount, csv(s.sample)].join(','));
  }
  return lines.join('\n');
}

export function exportYlRowsCsv(dataset: YlDataset): string {
  const header = dataset.columns.map((c) => c.name);
  const lines = [header.map(csv).join(',')];
  for (const row of dataset.rows) {
    lines.push(header.map((h) => csv(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveYlSuggestion(state: { hasFiles: boolean; hasError: boolean }): YlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the Kubernetes deploy sample',
      reason: 'Load a local YAML document with orders, nested lists, and a null note.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a YAML document',
      reason: 'Drop a .yaml / .yml file, JSON dump, or CSV — or load the Kubernetes deploy sample.',
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
