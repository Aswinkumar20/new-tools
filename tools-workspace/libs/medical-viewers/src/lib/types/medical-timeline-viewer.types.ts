export interface TimelineRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface ClinicalTimelineEvent {
  id: string;
  date: string;
  isoDate: string;
  title: string;
  category: string;
  description?: string;
  source?: string;
  patientLabel?: string;
}

export interface ParsedTimelineDocument {
  events: ClinicalTimelineEvent[];
  patientLabel?: string;
  warnings: string[];
}

export interface TimelineLoadedDocument {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  format: 'json' | 'csv' | 'fhir' | 'hl7';
  parsed: ParsedTimelineDocument;
  warnings: string[];
}

export type TimelineExportFormat = 'original' | 'summary-json' | 'events-json' | 'events-csv';

export interface TimelineSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

export type TimelineGroupMode = 'none' | 'month' | 'category';
