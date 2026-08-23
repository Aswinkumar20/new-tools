export interface CdaRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface CdaSection {
  id: string;
  title: string;
  code?: string;
  narrativeHtml: string;
  narrativeText: string;
  level: number;
}

export interface ParsedCdaDocument {
  title: string;
  effectiveTime?: string;
  patientName?: string;
  authorName?: string;
  documentId?: string;
  sections: CdaSection[];
  warnings: string[];
}

export interface CdaLoadedDocument {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  text: string;
  parsed: ParsedCdaDocument;
  warnings: string[];
}

export type CdaExportFormat = 'original' | 'summary-json' | 'sections-json' | 'narrative-txt';

export interface CdaSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

export type CdaViewMode = 'sections' | 'narrative' | 'raw';
