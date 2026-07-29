export type ViewportOrientation = 'portrait' | 'landscape' | 'square';

export interface ViewportInfo {
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  orientation: ViewportOrientation;
  aspectRatio: number;
  visualViewportWidth?: number;
  visualViewportHeight?: number;
  timestamp: number;
}

export interface ViewportHistoryEntry {
  timestamp: number;
  width: number;
  height: number;
  aspectRatio: number;
}

export interface ViewportBreakpoint {
  name: string;
  min: number;
  max: number;
}

/** Minimal browser surface used by pure viewport readers (testable). */
export interface ViewportWindowLike {
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio?: number;
  screen: { width: number; height: number };
  visualViewport?: { width: number; height: number } | null;
}
