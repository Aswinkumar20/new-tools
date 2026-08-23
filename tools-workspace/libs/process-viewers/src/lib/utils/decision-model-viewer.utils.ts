import { DECISION_MODEL_JSON_SAMPLE } from '../constants/decision-model-sample.data';
import {
  DECISION_MODEL_MAX_FILE_BYTES,
  DECISION_MODEL_SUPPORTED_EXTENSIONS
} from '../constants/decision-model-viewer.constants';
import type {
  DecisionModelDataset,
  DecisionModelDecision,
  DecisionModelDependency,
  DecisionModelLoadedFile,
  DecisionModelMetadataRow,
  DecisionModelRule,
  DecisionModelSuggestion
} from '../types/decision-model-viewer.types';
import { parseDecisionModelBytes } from './decision-model-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatDecisionModelFileSize,
  readFileBytes as readDecisionModelFileBytes
} from './process-file.utils';

export {
  filterDecisionModelDecisions,
  filterDecisionModelDependencies,
  filterDecisionModelRules,
  parseDecisionModelBytes,
  parseDecisionModelText
} from './decision-model-parse.utils';
export {
  decisionModelDepColor,
  decisionModelKindColor,
  renderDecisionModelDecisions,
  renderDecisionModelDependencies,
  renderDecisionModelKinds
} from './decision-model-render.utils';

export function isSupportedDecisionModelFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (DECISION_MODEL_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateDecisionModelFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > DECISION_MODEL_MAX_FILE_BYTES) {
    return `File is too large (max ${formatProcessFileSize(DECISION_MODEL_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidDecisionModelFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed decision models are not supported — decompress first' });
      continue;
    }
    if (!isSupportedDecisionModelFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .json, .dmn, .xml, or .csv)' });
      continue;
    }
    const sizeError = validateDecisionModelFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleDecisionModelFile(): File {
  return new File([DECISION_MODEL_JSON_SAMPLE], 'sample-pricing-model.json', { type: 'application/json', lastModified: 0 });
}

export function createDecisionModelFileRecord(file: File, bytes: Uint8Array): DecisionModelLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: DecisionModelDataset | null = null;
  let softFail = false;
  try {
    parsed = parseDecisionModelBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.decisions.length && !parsed.rules.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse decision model');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportDecisionModel(file: DecisionModelLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildDecisionModelMetadataRows(dataset: DecisionModelDataset): DecisionModelMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Version', value: dataset.version || '—' },
    { key: 'Decisions', value: String(dataset.decisions.length) },
    { key: 'Rules', value: String(dataset.rules.length) },
    { key: 'Dependencies', value: String(dataset.dependencies.length) },
    { key: 'Kinds', value: dataset.kinds.map((k) => `${k.name} ${k.count}`).join(', ') || '—' }
  ];
}

export function buildDecisionModelDecisionMetadata(decision: DecisionModelDecision): DecisionModelMetadataRow[] {
  return [
    { key: 'ID', value: decision.id },
    { key: 'Name', value: decision.name },
    { key: 'Kind', value: decision.kind },
    { key: 'Hit policy', value: decision.hitPolicy || '—' },
    { key: 'Depends on', value: decision.dependsOn.join(', ') || '—' },
    { key: 'Inputs', value: decision.inputs.join(', ') || '—' },
    { key: 'Outputs', value: decision.outputs.join(', ') || '—' },
    { key: 'Rules', value: String(decision.ruleCount) }
  ];
}

export function buildDecisionModelRuleMetadata(rule: DecisionModelRule): DecisionModelMetadataRow[] {
  return [
    { key: 'Decision', value: rule.decisionName },
    { key: 'When', value: rule.when || '—' },
    { key: 'Then', value: rule.then || '—' },
    { key: 'Note', value: rule.annotation || '—' }
  ];
}

export function buildDecisionModelDependencyMetadata(dep: DecisionModelDependency): DecisionModelMetadataRow[] {
  return [
    { key: 'Type', value: dep.type },
    { key: 'Source', value: dep.sourceName || dep.source },
    { key: 'Target', value: dep.targetName || dep.target }
  ];
}

export function exportDecisionModelSummaryJson(file: DecisionModelLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed decision model');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      version: parsed.version,
      kinds: parsed.kinds,
      hitPolicies: parsed.hitPolicies,
      decisions: parsed.decisions,
      rules: parsed.rules.map((r) => ({ decision: r.decisionName, when: r.when, then: r.then })),
      dependencies: parsed.dependencies.map((d) => ({ type: d.type, source: d.sourceName, target: d.targetName }))
    },
    null,
    2
  );
}

export function exportDecisionModelRulesCsv(dataset: DecisionModelDataset): string {
  const lines = ['index,decision,when,then,annotation'];
  for (const r of dataset.rules) {
    lines.push([r.index + 1, csv(r.decisionName), csv(r.when), csv(r.then), csv(r.annotation)].join(','));
  }
  return lines.join('\n');
}

export function exportDecisionModelDependenciesCsv(dataset: DecisionModelDataset): string {
  const lines = ['index,type,source,target'];
  for (const d of dataset.dependencies) {
    lines.push([d.index + 1, d.type, csv(d.sourceName), csv(d.targetName)].join(','));
  }
  return lines.join('\n');
}

export function resolveDecisionModelSuggestion(state: { hasFiles: boolean; hasError: boolean }): DecisionModelSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the pricing model sample',
      reason: 'Load a local decision model with tables, expressions, and dependency links.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a decision model',
      reason: 'Drop JSON, DMN/XML, or CSV — or load the sample order pricing model.',
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
