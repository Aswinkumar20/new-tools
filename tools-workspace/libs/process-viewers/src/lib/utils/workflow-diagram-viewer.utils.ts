import { WORKFLOW_XML_SAMPLE } from '../constants/workflow-sample.data';
import { WORKFLOW_MAX_FILE_BYTES, WORKFLOW_SUPPORTED_EXTENSIONS } from '../constants/workflow-diagram-viewer.constants';
import type {
  WorkflowDataset,
  WorkflowEdge,
  WorkflowLoadedFile,
  WorkflowMetadataRow,
  WorkflowNode,
  WorkflowSuggestion
} from '../types/workflow-diagram-viewer.types';
import { parseWorkflowBytes } from './workflow-parse.utils';
import { bytesToText, formatProcessFileSize, getProcessFileExtension } from './process-file.utils';

export {
  canvasToPngDataUrl,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  formatProcessFileSize as formatWorkflowFileSize,
  readFileBytes as readWorkflowFileBytes
} from './process-file.utils';

export { filterWorkflowEdges, filterWorkflowNodes, parseWorkflowBytes, parseWorkflowText } from './workflow-parse.utils';
export { renderWorkflowDiagram, renderWorkflowEdges, renderWorkflowKinds, workflowKindColor } from './workflow-render.utils';

export function isSupportedWorkflowFile(file: File): boolean {
  if (/\.gz$/i.test(file.name)) return false;
  return (WORKFLOW_SUPPORTED_EXTENSIONS as readonly string[]).includes(getProcessFileExtension(file.name));
}

export function validateWorkflowFileSize(file: File): string | null {
  if (!file || file.size <= 0) return 'File is empty';
  if (file.size > WORKFLOW_MAX_FILE_BYTES) return `File is too large (max ${formatProcessFileSize(WORKFLOW_MAX_FILE_BYTES)})`;
  return null;
}

export function filterValidWorkflowFiles(files: FileList | File[]): {
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
      rejected.push({ name: file.name, reason: 'Compressed workflow files are not supported — decompress first' });
      continue;
    }
    if (!isSupportedWorkflowFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .xml, .wf, .json, or .csv)' });
      continue;
    }
    const sizeError = validateWorkflowFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function createSampleWorkflowFile(): File {
  return new File([WORKFLOW_XML_SAMPLE], 'sample-support-ticket.xml', { type: 'application/xml', lastModified: 0 });
}

export function createWorkflowFileRecord(file: File, bytes: Uint8Array): WorkflowLoadedFile {
  const extension = getProcessFileExtension(file.name);
  const id = `${file.name}|${file.size}|${file.lastModified}`;
  const text = bytesToText(bytes);
  const warnings: string[] = [];
  let parsed: WorkflowDataset | null = null;
  let softFail = false;
  try {
    parsed = parseWorkflowBytes(bytes, file.name);
    warnings.push(...parsed.warnings);
    if (!parsed.nodes.length) softFail = true;
  } catch (error) {
    softFail = true;
    warnings.push(error instanceof Error ? error.message : 'Failed to parse workflow diagram');
  }
  return { id, name: file.name, size: file.size, extension, bytes, text, parsed, warnings, softFail };
}

export function canExportWorkflow(file: WorkflowLoadedFile | null): boolean {
  return !!file?.parsed && !file.softFail;
}

export function buildWorkflowMetadataRows(dataset: WorkflowDataset): WorkflowMetadataRow[] {
  return [
    { key: 'Name', value: dataset.name },
    { key: 'Source', value: dataset.sourceKind },
    { key: 'Nodes', value: String(dataset.nodes.length) },
    { key: 'Edges', value: String(dataset.edges.length) },
    { key: 'Kinds', value: dataset.kinds.map((k) => `${k.name} ${k.count}`).join(', ') || '—' }
  ];
}

export function buildWorkflowNodeMetadata(node: WorkflowNode): WorkflowMetadataRow[] {
  return [
    { key: 'ID', value: node.id },
    { key: 'Name', value: node.name },
    { key: 'Kind', value: node.kind },
    { key: 'Incoming', value: String(node.inCount) },
    { key: 'Outgoing', value: String(node.outCount) }
  ];
}

export function buildWorkflowEdgeMetadata(edge: WorkflowEdge): WorkflowMetadataRow[] {
  return [
    { key: 'From', value: edge.sourceName || edge.source },
    { key: 'To', value: edge.targetName || edge.target },
    { key: 'Label', value: edge.label || '—' }
  ];
}

export function exportWorkflowSummaryJson(file: WorkflowLoadedFile): string {
  const parsed = file.parsed;
  if (!parsed) throw new Error('No parsed workflow diagram');
  return JSON.stringify(
    {
      file: file.name,
      name: parsed.name,
      sourceKind: parsed.sourceKind,
      kinds: parsed.kinds,
      nodes: parsed.nodes.map((n) => ({ id: n.id, name: n.name, kind: n.kind, in: n.inCount, out: n.outCount })),
      edges: parsed.edges.map((e) => ({ source: e.sourceName, target: e.targetName, label: e.label }))
    },
    null,
    2
  );
}

export function exportWorkflowNodesCsv(dataset: WorkflowDataset): string {
  const lines = ['index,kind,id,name,incoming,outgoing'];
  for (const n of dataset.nodes) {
    lines.push([n.index + 1, n.kind, csv(n.id), csv(n.name), n.inCount, n.outCount].join(','));
  }
  return lines.join('\n');
}

export function exportWorkflowEdgesCsv(dataset: WorkflowDataset): string {
  const lines = ['index,source,target,label'];
  for (const e of dataset.edges) {
    lines.push([e.index + 1, csv(e.sourceName), csv(e.targetName), csv(e.label)].join(','));
  }
  return lines.join('\n');
}

export function resolveWorkflowSuggestion(state: { hasFiles: boolean; hasError: boolean }): WorkflowSuggestion | null {
  if (state.hasError) {
    return {
      id: 'sample-after-error',
      title: 'Try the support ticket workflow sample',
      reason: 'Load a local workflow with start, tasks, a decision, and join.',
      actionLabel: 'Load sample',
      action: 'sample'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'upload-or-sample',
      title: 'Open a workflow diagram',
      reason: 'Drop XML, .wf, JSON, or CSV — or load the sample support ticket flow.',
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
