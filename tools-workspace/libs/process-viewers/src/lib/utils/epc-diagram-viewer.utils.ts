import { EPC_XML_SAMPLE } from '../constants/epc-sample.data';
import { EPC_MAX_FILE_BYTES, EPC_SUPPORTED_EXTENSIONS } from '../constants/epc-diagram-viewer.constants';
import type { EpcDataset, EpcFlow, EpcLoadedFile, EpcMetadataRow, EpcNode, EpcSuggestion } from '../types/epc-diagram-viewer.types';
import { parseEpcBytes } from './epc-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatEpcFileSize,
  readFileBytes as readEpcFileBytes
} from './process-file.utils';

export { filterEpcFlows, filterEpcNodes, parseEpcBytes, parseEpcText } from './epc-parse.utils';
export { epcKindColor, renderEpcDiagram, renderEpcKinds } from './epc-render.utils';

export function isSupportedEpcFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (EPC_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateEpcFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > EPC_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(EPC_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidEpcFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed EPC files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedEpcFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .epc, .xml, .json, or .csv)' });
      continue;
    }
    const sizeError = validateEpcFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleEpcFile(): File {
  return new File([EPC_XML_SAMPLE], 'sample-order-fulfillment.epc', { type: 'application/xml', lastModified: 0 });
}

export function createEpcFileRecord(file: File, bytes: Uint8Array): EpcLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: EpcDataset | null = null;
  let softFail = false;
  try {
    parsed = parseEpcBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse EPC diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportEpc(file: EpcLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildEpcMetadataRows(dataset: EpcDataset): EpcMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Nodes', value: String(dataset.nodes.length) },
    { key: 'Events', value: String(dataset.events.length) },
    { key: 'Functions', value: String(dataset.functions.length) },
    { key: 'Connectors', value: String(dataset.connectors.length) },
    { key: 'Flows', value: String(dataset.flows.length) },
    { key: 'Kinds', value: dataset.kinds.map((k) => `${k.name} ${k.count}`).join(', ') || '—' }
  ];
}

export function buildEpcNodeMetadata(node: EpcNode): EpcMetadataRow[] {
  return [
    { key: 'ID', value: node.id },
    { key: 'Name', value: node.name },
    { key: 'Kind', value: node.kind },
    { key: 'Incoming', value: String(node.inCount) },
    { key: 'Outgoing', value: String(node.outCount) }
  ];
}

export function buildEpcFlowMetadata(flow: EpcFlow): EpcMetadataRow[] {
  return [
    { key: 'From', value: flow.sourceName || flow.source },
    { key: 'To', value: flow.targetName || flow.target },
    { key: 'Label', value: flow.label || '—' }
  ];
}

export function exportEpcSummaryJson(file: EpcLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed EPC diagram');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      kinds: parsed.kinds,
      nodes: parsed.nodes.map((n) => ({ id: n.id, name: n.name, kind: n.kind, in: n.inCount, out: n.outCount })),
      flows: parsed.flows.map((f) => ({ source: f.sourceName, target: f.targetName, label: f.label }))
    },
    null,
    2
  );
}

export function exportEpcEventsCsv(dataset: EpcDataset): string {
  const lines = ['index,kind,id,name,incoming,outgoing'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, n.kind, csv(n.id), csv(n.name), n.inCount, n.outCount].join(','));
  }
  return lines.join('\n');
}

export function exportEpcFlowsCsv(dataset: EpcDataset): string {
  const lines = ['index,source,target,label'];
  for (const f of dataset.flows) {
    lines.push([f.index + 1, csv(f.sourceName), csv(f.targetName), csv(f.label)].join(','));
  }
  return lines.join('\n');
}

export function resolveEpcSuggestion(state: { hasFiles: boolean; hasError: boolean }): EpcSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the order fulfillment EPC sample',
      reason: 'Load a local EPML chain with events, XOR/AND connectors, and control flow.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open an EPC diagram',
      reason: 'Drop EPML, XML, JSON, or CSV — or load the sample order fulfillment chain.',
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
