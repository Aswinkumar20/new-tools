import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const SPECTROGRAM_VIEWER_TITLE = 'Spectrogram Viewer';
export const SPECTROGRAM_DESCRIPTION =
  'Generate and explore STFT spectrograms from audio files with zoom controls.';
export const SPECTROGRAM_ACCEPT_ATTR = 'audio/*,.wav,.mp3,.ogg,.flac,.m4a';
export const SPECTROGRAM_FORMATS_LABEL = 'Audio files';

export const SPECTROGRAM_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'WAV Spectrum Viewer',
    path: '/file-viewers/wav-spectrum-viewer',
    description: 'Waveform and live FFT spectrum analysis'
  },
  {
    label: 'Audio Trimmer',
    path: '/media-tools/audio-trimmer',
    description: 'Trim and export audio segments'
  }
];

export const SPECTROGRAM_HELP_ITEMS = [
  'Upload an audio file to compute a spectrogram.',
  'Adjust zoom to focus on a time range.',
  'Use darker colors for stronger frequency energy.'
] as const;
