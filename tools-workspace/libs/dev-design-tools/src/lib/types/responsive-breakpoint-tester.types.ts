export interface ResponsiveBreakpointPreset {
  name: string;
  width: number;
  height: number;
  icon: string;
}

export interface ResponsiveActiveBreakpoint {
  name: string;
  min: number;
  max: number;
}

export interface ResponsiveViewportSize {
  width: number;
  height: number;
}
