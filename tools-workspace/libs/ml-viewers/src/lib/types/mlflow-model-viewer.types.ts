export type MfViewMode = 'signature' | 'files' | 'preview' | 'table';
export type MfExportFormat = 'original' | 'summary-json' | 'schema-csv' | 'rows-csv' | 'png';
export type MfSourceKind = 'mlmodel' | 'zip' | 'json' | 'csv' | 'markdown' | 'txt';
export type MfSigKind = 'input' | 'output' | 'param';
export type MfFileRole = 'manifest' | 'model' | 'env' | 'signature' | 'other';

export interface MfRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface MfSignature {
  id: string;
  index: number;
  name: string;
  kind: MfSigKind;
  type: string;
  dtype: string;
  shape: number[];
  shapeLabel: string;
}

export interface MfArtifact {
  id: string;
  index: number;
  name: string;
  path: string;
  role: MfFileRole;
  flavor: string;
  sizeLabel: string;
}

export interface MfColumn {
  id: string;
  index: number;
  name: string;
  type: string;
}

export interface MfDataset {
  name: string;
  sourceKind: MfSourceKind;
  title: string;
  encoding: string;
  mlflowVersion: string;
  flavor: string;
  utcCreated: string;
  artifactPath: string;
  signatureCount: number;
  fileCount: number;
  signatures: MfSignature[];
  files: MfArtifact[];
  columns: MfColumn[];
  rows: Array<Record<string, string>>;
  warnings: string[];
}

export interface MfLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: MfDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface MfMetadataRow {
  key: string;
  value: string;
}

export interface MfSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
