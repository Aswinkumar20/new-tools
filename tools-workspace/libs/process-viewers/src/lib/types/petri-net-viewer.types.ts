export type PetriNetViewMode = 'graph' | 'flow' | 'tokens' | 'table';
export type PetriNetExportFormat = 'original' | 'summary-json' | 'marking-csv' | 'trace-csv' | 'png';
export type PetriNetSourceKind = 'pnml' | 'json' | 'csv';

export interface PetriNetRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PetriNetPlace {
  id: string;
  index: number;
  name: string;
  initialTokens: number;
  x: number;
  y: number;
  inCount: number;
  outCount: number;
}

export interface PetriNetTransition {
  id: string;
  index: number;
  name: string;
  x: number;
  y: number;
  inCount: number;
  outCount: number;
}

export interface PetriNetArc {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  weight: number;
}

export interface PetriNetStep {
  step: number;
  transitionId: string;
  transitionName: string;
  marking: string;
}

export interface PetriNetDataset {
  name: string;
  sourceKind: PetriNetSourceKind;
  netType: string;
  places: PetriNetPlace[];
  transitions: PetriNetTransition[];
  arcs: PetriNetArc[];
  warnings: string[];
}

export interface PetriNetLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: PetriNetDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface PetriNetMetadataRow {
  key: string;
  value: string;
}

export interface PetriNetSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
