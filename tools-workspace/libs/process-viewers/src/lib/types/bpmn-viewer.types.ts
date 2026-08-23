export interface BpmnLoadedFile {
  id: string;
  name: string;
  size: number;
  xml: string;
}

export interface BpmnElementSummary {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  kind: BpmnElementKind;
}

export type BpmnElementKind = 'task' | 'event' | 'gateway' | 'flow' | 'other';

export type BpmnElementFilter = 'all' | BpmnElementKind;

export interface BpmnDiagramStats {
  processName: string;
  elements: number;
  tasks: number;
  events: number;
  gateways: number;
  flows: number;
  participants: number;
  lanes: number;
  warnings: number;
}

export interface BpmnRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export type BpmnExportFormat = 'original-bpmn' | 'svg' | 'elements-csv' | 'summary-json';

export interface BpmnViewerApi {
  importXML: (xml: string) => Promise<{ warnings: Array<{ message?: string }> }>;
  saveSVG: () => Promise<{ svg: string }>;
  destroy: () => void;
  get: (name: string) => unknown;
  on: (event: string, callback: (event: { element?: { id?: string; type?: string; businessObject?: { name?: string; id?: string } } }) => void) => void;
  off?: (event: string, callback: (...args: unknown[]) => void) => void;
}

export type BpmnNavigatedViewerConstructor = new (options: {
  container: HTMLElement;
}) => BpmnViewerApi;
