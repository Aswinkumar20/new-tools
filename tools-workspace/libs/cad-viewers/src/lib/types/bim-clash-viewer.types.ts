export type BcViewMode = 'clashes' | 'focus' | 'tests' | 'table';
export type BcExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type BcSourceKind = 'clash' | 'json' | 'csv' | 'markdown' | 'txt' | 'xml';
export type BcSolidKind = 'box' | 'cylinder' | 'sphere' | 'plane' | 'other';
export type BcClashType = 'hard' | 'clearance' | 'duplicate' | 'other';
export type BcClashStatus = 'active' | 'reviewed' | 'resolved' | 'other';

export interface BcRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface BcItem {
  id: string;
  index: number;
  name: string;
  kind: BcSolidKind;
  test: string;
  colorHex: string;
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  r: number;
  h: number;
  volume: number;
}

export interface BcClash {
  id: string;
  index: number;
  name: string;
  clashType: BcClashType;
  status: BcClashStatus;
  test: string;
  itemA: string;
  itemB: string;
  distance: number;
  cx: number;
  cy: number;
  cz: number;
}

export interface BcTest {
  id: string;
  index: number;
  name: string;
  description: string;
  clashCount: number;
}

export interface BcColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface BcDataset {
  name: string;
  sourceKind: BcSourceKind;
  title: string;
  encoding: string;
  reportVer: string;
  units: string;
  itemCount: number;
  clashCount: number;
  testCount: number;
  items: BcItem[];
  clashes: BcClash[];
  tests: BcTest[];
  columns: BcColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface BcLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: BcDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface BcMetadataRow {
  key: string;
  value: string;
}

export interface BcSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
