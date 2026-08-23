export type MbtilesExportFormat = 'mbtiles' | 'metadata-json' | 'summary-json';

export interface MbtilesBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MbtilesCenter {
  lon: number;
  lat: number;
  zoom: number | null;
}

export interface MbtilesMetadata {
  name: string | null;
  format: string | null;
  bounds: MbtilesBounds | null;
  center: MbtilesCenter | null;
  minzoom: number | null;
  maxzoom: number | null;
  description: string | null;
  type: string | null;
  version: string | null;
  attribution: string | null;
  /** All name/value pairs from the metadata table (including unknowns). */
  raw: Record<string, string>;
}

export interface MbtilesDiagramStats {
  title: string;
  tileCount: number;
  minZoom: number | null;
  maxZoom: number | null;
  format: string | null;
  type: string | null;
  version: string | null;
  bounds: MbtilesBounds | null;
  center: MbtilesCenter | null;
  attribution: string | null;
  description: string | null;
  isVectorFormat: boolean;
}

export interface MbtilesLoadedFile {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  metadata: MbtilesMetadata;
  stats: MbtilesDiagramStats;
  warnings: string[];
}

export interface MbtilesRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface MbtilesMetadataRow {
  key: string;
  value: string;
}
