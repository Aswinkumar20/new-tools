import { DMN_XML_SAMPLE } from '../constants/dmn-sample.data';
import { DMN_MAX_FILE_BYTES, DMN_SUPPORTED_EXTENSIONS } from '../constants/dmn-viewer.constants';
import type {
  DmnDataset,
  DmnDecisionTable,
  DmnDrdNode,
  DmnLoadedFile,
  DmnMetadataRow,
  DmnRule,
  DmnSuggestion
} from '../types/dmn-viewer.types';
import { parseDmnBytes } from './dmn-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatDmnFileSize,
  readFileBytes as readDmnFileBytes
} from './process-file.utils';

export { filterDmnNodes, filterDmnRules, filterDmnTables, parseDmnBytes, parseDmnText } from './dmn-parse.utils';
export { dmnHitPolicyColor, dmnNodeKindColor, renderDmnDrd, renderDmnHitPolicies } from './dmn-render.utils';

export function isSupportedDmnFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DMN_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateDmnFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DMN_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(DMN_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidDmnFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed DMN files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedDmnFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .dmn, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validateDmnFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDmnFile(): File {
  return new File([DMN_XML_SAMPLE], 'sample-loan-approval.dmn', { type: 'application/xml', lastModified: 0 });
}

export function createDmnFileRecord(file: File, bytes: Uint8Array): DmnLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DmnDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDmnBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.tables.length && !parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse DMN model');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDmn(file: DmnLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDmnMetadataRows(dataset: DmnDataset): DmnMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Namespace', value: dataset.namespace || '—' },
    { key: 'Tables', value: String(dataset.tables.length) },
    { key: 'Rules', value: String(dataset.rules.length) },
    { key: 'DRD nodes', value: String(dataset.nodes.length) },
    { key: 'Hit policies', value: dataset.hitPolicies.map((p) => `${p.name} ${p.count}`).join(', ') || '—' }
  ];
}

export function buildDmnTableMetadata(table: DmnDecisionTable): DmnMetadataRow[] {
  return [
    { key: 'ID', value: table.id },
    { key: 'Name', value: table.name },
    { key: 'Hit policy', value: table.hitPolicy },
    { key: 'Inputs', value: table.inputs.map((c) => c.label).join(', ') || '—' },
    { key: 'Outputs', value: table.outputs.map((c) => c.label).join(', ') || '—' },
    { key: 'Rules', value: String(table.ruleCount) }
  ];
}

export function buildDmnRuleMetadata(rule: DmnRule): DmnMetadataRow[] {
  return [
    { key: 'Table', value: rule.tableName },
    { key: 'Hit policy', value: rule.hitPolicy },
    { key: 'When', value: rule.inputs.join(' / ') || '—' },
    { key: 'Then', value: rule.outputs.join(' / ') || '—' },
    { key: 'Note', value: rule.annotation || '—' }
  ];
}

export function buildDmnNodeMetadata(node: DmnDrdNode): DmnMetadataRow[] {
  return [
    { key: 'ID', value: node.id },
    { key: 'Name', value: node.name },
    { key: 'Kind', value: node.kind }
  ];
}

export function exportDmnSummaryJson(file: DmnLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed DMN model');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      namespace: parsed.namespace,
      hitPolicies: parsed.hitPolicies,
      tables: parsed.tables.map((t) => ({
        id: t.id,
        name: t.name,
        hitPolicy: t.hitPolicy,
        inputs: t.inputs.map((c) => c.label),
        outputs: t.outputs.map((c) => c.label),
        ruleCount: t.ruleCount
      })),
      rules: parsed.rules.map((r) => ({ table: r.tableName, when: r.inputs, then: r.outputs })),
      nodes: parsed.nodes,
      edges: parsed.edges
    },
    null,
    2
  );
}

export function exportDmnRulesCsv(dataset: DmnDataset): string {
  const lines = ['index,table,hit_policy,when,then'];
  for (const r of dataset.rules) {
    lines.push([r.index + 1, csv(r.tableName), r.hitPolicy, csv(r.inputs.join(' / ')), csv(r.outputs.join(' / '))].join(','));
  }
  return lines.join('\n');
}

export function exportDmnTablesCsv(dataset: DmnDataset): string {
  const lines = ['id,name,hit_policy,inputs,outputs,rules'];
  for (const t of dataset.tables) {
    lines.push([csv(t.id), csv(t.name), t.hitPolicy, csv(t.inputs.map((c) => c.label).join('|')), csv(t.outputs.map((c) => c.label).join('|')), t.ruleCount].join(','));
  }
  return lines.join('\n');
}

export function resolveDmnSuggestion(state: { hasFiles: boolean; hasError: boolean }): DmnSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the loan approval DMN sample',
      reason: 'Load a local DMN 1.3 model with UNIQUE/FIRST tables and a small DRD.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a DMN model',
      reason: 'Drop a .dmn, XML, JSON, or CSV export — or load the sample loan approval model.',
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
