export type GradientType = 'linear' | 'radial' | 'conic';

export interface ColorStop {
  color: string;
  position: number;
}

export interface GradientResult {
  css: string;
  type: GradientType;
  colors: ColorStop[];
  angle?: number;
  position?: string;
  shape?: string;
  size?: string;
}

export interface GradientPreset {
  label: string;
  description: string;
  type: GradientType;
  angle?: number;
  position?: string;
  shape?: string;
  size?: string;
  colors: ColorStop[];
}

export interface GradientHistoryEntry {
  timestamp: number;
  css: string;
  type: GradientType;
  angle: number;
  position: string;
  shape: string;
  size: string;
  colors: ColorStop[];
}

export interface GradientFormValues {
  type: GradientType;
  angle: number;
  position: string;
  shape: string;
  size: string;
  colorStops: ColorStop[];
}
