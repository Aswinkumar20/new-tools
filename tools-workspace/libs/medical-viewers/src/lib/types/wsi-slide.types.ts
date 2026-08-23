export interface WsiPyramidLevel {
  level: number;
  width: number;
  height: number;
  /** Downsample factor relative to full resolution (1 = full). */
  downsample: number;
}

export interface WsiSlideSource {
  fullWidth: number;
  fullHeight: number;
  levels: WsiPyramidLevel[];
  warnings: string[];
}

export interface WsiViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface WsiTileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PathologyAnnotationType = 'point' | 'rectangle';

export interface PathologyAnnotation {
  id: string;
  type: PathologyAnnotationType;
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
}

export interface WsiRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}
