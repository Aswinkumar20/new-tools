export type StratigraphyViewMode = 'column' | 'chrono' | 'correlation' | 'table';
export type StratigraphyExportFormat = 'original' | 'summary-json' | 'units-csv' | 'chrono-csv' | 'png';

export interface StratigraphyRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface StratigraphySuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}

export interface StratigraphyMetadataRow {
  key: string;
  value: string;
}

export interface StratigraphyUnit {
  id: string;
  name: string;
  lithology: string;
  era: string;
  period: string;
  ageTop: number;
  ageBase: number;
  thickness: number;
  color: string;
  unconformity: boolean;
  description: string;
}

export interface StratigraphyMarker {
  id: string;
  name: string;
  age: number;
  kind: string;
}

export interface StratigraphyColumn {
  id: string;
  name: string;
  units: StratigraphyUnit[];
}

export interface ParsedStratigraphy {
  name: string;
  region: string;
  unit: string;
  timeUnit: string;
  sourceKind: 'json' | 'csv' | 'str';
  columns: StratigraphyColumn[];
  markers: StratigraphyMarker[];
  ageMin: number;
  ageMax: number;
  warnings: string[];
}

export interface StratigraphyLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  text: string;
  parsed: ParsedStratigraphy | null;
  warnings: string[];
  softFail: boolean;
}
