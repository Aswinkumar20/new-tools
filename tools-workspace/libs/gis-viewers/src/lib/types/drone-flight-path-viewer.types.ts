import type { GpxBounds, GpxUnitSystem } from './gpx-viewer.types';

export type DroneExportFormat =
  | 'original'
  | 'path-geojson'
  | 'telemetry-csv'
  | 'summary-json';

export type DroneSourceKind = 'gpx' | 'csv' | 'geojson';

export type DroneAltitudeMode = 'agl' | 'amsl' | 'auto';

export interface DroneFlightPoint {
  lat: number;
  lon: number;
  /** Absolute altitude (AMSL) in meters when present. */
  amsl: number | null;
  /** Above-ground / relative altitude in meters when present. */
  agl: number | null;
  /** Effective altitude used for coloring/charts (AGL preferred when available). */
  altitude: number | null;
  time: string | null;
  speedMps: number | null;
  batteryPercent: number | null;
  gimbalPitchDeg: number | null;
  isPhoto: boolean;
  name: string | null;
  distanceMeters?: number;
  climbRateMps?: number | null;
}

export interface DronePhotoWaypoint {
  lat: number;
  lon: number;
  altitude: number | null;
  time: string | null;
  name: string | null;
  index: number;
}

export interface DroneFlightTrack {
  id: string;
  name: string;
  points: DroneFlightPoint[];
  photos: DronePhotoWaypoint[];
}

export interface DroneAltitudeSegment {
  from: DroneFlightPoint;
  to: DroneFlightPoint;
  distanceMeters: number;
  color: string;
}

export interface DroneFlightStats {
  title: string;
  sourceKind: DroneSourceKind;
  trackCount: number;
  pointCount: number;
  photoCount: number;
  distanceMeters: number;
  durationSeconds: number | null;
  minAltitudeMeters: number | null;
  maxAltitudeMeters: number | null;
  avgAltitudeMeters: number | null;
  maxClimbRateMps: number | null;
  maxDescentRateMps: number | null;
  homeDistanceMeters: number | null;
  altitudeMode: 'agl' | 'amsl' | 'none';
  hasBattery: boolean;
  hasGimbal: boolean;
  hasTimestamps: boolean;
  bounds: GpxBounds | null;
}

export interface DroneLoadedFile {
  id: string;
  name: string;
  size: number;
  sourceKind: DroneSourceKind;
  text: string;
  tracks: DroneFlightTrack[];
  warnings: string[];
}

export interface DroneRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DroneAltitudeSample {
  distanceMeters: number;
  altitudeMeters: number | null;
  index: number;
}

export interface DroneProfileGeometry {
  linePoints: string;
  areaPoints: string;
}

export type { GpxBounds, GpxUnitSystem };
