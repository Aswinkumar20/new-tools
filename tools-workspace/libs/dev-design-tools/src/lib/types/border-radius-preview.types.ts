export type BorderRadiusMode = 'uniform' | 'individual';
export type BorderRadiusUnit = 'px' | 'rem' | 'em' | '%';

export interface BorderRadiusPreset {
  label: string;
  description: string;
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface BorderRadiusHistoryValues {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
  unit: BorderRadiusUnit;
  mode: BorderRadiusMode;
}

export interface BorderRadiusHistoryEntry {
  timestamp: number;
  css: string;
  values: BorderRadiusHistoryValues;
}

export interface BorderRadiusCornerValues {
  mode: BorderRadiusMode;
  uniform: number;
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
  unit: BorderRadiusUnit;
}
