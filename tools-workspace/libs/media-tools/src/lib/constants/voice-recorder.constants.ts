import type { MtRelatedToolLink } from '../shared/mt-tool-suggestion.model';

export const VOICE_RECORDER_HISTORY_LIMIT = 20;

export const VOICE_RECORDER_MIME_TYPE = 'audio/webm';

export const VOICE_RECORDER_FFT_SIZE = 256;

export const VOICE_RECORDER_TIMER_MS = 100;

/** Relative bar heights for the live level visualizer. */
export const VOICE_RECORDER_VISUALIZER_HEIGHTS: ReadonlyArray<number> = [
  100, 80, 100, 70, 90, 85, 95, 75
];

export const VOICE_RECORDER_RELATED_TOOLS: ReadonlyArray<MtRelatedToolLink> = [
  {
    label: 'Audio Player',
    path: '/file-viewers/audio-player',
    description: 'Load downloaded WebM clips into a full playlist player'
  },
  {
    label: 'Audio Trimmer',
    path: '/media-tools/audio-trimmer',
    description: 'Trim long takes once the waveform editor ships'
  },
  {
    label: 'Webcam Snapshot',
    path: '/media-tools/webcam-snapshot',
    description: 'Capture a matching still when you need video context'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Inspect MIME type and size of exported recordings'
  }
];
