export type ScreenOrientationType = 'portrait' | 'landscape' | 'unknown';

export interface ScreenInfo {
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  colorDepth: number | null;
  orientationType: ScreenOrientationType;
  orientationAngle: number | null;
  aspectRatio: number;
}

export interface ScreenMetricsSource {
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio?: number;
  screen: {
    width: number;
    height: number;
    colorDepth?: number;
    orientation?: { type?: string; angle?: number };
    mozOrientation?: string;
    msOrientation?: string | { type?: string; angle?: number };
  };
}
