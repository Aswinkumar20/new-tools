export type AudioRepeatMode = 'none' | 'one' | 'all';

export interface AudioTrackFile {
  name: string;
  file: File;
  url: string;
  size: number;
  duration: number;
  artist?: string;
  title?: string;
  album?: string;
  loaded: boolean;
}

export interface AudioVisualizationColors {
  background: string;
  bars: string;
  waveform: string;
}
