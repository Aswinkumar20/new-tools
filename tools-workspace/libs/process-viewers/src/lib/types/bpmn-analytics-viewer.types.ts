export type BpmnAnalyticsViewMode = 'bottlenecks' | 'overlays' | 'activities' | 'table';
export type BpmnAnalyticsExportFormat = 'original' | 'summary-json' | 'activities-csv' | 'bottlenecks-csv' | 'png';
export type BpmnAnalyticsSourceKind = 'json' | 'bpmn' | 'csv';

export interface BpmnAnalyticsRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface BpmnAnalyticsActivity {
  id: string;
  index: number;
  name: string;
  kind: string;
  frequency: number;
  avgDurationMs: number;
  waitMs: number;
  failures: number;
  bottleneckScore: number;
  severity: string;
}

export interface BpmnAnalyticsFlow {
  id: string;
  name: string;
  source: string;
  target: string;
  frequency: number;
}

export interface BpmnAnalyticsStat {
  name: string;
  count: number;
}

export interface BpmnAnalyticsDataset {
  name: string;
  processName: string;
  sourceKind: BpmnAnalyticsSourceKind;
  cases: number;
  activities: BpmnAnalyticsActivity[];
  flows: BpmnAnalyticsFlow[];
  severities: BpmnAnalyticsStat[];
  warnings: string[];
}

export interface BpmnAnalyticsLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: BpmnAnalyticsDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface BpmnAnalyticsMetadataRow {
  key: string;
  value: string;
}

export interface BpmnAnalyticsSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
