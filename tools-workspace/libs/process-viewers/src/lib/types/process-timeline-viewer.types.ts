export type ProcessTimelineViewMode = 'gantt' | 'lanes' | 'events' | 'table';
export type ProcessTimelineExportFormat = 'original' | 'summary-json' | 'timeline-csv' | 'lanes-csv' | 'png';
export type ProcessTimelineSourceKind = 'xes' | 'json' | 'csv';

export interface ProcessTimelineRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ProcessTimelineItem {
  id: string;
  index: number;
  caseId: string;
  activity: string;
  resource: string;
  startTime: string;
  endTime: string;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface ProcessTimelineLane {
  id: string;
  index: number;
  name: string;
  kind: 'case' | 'resource';
  events: number;
  durationMs: number;
  items: ProcessTimelineItem[];
}

export interface ProcessTimelineDataset {
  name: string;
  sourceKind: ProcessTimelineSourceKind;
  startMs: number;
  endMs: number;
  items: ProcessTimelineItem[];
  caseLanes: ProcessTimelineLane[];
  resourceLanes: ProcessTimelineLane[];
  warnings: string[];
}

export interface ProcessTimelineLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ProcessTimelineDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface ProcessTimelineMetadataRow {
  key: string;
  value: string;
}

export interface ProcessTimelineSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
