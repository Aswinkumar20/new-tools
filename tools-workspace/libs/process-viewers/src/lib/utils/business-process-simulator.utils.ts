import { BPSIM_BPMN_SAMPLE } from '../constants/business-process-simulator-sample.data';
import { BPSIM_MAX_FILE_BYTES, BPSIM_SUPPORTED_EXTENSIONS } from '../constants/business-process-simulator.constants';
import type {
  BpsimDataset,
  BpsimLoadedFile,
  BpsimMetadataRow,
  BpsimNode,
  BpsimScenario,
  BpsimStep,
  BpsimSuggestion
} from '../types/business-process-simulator.types';
import { initialBpsimMarking, parseBpsimBytes, tokenTotal } from './business-process-simulator-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatBpsimFileSize,
  readFileBytes as readBpsimFileBytes
} from './process-file.utils';

export {
  enabledBpsimIds,
  filterBpsimNodes,
  filterBpsimScenarios,
  fireBpsimStep,
  formatBpsimMarking,
  initialBpsimMarking,
  parseBpsimBytes,
  parseBpsimText,
  tokenTotal
} from './business-process-simulator-parse.utils';

export {
  bpsimNodeColor,
  bpsimScenarioColor,
  renderBpsimGraph,
  renderBpsimScenarios,
  renderBpsimTokens,
  renderBpsimTrace
} from './business-process-simulator-render.utils';

export function isSupportedBpsimFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (BPSIM_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateBpsimFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > BPSIM_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(BPSIM_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidBpsimFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed simulator files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedBpsimFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .bpmn, .pnml, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validateBpsimFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleBpsimFile(): File {
  return new File([BPSIM_BPMN_SAMPLE], 'sample-order-sim.bpmn', { type: 'application/xml', lastModified: 0 });
}

export function createBpsimFileRecord(file: File, bytes: Uint8Array): BpsimLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: BpsimDataset | null = null;
  let softFail = false;
  try {
    parsed = parseBpsimBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse simulator file');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportBpsim(file: BpsimLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildBpsimMetadataRows(
  dataset: BpsimDataset,
  marking: Record<string, number>,
  enabledCount: number,
  stepCount: number,
  scenarioName: string
): BpsimMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Engine', value: dataset.engine },
    { key: 'Nodes', value: String(dataset.nodes.length) },
    { key: 'Flows', value: String(dataset.edges.length) },
    { key: 'Scenarios', value: String(dataset.scenarios.length) },
    { key: 'Scenario', value: scenarioName || '—' },
    { key: 'Tokens', value: String(tokenTotal(marking)) },
    { key: 'Enabled', value: String(enabledCount) },
    { key: 'Steps', value: String(stepCount) }
  ];
}

export function buildBpsimNodeMetadata(node: BpsimNode, tokens: number, enabled: boolean): BpsimMetadataRow[] {
  return [
    { key: 'Name', value: node.name },
    { key: 'Kind', value: node.kind },
    { key: 'Gateway', value: node.gatewayType || '—' },
    { key: 'Tokens', value: String(tokens) },
    { key: 'Enabled', value: enabled ? 'yes' : 'no' },
    { key: 'In / out', value: `${node.inCount} / ${node.outCount}` }
  ];
}

export function buildBpsimScenarioMetadata(scenario: BpsimScenario): BpsimMetadataRow[] {
  const tokenKeys = Object.keys(scenario.marking).filter((k) => scenario.marking[k] > 0);
  const choiceKeys = Object.keys(scenario.choices);
  return [
    { key: 'Name', value: scenario.name },
    { key: 'Description', value: scenario.description || '—' },
    { key: 'Marked', value: tokenKeys.length ? tokenKeys.map((k) => `${k}=${scenario.marking[k]}`).join(', ') : '—' },
    { key: 'Choices', value: choiceKeys.length ? choiceKeys.map((k) => `${k}→${scenario.choices[k]}`).join(', ') : '—' }
  ];
}

export function exportBpsimSummaryJson(
  file: BpsimLoadedFile,
  marking: Record<string, number>,
  trace: BpsimStep[],
  scenarioName: string
): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed simulator model');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      engine: parsed.engine,
      scenario: scenarioName,
      tokens: tokenTotal(marking),
      marking: parsed.nodes.map((n) => ({ id: n.id, name: n.name, kind: n.kind, tokens: marking[n.id] ?? 0 })),
      scenarios: parsed.scenarios.map((s) => ({ id: s.id, name: s.name, marking: s.marking, choices: s.choices })),
      trace: trace.map((t) => ({ step: t.step, node: t.nodeName, marking: t.marking }))
    },
    null,
    2
  );
}

export function exportBpsimScenariosCsv(dataset: BpsimDataset): string {
  const lines = ['index,id,name,description,marking,choices'];
  for (const s of dataset.scenarios) {
    const marking = Object.entries(s.marking)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(';');
    const choices = Object.entries(s.choices)
      .map(([k, v]) => `${k}=${v}`)
      .join(';');
    lines.push([s.index + 1, csv(s.id), csv(s.name), csv(s.description), csv(marking), csv(choices)].join(','));
  }
  return lines.join('\n');
}

export function exportBpsimTraceCsv(trace: BpsimStep[]): string {
  const lines = ['step,node_id,node_name,marking'];
  for (const t of trace) {
    lines.push([t.step, csv(t.nodeId), csv(t.nodeName), csv(t.marking)].join(','));
  }
  return lines.join('\n');
}

export function resolveBpsimSuggestion(state: { hasFiles: boolean; hasError: boolean }): BpsimSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the order fulfillment sample',
      reason: 'Load a local BPMN process with in-stock and backorder scenarios.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a process to simulate',
      reason: 'Drop BPMN, PNML, JSON, or CSV — or load the sample order process.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  return null;
}

export function scenarioChoices(scenario: BpsimScenario | null): Record<string, string> {
  return scenario ? { ...scenario.choices } : {};
}

export function applyScenarioMarking(dataset: BpsimDataset, scenario: BpsimScenario | null): Record<string, number> {
  return initialBpsimMarking(dataset, scenario);
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
