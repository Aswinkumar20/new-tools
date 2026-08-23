import { SQLS_SAMPLE } from '../constants/sql-schema-viewer-sample.data';
import { SQLS_MAX_FILE_BYTES, SQLS_SUPPORTED_EXTENSIONS } from '../constants/sql-schema-viewer.constants';
import type {
  SqlsDataset,
  SqlsFk,
  SqlsLoadedFile,
  SqlsMetadataRow,
  SqlsSuggestion,
  SqlsTable
} from '../types/sql-schema-viewer.types';
import { parseSqlSchemaBytes } from './sql-schema-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatSqlsFileSize,
  readFileBytes as readSqlsFileBytes
} from './diagram-file.utils';

export {
  filterSqlsFks,
  filterSqlsTables,
  parseSqlSchemaBytes,
  parseSqlSchemaText
} from './sql-schema-viewer-parse.utils';
export { renderSqlsDiagram, renderSqlsFks, renderSqlsTables, sqlsTableColor } from './sql-schema-viewer-render.utils';

export function isSupportedSqlsFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SQLS_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateSqlsFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SQLS_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(SQLS_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSqlsFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed SQL files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedSqlsFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .sql, .ddl, .md, .txt, .json, or .xml)' });
      continue;
    }
    const sizeError = validateSqlsFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleSqlsFile(): File {
  return new File([SQLS_SAMPLE], 'sample-shop-schema.sql', { type: 'text/plain', lastModified: 0 });
}

export function createSqlsFileRecord(file: File, bytes: Uint8Array): SqlsLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SqlsDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSqlSchemaBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.tables.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse SQL schema');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSqls(file: SqlsLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSqlsMetadataRows(dataset: SqlsDataset): SqlsMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Tables', value: String(dataset.tables.length) },
    { key: 'FKs', value: String(dataset.fks.length) }
  ];
}

export function buildSqlsTableMetadata(table: SqlsTable): SqlsMetadataRow[] {
  return [
    { key: 'Id', value: table.id },
    { key: 'Name', value: table.name },
    { key: 'Columns', value: String(table.columns.length) },
    { key: 'PK', value: table.columns.filter((c) => c.pk).map((c) => c.name).join(', ') || '—' },
    { key: 'FK', value: table.columns.filter((c) => c.fk).map((c) => c.name).join(', ') || '—' }
  ];
}

export function buildSqlsFkMetadata(fk: SqlsFk): SqlsMetadataRow[] {
  return [
    { key: 'Name', value: fk.name || '—' },
    { key: 'From', value: `${fk.sourceName}.${fk.sourceColumn}` },
    { key: 'To', value: `${fk.targetName}.${fk.targetColumn}` }
  ];
}

export function exportSqlsSummaryJson(file: SqlsLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed SQL schema');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      tables: parsed.tables.map((t) => ({ id: t.id, name: t.name, columns: t.columns })),
      fks: parsed.fks.map((fk) => ({
        name: fk.name,
        source: fk.source,
        target: fk.target,
        sourceColumn: fk.sourceColumn,
        targetColumn: fk.targetColumn
      }))
    },
    null,
    2
  );
}

export function exportSqlsTablesCsv(dataset: SqlsDataset): string {
  const lines = ['index,id,name,columns,pk,fk'];
  for (const t of dataset.tables) {
    lines.push(
      [
        t.index + 1,
        csv(t.id),
        csv(t.name),
        t.columns.length,
        csv(t.columns.filter((c) => c.pk).map((c) => c.name).join('|')),
        csv(t.columns.filter((c) => c.fk).map((c) => c.name).join('|'))
      ].join(',')
    );
  }
  return lines.join('\n');
}

export function exportSqlsFksCsv(dataset: SqlsDataset): string {
  const lines = ['index,source,target,source_column,target_column,name'];
  for (const fk of dataset.fks) {
    lines.push([fk.index + 1, csv(fk.source), csv(fk.target), csv(fk.sourceColumn), csv(fk.targetColumn), csv(fk.name)].join(','));
  }
  return lines.join('\n');
}

export function resolveSqlsSuggestion(state: { hasFiles: boolean; hasError: boolean }): SqlsSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop SQL sample',
      reason: 'Load a local table-and-FK view of customer, shop_order, product, and order_item.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a SQL schema',
      reason: 'Drop .sql, .ddl, JSON, or XML — or load the sample shop schema.',
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
