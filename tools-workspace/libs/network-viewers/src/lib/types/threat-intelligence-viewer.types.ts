export type ThreatViewMode = 'indicators' | 'relationships' | 'objects' | 'table';
export type ThreatExportFormat = 'original' | 'summary-json' | 'indicators-csv' | 'relationships-csv' | 'png';
export type ThreatSourceKind = 'stix' | 'json' | 'csv' | 'txt' | 'xml';

export interface ThreatRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ThreatIndicator {
  id: string;
  index: number;
  type: string;
  value: string;
  name: string;
  labels: string;
  pattern: string;
  confidence: number | null;
  validFrom: string;
}

export interface ThreatRelationship {
  id: string;
  index: number;
  type: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
}

export interface ThreatObject {
  id: string;
  index: number;
  kind: string;
  name: string;
  aliases: string;
  description: string;
}

export interface ThreatStat {
  name: string;
  count: number;
}

export interface ThreatDataset {
  name: string;
  sourceKind: ThreatSourceKind;
  version: string;
  indicators: ThreatIndicator[];
  relationships: ThreatRelationship[];
  objects: ThreatObject[];
  indicatorTypes: ThreatStat[];
  relationshipTypes: ThreatStat[];
  objectKinds: ThreatStat[];
  warnings: string[];
}

export interface ThreatLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ThreatDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface ThreatMetadataRow {
  key: string;
  value: string;
}

export interface ThreatSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
