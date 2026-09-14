import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const WAV_SPECTRUM_TITLE = 'WAV Spectrum Viewer';
export const WAV_SPECTRUM_DESCRIPTION =
  'Visualize waveform and live FFT spectrum for WAV and other audio files.';
export const WAV_SPECTRUM_ACCEPT_ATTR = 'audio/*,.wav,.mp3,.ogg,.flac,.m4a';
export const WAV_SPECTRUM_FORMATS_LABEL = 'WAV + audio';

export const WAV_SPECTRUM_FFT_SIZE = 2048;

export const WAV_SPECTRUM_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Spectrogram Viewer',
    path: '/file-viewers/spectrogram-viewer',
    description: 'View frequency content over time with STFT'
  },
  {
    label: 'Audio Player',
    path: '/file-viewers/audio-player',
    description: 'Full playlist audio player with waveform'
  }
];

export const WAV_SPECTRUM_HELP_ITEMS = [
  'Upload a WAV or other supported audio file.',
  'Play audio and watch the live spectrum.',
  'Scrub the waveform to inspect amplitude.'
] as const;
