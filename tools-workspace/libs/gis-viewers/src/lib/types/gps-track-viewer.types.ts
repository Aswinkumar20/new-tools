import type { GpxBounds, GpxPoint, GpxUnitSystem } from './gpx-viewer.types';

export type GpsTrackExportFormat = 'original' | 'points-csv' | 'summary-json' | 'speed-csv';

export type GpsTrackSourceKind = 'gpx' | 'csv' | 'geojson';

export type GpsTrackChartAxis = 'distance' | 'time';

export interface GpsTrackPoint extends GpxPoint {
  /** Cumulative distance along the track in meters. */
  distanceMeters?: number;
  /** Instantaneous segment speed into this point (m/s), if timestamps exist. */
  speedMps?: number | null;
}

export interface GpsTrackInfo {
  id: string;
  name: string;
  points: GpsTrackPoint[];
}

export interface GpsSpeedSegment {
  from: GpsTrackPoint;
  to: GpsTrackPoint;
  distanceMeters: number;
  durationSeconds: number | null;
  speedMps: number | null;
  color: string;
}

export interface GpsTrackStats {
  title: string;
  sourceKind: GpsTrackSourceKind;
  trackCount: number;
  pointCount: number;
  distanceMeters: number;
  durationSeconds: number | null;
  movingTimeSeconds: number | null;
  stoppedTimeSeconds: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  avgMovingSpeedMps: number | null;
  avgPaceMps: number | null;
  elevationGainMeters: number;
  elevationLossMeters: number;
  minElevationMeters: number | null;
  maxElevationMeters: number | null;
  bounds: GpxBounds | null;
  hasElevation: boolean;
  hasTimestamps: boolean;
}

export interface GpsTrackLoadedFile {
  id: string;
  name: string;
  size: number;
  sourceKind: GpsTrackSourceKind;
  text: string;
  tracks: GpsTrackInfo[];
  warnings: string[];
}

export interface GpsTrackRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface GpsProfileSample {
  distanceMeters: number;
  elapsedSeconds: number | null;
  speedMps: number | null;
  paceSecondsPerKm: number | null;
  elevationMeters: number | null;
  index: number;
}

export interface GpsProfileGeometry {
  linePoints: string;
  areaPoints: string;
}

export type { GpxBounds, GpxPoint, GpxUnitSystem };
