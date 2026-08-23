import {
  BPMN_MAX_FILE_BYTES,
  BPMN_SUPPORTED_EXTENSIONS
} from '../constants/bpmn-viewer.constants';
import type {
  BpmnDiagramStats,
  BpmnElementFilter,
  BpmnElementKind,
  BpmnElementSummary,
  BpmnLoadedFile,
  BpmnNavigatedViewerConstructor
} from '../types/bpmn-viewer.types';

const TASK_TYPES = new Set([
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:ServiceTask',
  'bpmn:ScriptTask',
  'bpmn:BusinessRuleTask',
  'bpmn:ManualTask',
  'bpmn:ReceiveTask',
  'bpmn:SendTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess'
]);

const EVENT_TYPES = new Set([
  'bpmn:StartEvent',
  'bpmn:EndEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:IntermediateCatchEvent',
  'bpmn:BoundaryEvent'
]);

const GATEWAY_TYPES = new Set([
  'bpmn:ExclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:InclusiveGateway',
  'bpmn:EventBasedGateway',
  'bpmn:ComplexGateway'
]);

export function getBpmnFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? '';
}

export function isSupportedBpmnFile(file: File): boolean {
  const ext = getBpmnFileExtension(file.name);
  return BPMN_SUPPORTED_EXTENSIONS.includes(ext);
}

export function validateBpmnFileSize(file: File): string | null {
  if (file.size > BPMN_MAX_FILE_BYTES) {
    return `File is too large (max ${formatBpmnFileSize(BPMN_MAX_FILE_BYTES)})`;
  }
  return null;
}

export function filterValidBpmnFiles(files: FileList | File[]): {
  accepted: File[];
  rejected: Array<{ name: string; reason: string }>;
} {
  const list = Array.from(files);
  const accepted: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const file of list) {
    if (!isSupportedBpmnFile(file)) {
      rejected.push({ name: file.name, reason: 'Unsupported format (use .bpmn or .xml)' });
      continue;
    }
    const sizeError = validateBpmnFileSize(file);
    if (sizeError) {
      rejected.push({ name: file.name, reason: sizeError });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function formatBpmnFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readBpmnFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function createBpmnFileRecord(file: File, xml: string): BpmnLoadedFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    xml
  };
}

const XML_PREAMBLE_BLOCKS: ReadonlyArray<{ open: RegExp; close: string }> = [
  { open: /^<\?/, close: '?>' },
  { open: /^<!--/, close: '-->' },
  { open: /^<!DOCTYPE/i, close: '>' }
];

/** Drops BOM, prolog, comments and doctype so the root element can be inspected. */
export function stripXmlPreamble(xml: string): string {
  let rest = xml.replace(/^\uFEFF/, '').trimStart();
  for (let guard = 0; guard < 50; guard += 1) {
    const block = XML_PREAMBLE_BLOCKS.find((item) => item.open.test(rest));
    const end = block ? rest.indexOf(block.close) : -1;
    if (!block || end < 0) {
      break;
    }
    rest = rest.slice(end + block.close.length).trimStart();
  }
  return rest;
}

export function getXmlRootTagName(xml: string): string {
  const match = /^<([\w.-]+(?::[\w.-]+)?)/.exec(stripXmlPreamble(xml));
  return match?.[1] ?? '';
}

export function looksLikeBpmnXml(xml: string): boolean {
  const root = getXmlRootTagName(xml);
  if (!root) {
    return false;
  }
  // Any namespace prefix is valid: bpmn:, bpmn2:, semantic:, model: or none at all.
  if (/^(?:[\w.-]+:)?definitions$/i.test(root)) {
    return true;
  }
  const head = xml.slice(0, 65536);
  return /BPMN\/20100524\/(?:MODEL|DI)|BPMNDiagram|BPMNPlane/i.test(head);
}

export function parseBpmnElements(xml: string): BpmnElementSummary[] {
  if (globalThis.window === undefined || typeof DOMParser === 'undefined') {
    return [];
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return [];
  }

  const elements: BpmnElementSummary[] = [];
  const nodes = doc.getElementsByTagName('*');
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index);
    if (!node || node.nodeType !== 1) {
      continue;
    }
    const local = localName(node);
    if (!isDiagramElement(local)) {
      continue;
    }
    const id = node.getAttribute('id');
    if (!id) {
      continue;
    }
    const name = node.getAttribute('name')?.trim() || id;
    const typeLocal = localName(node);
    const typeName = typeLocal.charAt(0).toUpperCase() + typeLocal.slice(1);
    const type = `bpmn:${typeName}`;
    elements.push({
      id,
      name,
      type,
      typeLabel: humanizeType(typeLocal),
      kind: classifyElementKind(type)
    });
  }
  return elements;
}

export function filterBpmnElements(
  elements: ReadonlyArray<BpmnElementSummary>,
  kind: BpmnElementFilter,
  query: string
): BpmnElementSummary[] {
  const normalized = query.trim().toLowerCase();
  return elements.filter((item) => {
    if (kind !== 'all' && item.kind !== kind) {
      return false;
    }
    if (!normalized) {
      return true;
    }
    return (
      item.name.toLowerCase().includes(normalized) ||
      item.id.toLowerCase().includes(normalized) ||
      item.typeLabel.toLowerCase().includes(normalized)
    );
  });
}

export function countBpmnElementsByKind(
  elements: ReadonlyArray<BpmnElementSummary>
): Record<BpmnElementKind | 'all', number> {
  const counts: Record<BpmnElementKind | 'all', number> = {
    all: elements.length,
    task: 0,
    event: 0,
    gateway: 0,
    flow: 0,
    other: 0
  };
  for (const item of elements) {
    counts[item.kind] += 1;
  }
  return counts;
}

function classifyElementKind(type: string): BpmnElementKind {
  if (TASK_TYPES.has(type)) {
    return 'task';
  }
  if (EVENT_TYPES.has(type)) {
    return 'event';
  }
  if (GATEWAY_TYPES.has(type)) {
    return 'gateway';
  }
  if (type === 'bpmn:SequenceFlow' || type === 'bpmn:MessageFlow') {
    return 'flow';
  }
  return 'other';
}

export function buildBpmnStats(
  xml: string,
  elements: ReadonlyArray<BpmnElementSummary>,
  warnings = 0
): BpmnDiagramStats {
  let processName = 'Untitled process';
  if (globalThis.window !== undefined && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const process =
      doc.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'process').item(0) ??
      doc.getElementsByTagName('process').item(0) ??
      doc.getElementsByTagName('bpmn:process').item(0);
    const named = process?.getAttribute('name')?.trim();
    if (named) {
      processName = named;
    } else if (process?.getAttribute('id')) {
      processName = process.getAttribute('id') ?? processName;
    }
  }

  let tasks = 0;
  let events = 0;
  let gateways = 0;
  let flows = 0;
  let participants = 0;
  let lanes = 0;
  for (const element of elements) {
    if (TASK_TYPES.has(element.type)) {
      tasks += 1;
    } else if (EVENT_TYPES.has(element.type)) {
      events += 1;
    } else if (GATEWAY_TYPES.has(element.type)) {
      gateways += 1;
    } else if (element.type === 'bpmn:SequenceFlow' || element.type === 'bpmn:MessageFlow') {
      flows += 1;
    } else if (element.type === 'bpmn:Participant') {
      participants += 1;
    } else if (element.type === 'bpmn:Lane') {
      lanes += 1;
    }
  }

  return {
    processName,
    elements: elements.length,
    tasks,
    events,
    gateways,
    flows,
    participants,
    lanes,
    warnings
  };
}

export function exportBpmnElementsCsv(elements: ReadonlyArray<BpmnElementSummary>): string {
  const lines = ['id,name,type,type_label,kind'];
  for (const element of elements) {
    lines.push(
      [element.id, element.name, element.type, element.typeLabel, element.kind]
        .map((cell) => escapeCsv(cell))
        .join(',')
    );
  }
  return lines.join('\n');
}

export function exportBpmnSummaryJson(
  file: BpmnLoadedFile,
  stats: BpmnDiagramStats,
  elements: ReadonlyArray<BpmnElementSummary>
): string {
  return JSON.stringify(
    {
      fileName: file.name,
      size: file.size,
      generatedAt: new Date().toISOString(),
      stats,
      elements
    },
    null,
    2
  );
}

export function downloadTextFile(content: string, fileName: string, mime: string): void {
  if (globalThis.window === undefined) {
    return;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function resolveBpmnSuggestion(state: {
  hasFiles: boolean;
  hasError: boolean;
  elementCount: number;
}): { id: string; title: string; reason: string; actionLabel: string; path: string } | null {
  if (state.hasError) {
    return {
      id: 'bpmn-fix',
      title: 'Need a valid BPMN file?',
      reason: 'Upload a .bpmn diagram exported from Camunda, bpmn.io, or similar tools.',
      actionLabel: 'Open sample tip',
      path: '/process-viewers/bpmn-viewer'
    };
  }
  if (!state.hasFiles) {
    return {
      id: 'bpmn-intro',
      title: 'Start with a BPMN diagram',
      reason: 'Drop a .bpmn file or load the sample order process to explore pan, zoom, and element details.',
      actionLabel: 'Related: XES logs',
      path: '/file-viewers/xes-viewer'
    };
  }
  if (state.elementCount > 80) {
    return {
      id: 'bpmn-large',
      title: 'Large diagram tip',
      reason: 'Use Fit view and the element list to jump between tasks and gateways quickly.',
      actionLabel: 'Process mining (XES)',
      path: '/file-viewers/xes-viewer'
    };
  }
  return null;
}

let navigatedViewerCtor: BpmnNavigatedViewerConstructor | null = null;

/** Dynamic import keeps bpmn-js out of SSR bundles. */
export async function loadBpmnNavigatedViewer(): Promise<BpmnNavigatedViewerConstructor> {
  if (navigatedViewerCtor) {
    return navigatedViewerCtor;
  }
  const mod = await import('bpmn-js/lib/NavigatedViewer');
  navigatedViewerCtor = (mod.default ?? mod) as BpmnNavigatedViewerConstructor;
  return navigatedViewerCtor;
}

export function ensureBpmnStylesheets(hrefs: ReadonlyArray<string>): void {
  if (globalThis.document === undefined) {
    return;
  }
  for (const href of hrefs) {
    if (document.querySelector(`link[data-bpmn-style="${href}"]`)) {
      continue;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset['bpmnStyle'] = href;
    document.head.appendChild(link);
  }
}

function localName(node: Element): string {
  return node.localName || node.nodeName.replace(/^.*:/, '');
}

function isDiagramElement(local: string): boolean {
  const name = local.charAt(0).toUpperCase() + local.slice(1);
  return (
    /Task$|Event$|Gateway$|SubProcess$|CallActivity$|Participant$|Lane$|SequenceFlow$|MessageFlow$|DataObjectReference$|DataStoreReference$|TextAnnotation$/.test(
      name
    ) || name === 'Task'
  );
}

function humanizeType(local: string): string {
  const name = local.charAt(0).toUpperCase() + local.slice(1);
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
