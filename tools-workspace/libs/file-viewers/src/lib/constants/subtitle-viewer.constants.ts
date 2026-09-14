import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const SUBTITLE_VIEWER_TITLE = 'Subtitle Viewer';
export const SUBTITLE_VIEWER_DESCRIPTION =
  'Open SRT and WebVTT subtitle files, browse cues on a timeline, and search dialogue.';
export const SUBTITLE_ACCEPT_ATTR = '.srt,.vtt,.sub,text/plain';
export const SUBTITLE_FORMATS_LABEL = 'SRT, VTT';

export const SUBTITLE_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Video Player',
    path: '/file-viewers/video-player',
    description: 'Preview video clips alongside subtitle files'
  },
  {
    label: 'Text File Viewer',
    path: '/file-viewers/text-file-viewer',
    description: 'Read plain-text exports and scripts'
  }
];

export const SUBTITLE_HELP_ITEMS = [
  'Upload an .srt or .vtt subtitle file.',
  'Search cues and review start/end timestamps.',
  'Click a cue to copy its text.'
] as const;
