export type BpsimViewMode = 'tokens' | 'scenarios' | 'graph' | 'table';
export type BpsimExportFormat = 'original' | 'summary-json' | 'scenarios-csv' | 'trace-csv' | 'png';
export type BpsimSourceKind = 'bpmn' | 'pnml' | 'json' | 'csv';
export type BpsimEngine = 'bpmn' | 'petri';
export type BpsimNodeKind = 'start' | 'end' | 'task' | 'gateway' | 'place' | 'transition';
export type BpsimGatewayType = 'xor' | 'and' | 'or';

export interface BpsimRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface BpsimNode {
  id: string;
  index: number;
  name: string;
  kind: BpsimNodeKind;
  gatewayType: BpsimGatewayType | '';
  initialTokens: number;
  x: number;
  y: number;
  inCount: number;
  outCount: number;
}

export interface BpsimEdge {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  weight: number;
}

export interface BpsimScenario {
  id: string;
  index: number;
  name: string;
  description: string;
  marking: Record<string, number>;
  choices: Record<string, string>;
}

export interface BpsimStep {
  step: number;
  nodeId: string;
  nodeName: string;
  marking: string;
}

export interface BpsimDataset {
  name: string;
  sourceKind: BpsimSourceKind;
  engine: BpsimEngine;
  netType: string;
  nodes: BpsimNode[];
  edges: BpsimEdge[];
  scenarios: BpsimScenario[];
  warnings: string[];
}

export interface BpsimLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: BpsimDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface BpsimMetadataRow {
  key: string;
  value: string;
}

export interface BpsimSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
