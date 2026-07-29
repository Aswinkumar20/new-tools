import type { MtRelatedToolLink } from '../shared/mt-tool-suggestion.model';
import type {
  AudioTrimmerExportFormat,
  AudioTrimmerInfoItem,
  AudioTrimmerPlannedFormat,
  AudioTrimmerRoadmapItem
} from '../types/audio-trimmer.types';

export const AUDIO_TRIMMER_TITLE = 'Audio Trimmer';

export const AUDIO_TRIMMER_DESCRIPTION =
  'Select start and end points on a waveform to trim audio clips and export in common formats.';

export const AUDIO_TRIMMER_UPLOAD_LABEL = 'Audio upload';

export const AUDIO_TRIMMER_UPLOAD_HINT =
  'Drop an audio file to open the trim editor.';

export const AUDIO_TRIMMER_PLANNED_FORMATS: ReadonlyArray<AudioTrimmerPlannedFormat> = [
  { extension: '.mp3', mimeHint: 'audio/mpeg', label: 'MP3' },
  { extension: '.wav', mimeHint: 'audio/wav', label: 'WAV' },
  { extension: '.ogg', mimeHint: 'audio/ogg', label: 'OGG' }
];

export const AUDIO_TRIMMER_FORMATS_LABEL = 'MP3, WAV, OGG';

export const AUDIO_TRIMMER_ACCEPT_ATTR =
  'audio/*,' + AUDIO_TRIMMER_PLANNED_FORMATS.map((f) => f.extension).join(',');

export const AUDIO_TRIMMER_EXPORT_FORMATS: ReadonlyArray<AudioTrimmerExportFormat> = [
  { id: 'mp3', label: 'MP3', extension: '.mp3' },
  { id: 'wav', label: 'WAV', extension: '.wav' }
];

export const AUDIO_TRIMMER_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const AUDIO_TRIMMER_MAX_FILE_SIZE_LABEL = '100MB';

export const AUDIO_TRIMMER_ROADMAP_ITEMS: ReadonlyArray<AudioTrimmerRoadmapItem> = [
  {
    id: 'waveform',
    label: 'Visual waveform with draggable start/end handles'
  },
  {
    id: 'precision',
    label: 'Precise time input in ms or hh:mm:ss'
  },
  {
    id: 'fades',
    label: 'Fade-in and fade-out options'
  },
  {
    id: 'export',
    label: 'Export trimmed clip as MP3 or WAV'
  }
];

export const AUDIO_TRIMMER_HELP_ITEMS: ReadonlyArray<string> = [
  'Upload an audio file to load the waveform.',
  'Drag handles or enter times to set the trim region.',
  'Preview and download the trimmed segment.'
];

export const AUDIO_TRIMMER_INFO_ITEMS: ReadonlyArray<AudioTrimmerInfoItem> = [
  { accent: true, text: 'Trimming uses the Web Audio API in your browser.' },
  {
    accent: false,
    text: 'Lossy re-encoding may slightly reduce quality on MP3 export.'
  }
];

export const AUDIO_TRIMMER_RELATED_TOOLS: ReadonlyArray<MtRelatedToolLink> = [
  {
    label: 'Audio Player',
    path: '/file-viewers/audio-player',
    description: 'Preview full tracks while the trim editor is on the way'
  },
  {
    label: 'Voice Recorder',
    path: '/media-tools/voice-recorder',
    description: 'Capture a clip locally, then trim it here once export ships'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Confirm MIME type and duration before trimming unusual files'
  },
  {
    label: 'Video to GIF',
    path: '/media-tools/video-to-gif',
    description: 'Need a short visual loop instead of an audio cut?'
  }
];
