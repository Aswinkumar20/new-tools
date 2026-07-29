export interface BoxShadowPreset {
  label: string;
  description: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

export interface BoxShadowValues {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

export interface BoxShadowHistoryEntry {
  timestamp: number;
  css: string;
  values: BoxShadowValues;
}
