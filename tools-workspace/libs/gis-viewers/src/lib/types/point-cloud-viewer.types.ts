export type PointCloudExportFormat = 'original' | 'summary-json' | 'xyz-csv';

export type PointCloudColorMode = 'intensity' | 'elevation' | 'rgb' | 'classification';

export type PointCloudSourceFormat = 'las' | 'ply' | 'pcd' | 'laz' | 'e57' | 'unknown';

export interface PointCloudPoint {
  x: number;
  y: number;
  z: number;
  intensity: number;
  classification: number;
  r?: number;
  g?: number;
  b?: number;
}

export interface PointCloudBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface PointCloudStats {
  pointCount: number;
  previewCount: number;
  subsampled: boolean;
  bounds: PointCloudBounds;
  zMin: number;
  zMax: number;
  intensityMin: number;
  intensityMax: number;
  hasRgb: boolean;
  hasIntensity: boolean;
  hasClassification: boolean;
  sourceFormat: PointCloudSourceFormat;
  formatLabel: string;
}

export interface PointCloudLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  points: PointCloudPoint[];
  stats: PointCloudStats | null;
  warnings: string[];
  softFail: boolean;
  sourceFormat: PointCloudSourceFormat;
}

export interface PointCloudRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface PointCloudCamera {
  yaw: number;
  pitch: number;
  distance: number;
  panX: number;
  panY: number;
}

export interface PointCloudVec3 {
  x: number;
  y: number;
  z: number;
}
