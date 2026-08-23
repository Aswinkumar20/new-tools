export type SeqViewMode = 'lifelines' | 'messages' | 'diagram' | 'table';
export type SeqExportFormat = 'original' | 'summary-json' | 'lifelines-csv' | 'messages-csv' | 'png';
export type SeqSourceKind = 'puml' | 'mermaid' | 'markdown' | 'json' | 'txt' | 'xml';
export type SeqLifelineKind = 'actor' | 'participant' | 'boundary' | 'control' | 'entity';
export type SeqMessageStyle = 'sync' | 'async' | 'return' | 'create';

export interface SeqRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface SeqLifeline {
  id: string;
  index: number;
  name: string;
  kind: SeqLifelineKind;
  alias: string;
  x: number;
  y: number;
}

export interface SeqMessage {
  id: string;
  index: number;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  style: SeqMessageStyle;
}

export interface SeqDataset {
  name: string;
  sourceKind: SeqSourceKind;
  title: string;
  lifelines: SeqLifeline[];
  messages: SeqMessage[];
  warnings: string[];
}

export interface SeqLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: SeqDataset | null;
  warnings: string[];
  softFail: boolean;
}

export interface SeqMetadataRow {
  key: string;
  value: string;
}

export interface SeqSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}
