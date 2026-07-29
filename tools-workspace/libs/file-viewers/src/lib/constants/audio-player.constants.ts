import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';
import type { AudioRepeatMode, AudioVisualizationColors } from '../types/audio-player.types';

export const AUDIO_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = [
  '.mp3',
  '.wav',
  '.ogg',
  '.flac',
  '.aac',
  '.m4a',
  '.opus',
  '.webm',
  '.wma',
  '.aiff',
  '.au'
];

export const AUDIO_ACCEPT_ATTR =
  'audio/*,' + AUDIO_SUPPORTED_EXTENSIONS.join(',');

export const AUDIO_PLAYBACK_RATES: ReadonlyArray<number> = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const AUDIO_REPEAT_MODES: ReadonlyArray<AudioRepeatMode> = ['none', 'all', 'one'];

export const AUDIO_DEFAULT_VOLUME = 100;
export const AUDIO_VIS_FFT_SIZE = 256;
export const AUDIO_VIS_CANVAS_HEIGHT = 150;
export const AUDIO_TRACK_LOAD_DELAY_MS = 100;

export const AUDIO_VIS_COLORS: AudioVisualizationColors = {
  background: '#1a237e',
  bars: '#2196f3',
  waveform: '#4caf50'
};

export const AUDIO_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Video Player',
    path: '/file-viewers/video-player',
    description: 'Switch to video when a media pack includes both audio and video'
  },
  {
    label: 'Archive Viewer',
    path: '/file-viewers/archive-viewer',
    description: 'Browse ZIP albums before extracting tracks locally'
  },
  {
    label: 'Voice Recorder',
    path: '/media-tools/voice-recorder',
    description: 'Capture a clip locally, then load it here for review'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Inspect MIME type and size for unusual audio containers'
  }
];
