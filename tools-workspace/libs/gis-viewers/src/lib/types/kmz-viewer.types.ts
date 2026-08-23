import type {
  KmlBounds,
  KmlDiagramStats,
  KmlFeature,
  KmlFeatureCollection,
  KmlFeatureFilter,
  KmlFeatureKind,
  KmlFeatureSummary,
  KmlGeometry
} from './kml-viewer.types';

export type KmzFeatureKind = KmlFeatureKind;

export type KmzFeatureFilter = KmlFeatureFilter;

export type KmzExportFormat = 'kmz' | 'kml' | 'geojson' | 'features-csv' | 'summary-json';

export type KmzGeometry = KmlGeometry;

export type KmzFeature = KmlFeature;

export type KmzFeatureCollection = KmlFeatureCollection;

export type KmzFeatureSummary = KmlFeatureSummary;

export type KmzBounds = KmlBounds;

export type KmzDiagramStats = KmlDiagramStats;

export interface KmzLoadedFile {
  id: string;
  name: string;
  size: number;
  bytes: ArrayBuffer;
  kmlText: string;
  primaryKmlPath: string;
  packageEntries: string[];
  data: KmzFeatureCollection;
  documentTitle: string;
  warnings: string[];
}

export interface KmzRelatedToolLink {
  label: string;
  description: string;
  path: string;
}
