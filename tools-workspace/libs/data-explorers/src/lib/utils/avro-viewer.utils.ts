import { AV_MAX_FILE_BYTES, AV_SUPPORTED_EXTENSIONS } from '../constants/avro-viewer.constants';
import type { AvDataset, AvField, AvLoadedFile, AvMetadataRow, AvRecord, AvSuggestion } from '../types/avro-viewer.types';
import { buildSampleAvroBytes, parseAvroBytes } from './avro-viewer-parse.utils';
import { bytesToText, dataBytesToBlobPart, formatDataFileSize, getDataFileExtension } from './data-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDataFileSize as formatAvFileSize,
  readFileBytes as readAvFileBytes
} from './data-file.utils';

export { buildSampleAvroBytes, filterAvFields, filterAvRecords, parseAvroBytes, parseAvroText } from './avro-viewer-parse.utils';
export { avFieldColor, renderAvDiagram, renderAvSample, renderAvSchema } from './avro-viewer-render.utils';

export function isSupportedAvFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (AV_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDataFileExtension(file.name));
}

export function validateAvFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > AV_MAX_FILE_BYTES) return `File is too large (max ${formatDataFileSize(AV_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidAvFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Avro files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedAvFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .avro, .avsc, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateAvFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleAvFile(): File {
  return new File([dataBytesToBlobPart(buildSampleAvroBytes())], 'clickstream.avro', { type: 'application/avro', lastModified: 0 });
}

export function createAvFileRecord(file: File, bytes: Uint8Array): AvLoadedFile {
  const extension = getDataFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: AvDataset | null = null;
  let softFail = false;
  try {
    parsed = parseAvroBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.fields.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Avro');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportAv(file: AvLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildAvMetadataRows(dataset: AvDataset): AvMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Namespace', value: dataset.namespace || '—' },
    { key: 'Record', value: dataset.recordName || '—' },
    { key: 'Codec', value: dataset.codec || '—' },
    { key: 'Fields', value: String(dataset.fields.length) },
    { key: 'Records', value: String(dataset.records.length) }
  ];
}

export function buildAvFieldMetadata(field: AvField): AvMetadataRow[] {
  return [
    { key: 'Name', value: field.name },
    { key: 'Type', value: field.type },
    { key: 'Nullable', value: field.nullable ? 'yes' : 'no' },
    { key: 'Default', value: field.defaultValue || '—' }
  ];
}

export function buildAvRecordMetadata(record: AvRecord): AvMetadataRow[] {
  return Object.entries(record.values).map(([key, value]) => ({ key, value: value || '—' }));
}

export function exportAvSummaryJson(file: AvLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Avro file');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      namespace: parsed.namespace,
      record: parsed.recordName,
      codec: parsed.codec,
      fields: parsed.fields.map((f) => ({ name: f.name, type: f.type, nullable: f.nullable })),
      records: parsed.records.map((r) => r.values)
    },
    null,
    2
  );
}

export function exportAvSchemaCsv(dataset: AvDataset): string {
  const lines = ['index,name,type,nullable'];
  for (const f of dataset.fields) {
    lines.push([f.index + 1, csv(f.name), csv(f.type), f.nullable ? 'yes' : 'no'].join(','));
  }
  return lines.join('\n');
}

export function exportAvRecordsCsv(dataset: AvDataset): string {
  const header = dataset.fields.map((f) => f.name);
  const lines = [header.map(csv).join(',')];
  for (const record of dataset.records) {
    lines.push(header.map((h) => csv(record.values[h] || '')).join(','));
  }
  return lines.join('\n');
}

export function resolveAvSuggestion(state: { hasFiles: boolean; hasError: boolean }): AvSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the clickstream sample',
      reason: 'Load a local Avro container with ClickEvent records.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open Avro records',
      reason: 'Drop a .avro, .avsc, or JSON dump — or load the clickstream sample.',
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
