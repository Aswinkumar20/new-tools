export type BoreholeViewMode = 'plan' | 'section' | '3d' | 'lithology' | 'table';
export type BoreholeExportFormat = 'original' | 'summary-json' | 'survey-csv' | 'lithology-csv' | 'png';

export interface BoreholeRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface BoreholeSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  action: 'sample' | 'upload';
}

export interface BoreholeMetadataRow {
  key: string;
  value: string;
}

export interface BoreholeSurveyRow {
  index: number;
  md: number;
  inc: number;
  azi: number;
  tvd: number;
  north: number;
  east: number;
  vs: number;
  dls: number;
}

export interface BoreholeLithInterval {
  id: string;
  name: string;
  lithology: string;
  topMd: number;
  baseMd: number;
  color: string;
  description: string;
}

export interface BoreholeMarker {
  id: string;
  name: string;
  md: number;
}

export interface ParsedBorehole {
  name: string;
  well: string;
  kb: number;
  unit: string;
  sourceKind: 'json' | 'csv' | 'bhl' | 'dev';
  survey: BoreholeSurveyRow[];
  lithology: BoreholeLithInterval[];
  markers: BoreholeMarker[];
  td: number;
  tvd: number;
  displacement: number;
  maxDls: number;
  warnings: string[];
}

export interface BoreholeLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  text: string;
  parsed: ParsedBorehole | null;
  warnings: string[];
  softFail: boolean;
}
