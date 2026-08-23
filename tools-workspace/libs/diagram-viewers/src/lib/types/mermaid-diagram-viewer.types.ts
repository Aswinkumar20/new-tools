export type MmdViewMode = 'diagram' | 'nodes' | 'edges' | 'table';
export type MmdExportFormat = 'original' | 'summary-json' | 'nodes-csv' | 'edges-csv' | 'png';
export type MmdSourceKind = 'mmd' | 'markdown' | 'json' | 'txt';
export type MmdKind = 'flowchart' | 'sequence';
export type MmdDirection = 'TD' | 'LR' | 'BT' | 'RL';
export type MmdShape = 'rect' | 'round' | 'diamond' | 'stadium' | 'circle' | 'participant';
export type MmdEdgeStyle = 'solid' | 'dotted' | 'thick' | 'message' | 'return';

export interface MmdRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface MmdNode {
  id: string;
  index: number;
  name: string;
  shape: MmdShape;
  group: string;
  x: number;
  y: number;
}

export interface MmdEdge {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  style: MmdEdgeStyle;
}

export interface MmdDataset {
  name: string;
  sourceKind: MmdSourceKind;
  kind: MmdKind;
  direction: MmdDirection;
  nodes: MmdNode[];
  edges: MmdEdge[];
  warnings: string[];
}

export interface MmdLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: MmdDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface MmdMetadataRow {
  key: string;
  value: string;
}

export interface MmdSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
