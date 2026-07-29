import type { MtRelatedToolLink } from '../shared/mt-tool-suggestion.model';
import type {
  VideoToGifInfoItem,
  VideoToGifPlannedFormat,
  VideoToGifQualityPreset,
  VideoToGifRoadmapItem
} from '../types/video-to-gif.types';

export const VIDEO_TO_GIF_TITLE = 'Video to GIF';

export const VIDEO_TO_GIF_DESCRIPTION =
  'Convert video clips to animated GIFs with frame rate, size, and quality controls.';

export const VIDEO_TO_GIF_UPLOAD_LABEL = 'Video upload';

export const VIDEO_TO_GIF_UPLOAD_HINT =
  'Drop MP4, WebM, or MOV files to convert to GIF.';

export const VIDEO_TO_GIF_PLANNED_FORMATS: ReadonlyArray<VideoToGifPlannedFormat> = [
  { extension: '.mp4', mimeHint: 'video/mp4', label: 'MP4' },
  { extension: '.webm', mimeHint: 'video/webm', label: 'WebM' },
  { extension: '.mov', mimeHint: 'video/quicktime', label: 'MOV' }
];

export const VIDEO_TO_GIF_FORMATS_LABEL = 'MP4, WebM, MOV';

export const VIDEO_TO_GIF_ACCEPT_ATTR =
  'video/*,' + VIDEO_TO_GIF_PLANNED_FORMATS.map((f) => f.extension).join(',');

export const VIDEO_TO_GIF_MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;
export const VIDEO_TO_GIF_MAX_FILE_SIZE_LABEL = '200MB';

/** Soft guidance from the existing help copy. */
export const VIDEO_TO_GIF_RECOMMENDED_MAX_SECONDS = 30;

export const VIDEO_TO_GIF_QUALITY_PRESETS: ReadonlyArray<VideoToGifQualityPreset> = [
  { id: 'compact', label: 'Compact', fps: 8, maxWidth: 320 },
  { id: 'balanced', label: 'Balanced', fps: 12, maxWidth: 480 },
  { id: 'smooth', label: 'Smooth', fps: 15, maxWidth: 640 }
];

export const VIDEO_TO_GIF_ROADMAP_ITEMS: ReadonlyArray<VideoToGifRoadmapItem> = [
  {
    id: 'trim',
    label: 'Trim start/end frames before conversion'
  },
  {
    id: 'quality',
    label: 'Adjust output width, FPS, and color palette'
  },
  {
    id: 'loop',
    label: 'Loop count and reverse playback options'
  },
  {
    id: 'preview',
    label: 'Preview GIF before download'
  }
];

export const VIDEO_TO_GIF_HELP_ITEMS: ReadonlyArray<string> = [
  'Upload a short video clip (recommended under 30 s).',
  'Set trim range and GIF quality settings.',
  'Generate and download the animated GIF.'
];

export const VIDEO_TO_GIF_INFO_ITEMS: ReadonlyArray<VideoToGifInfoItem> = [
  { accent: true, text: 'Conversion runs locally — longer clips take more time.' },
  { accent: false, text: 'Reduce FPS and width to keep GIF file size manageable.' }
];

export const VIDEO_TO_GIF_RELATED_TOOLS: ReadonlyArray<MtRelatedToolLink> = [
  {
    label: 'Image Viewer',
    path: '/file-viewers/image-viewer',
    description: 'Inspect animated GIFs and frame stills after conversion'
  },
  {
    label: 'Webcam Snapshot',
    path: '/media-tools/webcam-snapshot',
    description: 'Capture stills when a short clip is more than you need'
  },
  {
    label: 'Video Player',
    path: '/file-viewers/video-player',
    description: 'Preview source clips while GIF conversion is on the way'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Confirm codec, resolution, and duration before converting'
  }
];
