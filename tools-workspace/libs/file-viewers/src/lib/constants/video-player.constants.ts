import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';
import type { VideoPlannedFormat, VideoRoadmapItem } from '../types/video-player.types';

export const VIDEO_PLANNED_FORMATS: ReadonlyArray<VideoPlannedFormat> = [
  { extension: '.mp4', mimeHint: 'video/mp4', label: 'MP4' },
  { extension: '.webm', mimeHint: 'video/webm', label: 'WebM' },
  { extension: '.mov', mimeHint: 'video/quicktime', label: 'MOV' },
  { extension: '.avi', mimeHint: 'video/x-msvideo', label: 'AVI' }
];

export const VIDEO_ACCEPT_ATTR =
  'video/*,.mp4,.webm,.mov,.avi,video/mp4,video/webm,video/quicktime,video/x-msvideo';

export const VIDEO_MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
export const VIDEO_MAX_FILE_SIZE_LABEL = '500MB';

export const VIDEO_FORMATS_LABEL = 'MP4, WebM, MOV, AVI';

export const VIDEO_ROADMAP_ITEMS: ReadonlyArray<VideoRoadmapItem> = [
  {
    id: 'formats',
    label: 'Support for MP4, WebM, MOV, and AVI formats.'
  },
  {
    id: 'scrubbing',
    label: 'Frame-accurate scrubbing with keyboard shortcuts.'
  },
  {
    id: 'pip',
    label: 'Picture-in-picture and casting options.'
  },
  {
    id: 'advanced',
    label: '360° playback, subtitle editor, and snapshot tools.'
  }
];

export const VIDEO_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Audio Player',
    path: '/file-viewers/audio-player',
    description: 'Play soundtracks and voiceovers while video playback is on the way'
  },
  {
    label: 'Image Viewer',
    path: '/file-viewers/image-viewer',
    description: 'Inspect frame stills, thumbnails, and exported screenshots'
  },
  {
    label: 'Archive Viewer',
    path: '/file-viewers/archive-viewer',
    description: 'Browse media packs before extracting clips locally'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Confirm codec and MIME type for unusual video containers'
  },
  {
    label: 'PDF Viewer',
    path: '/file-viewers/pdf-viewer',
    description: 'Review storyboards and shot lists exported as PDF'
  }
];
