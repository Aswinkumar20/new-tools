import { DRL_SAMPLE } from '../constants/drools-rule-viewer-sample.data';
import { DRL_MAX_FILE_BYTES, DRL_SUPPORTED_EXTENSIONS } from '../constants/drools-rule-viewer.constants';
import type { DrlCondition, DrlDataset, DrlLoadedFile, DrlMetadataRow, DrlRule, DrlSuggestion } from '../types/drools-rule-viewer.types';
import { parseDroolsBytes } from './drools-rule-viewer-parse.utils';
import { bytesToText, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatDiagramFileSize as formatDrlFileSize,
  readFileBytes as readDrlFileBytes
} from './diagram-file.utils';

export { filterDrlConditions, filterDrlRules, parseDroolsBytes, parseDroolsText } from './drools-rule-viewer-parse.utils';
export { drlRuleColor, renderDrlConditions, renderDrlDiagram, renderDrlRules } from './drools-rule-viewer-render.utils';

export function isSupportedDrlFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DRL_SUPPORTED_EXTENSIONS as readonly string[]).includes(getDiagramFileExtension(file.name));
}

export function validateDrlFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DRL_MAX_FILE_BYTES) return `File is too large (max ${formatDiagramFileSize(DRL_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDrlFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed Drools files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedDrlFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .drl, .xml, .json, .md, or .txt)' });
      continue;
    }
    const sizeError = validateDrlFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDrlFile(): File {
  return new File([DRL_SAMPLE], 'sample-shop.drl', { type: 'text/plain', lastModified: 0 });
}

export function createDrlFileRecord(file: File, bytes: Uint8Array): DrlLoadedFile {
  const extension = getDiagramFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DrlDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDroolsBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.rules.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse Drools rules');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDrl(file: DrlLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDrlMetadataRows(dataset: DrlDataset): DrlMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Title', value: dataset.title || '—' },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Package', value: dataset.packageName || '—' },
    { key: 'Rules', value: String(dataset.rules.length) },
    { key: 'Conditions', value: String(dataset.conditions.length) }
  ];
}

export function buildDrlRuleMetadata(rule: DrlRule): DrlMetadataRow[] {
  return [
    { key: 'Id', value: rule.id },
    { key: 'Name', value: rule.name },
    { key: 'Salience', value: rule.salience || '—' },
    { key: 'Agenda', value: rule.agendaGroup || '—' },
    { key: 'Then', value: rule.thenText || '—' }
  ];
}

export function buildDrlConditionMetadata(condition: DrlCondition): DrlMetadataRow[] {
  return [
    { key: 'Rule', value: condition.ruleName },
    { key: 'Fact', value: condition.factType || '—' },
    { key: 'Modifier', value: condition.modifier || '—' },
    { key: 'Constraints', value: condition.constraints || '—' }
  ];
}

export function exportDrlSummaryJson(file: DrlLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed Drools rules');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      title: parsed.title,
      package: parsed.packageName,
      rules: parsed.rules.map((r) => ({
        id: r.id,
        name: r.name,
        salience: r.salience,
        agendaGroup: r.agendaGroup,
        then: r.thenText
      })),
      conditions: parsed.conditions.map((c) => ({
        rule: c.ruleName,
        fact: c.factType,
        constraints: c.constraints,
        modifier: c.modifier
      }))
    },
    null,
    2
  );
}

export function exportDrlRulesCsv(dataset: DrlDataset): string {
  const lines = ['index,id,name,salience,agenda'];
  for (const r of dataset.rules) {
    lines.push([r.index + 1, csv(r.id), csv(r.name), csv(r.salience), csv(r.agendaGroup)].join(','));
  }
  return lines.join('\n');
}

export function exportDrlConditionsCsv(dataset: DrlDataset): string {
  const lines = ['index,rule,fact,modifier,constraints'];
  for (const c of dataset.conditions) {
    lines.push([c.index + 1, csv(c.ruleName), csv(c.factType), csv(c.modifier), csv(c.constraints)].join(','));
  }
  return lines.join('\n');
}

export function resolveDrlSuggestion(state: { hasFiles: boolean; hasError: boolean }): DrlSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the shop checkout sample',
      reason: 'Load local Drools rules for free shipping and express upgrade.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open Drools rules',
      reason: 'Drop a .drl, JSON, XML, or Markdown file — or load the sample shop rules.',
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
