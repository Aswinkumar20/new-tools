export type BpelViewMode = 'orchestration' | 'partners' | 'activities' | 'table';
export type BpelExportFormat = 'original' | 'summary-json' | 'activities-csv' | 'partners-csv' | 'png';
export type BpelSourceKind = 'bpel' | 'json' | 'csv';

export interface BpelRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface BpelPartner {
  id: string;
  index: number;
  name: string;
  type: string;
  myRole: string;
  partnerRole: string;
  activityCount: number;
}

export interface BpelVariable {
  id: string;
  name: string;
  type: string;
}

export interface BpelActivity {
  id: string;
  index: number;
  name: string;
  kind: string;
  partner: string;
  operation: string;
  variable: string;
  createInstance: boolean;
  parentId: string;
  parentName: string;
  depth: number;
}

export interface BpelStat {
  name: string;
  count: number;
}

export interface BpelDataset {
  name: string;
  sourceKind: BpelSourceKind;
  namespace: string;
  partners: BpelPartner[];
  variables: BpelVariable[];
  activities: BpelActivity[];
  kinds: BpelStat[];
  warnings: string[];
}

export interface BpelLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: BpelDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface BpelMetadataRow {
  key: string;
  value: string;
}

export interface BpelSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
