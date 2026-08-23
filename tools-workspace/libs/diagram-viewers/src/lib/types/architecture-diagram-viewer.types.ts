export type ArchViewMode = 'boxes' | 'connectors' | 'diagram' | 'table';
export type ArchExportFormat = 'original' | 'summary-json' | 'boxes-csv' | 'connectors-csv' | 'png';
export type ArchSourceKind = 'puml' | 'mermaid' | 'markdown' | 'json' | 'txt' | 'xml';
export type ArchBoxKind = 'app' | 'service' | 'database' | 'cloud' | 'queue' | 'package' | 'node' | 'other';
export type ArchConnectorStyle = 'call' | 'data' | 'depend' | 'sync';

export interface ArchRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ArchBox {
  id: string;
  index: number;
  name: string;
  kind: ArchBoxKind;
  stereotype: string;
  x: number;
  y: number;
}

export interface ArchConnector {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  style: ArchConnectorStyle;
}

export interface ArchDataset {
  name: string;
  sourceKind: ArchSourceKind;
  title: string;
  boxes: ArchBox[];
  connectors: ArchConnector[];
  warnings: string[];
}

export interface ArchLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ArchDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface ArchMetadataRow {
  key: string;
  value: string;
}

export interface ArchSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
