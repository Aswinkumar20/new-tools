import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const MIDI_VIEWER_TITLE = 'MIDI Viewer';
export const MIDI_VIEWER_DESCRIPTION =
  'Inspect MIDI tracks and visualize notes on a piano-roll timeline in your browser.';
export const MIDI_ACCEPT_ATTR = '.mid,.midi,audio/midi';
export const MIDI_FORMATS_LABEL = 'MID, MIDI';

export const MIDI_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Audio Player',
    path: '/file-viewers/audio-player',
    description: 'Play exported audio renders of MIDI compositions'
  },
  {
    label: 'WAV Spectrum Viewer',
    path: '/file-viewers/wav-spectrum-viewer',
    description: 'Analyze waveform and spectrum for audio files'
  }
];

export const MIDI_HELP_ITEMS = [
  'Upload a .mid or .midi file.',
  'Review track names and note counts.',
  'Explore the piano-roll visualization.'
] as const;
