import { SARIF_JSON_SAMPLE } from '../constants/sarif-sample.data';
import { SARIF_MAX_FILE_BYTES, SARIF_SUPPORTED_EXTENSIONS } from '../constants/sarif-report-viewer.constants';
import type {
  SarifDataset,
  SarifLoadedFile,
  SarifLocationStat,
  SarifMetadataRow,
  SarifResult,
  SarifRuleStat,
  SarifSuggestion
} from '../types/sarif-report-viewer.types';
import { parseSarifBytes } from './sarif-report-parse.utils';
import { bytesToText, formatNetworkFileSize, getFileExtension } from './network-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatNetworkFileSize as formatSarifFileSize,
  readFileBytes as readSarifFileBytes
} from './network-file.utils';

export { filterSarifLocations, filterSarifResults, filterSarifRules, parseSarifBytes, parseSarifText } from './sarif-report-parse.utils';
export { renderSarifLevels, renderSarifLocations, renderSarifRules, sarifLevelColor } from './sarif-report-render.utils';

export function isSupportedSarifFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (SARIF_SUPPORTED_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name));
}

export function validateSarifFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > SARIF_MAX_FILE_BYTES) return `File is too large (max ${formatNetworkFileSize(SARIF_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidSarifFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed SARIF reports are not supported — decompress first' });
      continue;
    }
    if (!isSupportedSarifFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .sarif, .json, or .csv)' });
      continue;
    }
    const sizeError = validateSarifFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleSarifFile(): File {
  return new File([SARIF_JSON_SAMPLE], 'sample-app.sarif', { type: 'application/sarif+json', lastModified: 0 });
}

export function createSarifFileRecord(file: File, bytes: Uint8Array): SarifLoadedFile {
  const extension = getFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: SarifDataset | null = null;
  let softFail = false;
  try {
    parsed = parseSarifBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.results.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse SARIF report');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportSarif(file: SarifLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildSarifMetadataRows(dataset: SarifDataset): SarifMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Tool', value: dataset.tool || '—' },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Results', value: String(dataset.results.length) },
    { key: 'Rules', value: String(dataset.rules.length) },
    { key: 'Locations', value: String(dataset.locations.length) },
    { key: 'Levels', value: dataset.levels.map((l) => `${l.name} ${l.count}`).join(', ') || '—' }
  ];
}

export function buildSarifResultMetadata(result: SarifResult): SarifMetadataRow[] {
  const loc =
    result.startLine == null
      ? '—'
      : `${result.startLine}${result.startColumn != null ? `:${result.startColumn}` : ''}${result.endLine != null && result.endLine !== result.startLine ? `–${result.endLine}` : ''}`;
  return [
    { key: 'Rule', value: result.ruleId },
    { key: 'Rule name', value: result.ruleName || '—' },
    { key: 'Level', value: result.level },
    { key: 'File', value: result.file || '—' },
    { key: 'Line', value: loc },
    { key: 'Tool', value: result.tool || '—' },
    { key: 'Message', value: result.message || '—' },
    { key: 'Snippet', value: result.snippet || '—' }
  ];
}

export function buildSarifRuleMetadata(rule: SarifRuleStat): SarifMetadataRow[] {
  return [
    { key: 'Rule', value: rule.id },
    { key: 'Name', value: rule.name || '—' },
    { key: 'Level', value: rule.level },
    { key: 'Results', value: String(rule.count) },
    { key: 'Description', value: rule.description || '—' }
  ];
}

export function buildSarifLocationMetadata(location: SarifLocationStat): SarifMetadataRow[] {
  return [
    { key: 'File', value: location.file || '—' },
    { key: 'Results', value: String(location.count) }
  ];
}

export function exportSarifSummaryJson(file: SarifLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed SARIF report');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      tool: parsed.tool,
      version: parsed.version,
      sourceKind: parsed.sourceKind,
      levels: parsed.levels,
      rules: parsed.rules,
      locations: parsed.locations,
      results: parsed.results.map((r) => ({
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        level: r.level,
        file: r.file,
        startLine: r.startLine,
        startColumn: r.startColumn,
        message: r.message
      }))
    },
    null,
    2
  );
}

export function exportSarifResultsCsv(dataset: SarifDataset): string {
  const lines = ['index,rule_id,rule_name,level,file,line,column,message'];
  for (const r of dataset.results) {
    lines.push(
      [r.index + 1, csv(r.ruleId), csv(r.ruleName), r.level, csv(r.file), r.startLine ?? '', r.startColumn ?? '', csv(r.message)].join(',')
    );
  }
  return lines.join('\n');
}

export function exportSarifRulesCsv(dataset: SarifDataset): string {
  const lines = ['rule_id,name,level,count,description'];
  for (const r of dataset.rules) {
    lines.push([csv(r.id), csv(r.name), r.level, r.count, csv(r.description)].join(','));
  }
  return lines.join('\n');
}

export function resolveSarifSuggestion(state: { hasFiles: boolean; hasError: boolean }): SarifSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the EasyLint SARIF sample',
      reason: 'Load a local SARIF 2.1 export with error, warning, and note results.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a SARIF report',
      reason: 'Drop a .sarif, JSON, or CSV export — or load the sample app findings.',
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
