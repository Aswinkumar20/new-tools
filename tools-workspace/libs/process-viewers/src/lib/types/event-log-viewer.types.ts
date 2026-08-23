export type EventLogViewMode = 'cases' | 'activities' | 'events' | 'table';
export type EventLogExportFormat = 'original' | 'summary-json' | 'cases-csv' | 'events-csv' | 'png';
export type EventLogSourceKind = 'xes' | 'json' | 'csv';

export interface EventLogRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface EventLogCase {
  id: string;
  index: number;
  caseId: string;
  events: number;
  activities: string[];
  pathLabel: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  resources: string[];
}

export interface EventLogActivity {
  id: string;
  index: number;
  name: string;
  frequency: number;
  pct: number;
  cases: number;
  resources: string[];
}

export interface EventLogEvent {
  id: string;
  index: number;
  caseId: string;
  activity: string;
  timestamp: string;
  timestampMs: number;
  resource: string;
  lifecycle: string;
}

export interface EventLogDataset {
  name: string;
  sourceKind: EventLogSourceKind;
  cases: EventLogCase[];
  activities: EventLogActivity[];
  events: EventLogEvent[];
  warnings: string[];
}

export interface EventLogLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: EventLogDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface EventLogMetadataRow {
  key: string;
  value: string;
}

export interface EventLogSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
