export type DepViewMode = 'diagram' | 'tree' | 'cycles' | 'table';
export type DepExportFormat = 'original' | 'summary-json' | 'packages-csv' | 'edges-csv' | 'png';
export type DepSourceKind = 'lock' | 'package' | 'json' | 'xml' | 'markdown' | 'txt' | 'dot';
export type DepKind = 'root' | 'direct' | 'transitive';

export interface DepRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DepPackage {
  id: string;
  index: number;
  name: string;
  version: string;
  kind: DepKind;
  x: number;
  y: number;
}

export interface DepEdge {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  spec: string;
}

export interface DepCycle {
  id: string;
  index: number;
  nodes: string[];
  path: string;
}

export interface DepTreeRow {
  id: string;
  name: string;
  version: string;
  depth: number;
  cyclic: boolean;
}

export interface DepDataset {
  name: string;
  sourceKind: DepSourceKind;
  title: string;
  packages: DepPackage[];
  edges: DepEdge[];
  cycles: DepCycle[];
  tree: DepTreeRow[];
  warnings: string[];
}

export interface DepLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: DepDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface DepMetadataRow {
  key: string;
  value: string;
}

export interface DepSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
