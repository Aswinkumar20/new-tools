export type LidarExportFormat =
  | 'original'
  | 'summary-json'
  | 'classification-csv'
  | 'points-geojson';

export type LidarColorMode = 'classification' | 'elevation' | 'intensity';

export interface LidarLasHeader {
  versionMajor: number;
  versionMinor: number;
  systemIdentifier: string;
  generatingSoftware: string;
  headerSize: number;
  offsetToPointData: number;
  pointDataFormat: number;
  pointDataRecordLength: number;
  pointCount: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  maxX: number;
  minX: number;
  maxY: number;
  minY: number;
  maxZ: number;
  minZ: number;
}

export interface LidarPoint {
  x: number;
  y: number;
  z: number;
  intensity: number;
  classification: number;
  /** Geographic: treat x as lon, y as lat when looksGeographic. */
  lon: number;
  lat: number;
}

export interface LidarBounds {
  west: number;
  south: number;
  east: number;
  north: number;
  minZ: number;
  maxZ: number;
}

export interface LidarClassHistogramEntry {
  classification: number;
  label: string;
  count: number;
}

export interface LidarStats {
  pointCount: number;
  previewCount: number;
  subsampled: boolean;
  pointFormat: number;
  pointRecordLength: number;
  scale: { x: number; y: number; z: number };
  offset: { x: number; y: number; z: number };
  bounds: LidarBounds;
  zMin: number;
  zMax: number;
  intensityMin: number;
  intensityMax: number;
  classHistogram: LidarClassHistogramEntry[];
  densityPerSqM: number | null;
  looksGeographic: boolean;
  version: string;
  systemIdentifier: string;
  generatingSoftware: string;
}

export interface LidarLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  header: LidarLasHeader | null;
  points: LidarPoint[];
  stats: LidarStats | null;
  warnings: string[];
  isLaz: boolean;
}

export interface LidarRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface LidarParseResult {
  header: LidarLasHeader;
  points: LidarPoint[];
  stats: LidarStats;
  warnings: string[];
}
