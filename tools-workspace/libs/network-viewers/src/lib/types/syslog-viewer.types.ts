export type SyslogViewMode = 'messages' | 'facilities' | 'severity' | 'table';
export type SyslogExportFormat = 'original' | 'summary-json' | 'messages-csv' | 'facilities-csv' | 'png';
export type SyslogSourceKind = 'log' | 'rfc5424' | 'csv' | 'json';

export interface SyslogRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SyslogMessage {
  id: string;
  index: number;
  time: string;
  relMs: number;
  pri: number | null;
  facility: string;
  severity: string;
  host: string;
  app: string;
  pid: string;
  message: string;
}

export interface SyslogStat {
  name: string;
  count: number;
}

export interface SyslogDataset {
  name: string;
  sourceKind: SyslogSourceKind;
  messages: SyslogMessage[];
  facilities: SyslogStat[];
  severities: SyslogStat[];
  durationMs: number;
  warnings: string[];
}

export interface SyslogLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SyslogDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SyslogMetadataRow {
  key: string;
  value: string;
}

export interface SyslogSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
