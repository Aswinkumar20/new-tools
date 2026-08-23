export type GpxItemKind = 'track' | 'route' | 'waypoint';

export type GpxItemFilter = 'all' | GpxItemKind;

export type GpxExportFormat = 'gpx' | 'points-csv' | 'summary-json';

export type GpxUnitSystem = 'metric' | 'imperial';

export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number | null;
  time: string | null;
  name: string | null;
}

export interface GpxWaypoint extends GpxPoint {
  id: string;
  description: string | null;
}

export interface GpxTrackSegment {
  points: GpxPoint[];
}

export interface GpxTrack {
  id: string;
  name: string;
  description: string | null;
  segments: GpxTrackSegment[];
}

export interface GpxRoute {
  id: string;
  name: string;
  description: string | null;
  points: GpxPoint[];
}

export interface GpxDocument {
  name: string;
  description: string | null;
  creator: string | null;
  version: string | null;
  waypoints: GpxWaypoint[];
  tracks: GpxTrack[];
  routes: GpxRoute[];
}

export interface GpxLoadedFile {
  id: string;
  name: string;
  size: number;
  text: string;
  data: GpxDocument;
  warnings: string[];
}

export interface GpxItemSummary {
  id: string;
  index: number;
  name: string;
  kind: GpxItemKind;
  pointCount: number;
  distanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  durationSeconds: number | null;
  avgSpeedMps: number | null;
  preview: string;
}

export interface GpxBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GpxElevationSample {
  distanceMeters: number;
  elevationMeters: number;
  lat: number;
  lon: number;
  index: number;
}

export interface GpxDiagramStats {
  title: string;
  tracks: number;
  routes: number;
  waypoints: number;
  points: number;
  distanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  minElevationMeters: number | null;
  maxElevationMeters: number | null;
  durationSeconds: number | null;
  avgSpeedMps: number | null;
  movingSpeedMps: number | null;
  bounds: GpxBounds | null;
  hasElevation: boolean;
  hasTimestamps: boolean;
}

export interface GpxRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface GpxProfileGeometry {
  linePoints: string;
  areaPoints: string;
}
