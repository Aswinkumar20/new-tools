import type { MtRelatedToolLink } from '../shared/mt-tool-suggestion.model';
import type {
  WebcamSnapshotCountdownOption,
  WebcamSnapshotExportFormat,
  WebcamSnapshotInfoItem,
  WebcamSnapshotRoadmapItem
} from '../types/webcam-snapshot.types';

export const WEBCAM_SNAPSHOT_TITLE = 'Webcam Snapshot';

export const WEBCAM_SNAPSHOT_DESCRIPTION =
  'Capture photos from your webcam with countdown timer, mirror flip, and instant download.';

export const WEBCAM_SNAPSHOT_UPLOAD_LABEL = 'Camera access';

export const WEBCAM_SNAPSHOT_UPLOAD_HINT =
  'Camera preview will appear here — permission required when available.';

/** Empty-state copy currently shown in the planned UI. */
export const WEBCAM_SNAPSHOT_EMPTY_HINT =
  'Camera preview — grant permission when this tool launches.';

export const WEBCAM_SNAPSHOT_ACCEPT_HINT = 'Webcam';

export const WEBCAM_SNAPSHOT_EXPORT_FORMATS: ReadonlyArray<WebcamSnapshotExportFormat> = [
  { id: 'png', label: 'PNG', mimeType: 'image/png', extension: '.png' },
  { id: 'jpg', label: 'JPG', mimeType: 'image/jpeg', extension: '.jpg' }
];

export const WEBCAM_SNAPSHOT_COUNTDOWN_OPTIONS: ReadonlyArray<WebcamSnapshotCountdownOption> = [
  { seconds: 0, label: 'None' },
  { seconds: 3, label: '3 seconds' },
  { seconds: 5, label: '5 seconds' },
  { seconds: 10, label: '10 seconds' }
];

export const WEBCAM_SNAPSHOT_ROADMAP_ITEMS: ReadonlyArray<WebcamSnapshotRoadmapItem> = [
  {
    id: 'preview',
    label: 'Live camera preview with device selector'
  },
  {
    id: 'countdown',
    label: 'Countdown timer and mirror/flip option'
  },
  {
    id: 'export',
    label: 'Capture stills as PNG or JPG'
  },
  {
    id: 'burst',
    label: 'Burst mode for multiple frames'
  }
];

export const WEBCAM_SNAPSHOT_HELP_ITEMS: ReadonlyArray<string> = [
  'Allow camera access when prompted.',
  'Choose resolution and flip options.',
  'Click capture to save a snapshot.'
];

export const WEBCAM_SNAPSHOT_INFO_ITEMS: ReadonlyArray<WebcamSnapshotInfoItem> = [
  { accent: true, text: 'Video stays on your device — no cloud upload.' },
  { accent: false, text: 'HTTPS is required for getUserMedia in most browsers.' }
];

export const WEBCAM_SNAPSHOT_RELATED_TOOLS: ReadonlyArray<MtRelatedToolLink> = [
  {
    label: 'Image Viewer',
    path: '/file-viewers/image-viewer',
    description: 'Inspect and zoom captured stills after download'
  },
  {
    label: 'Voice Recorder',
    path: '/media-tools/voice-recorder',
    description: 'Capture matching audio notes while camera capture is on the way'
  },
  {
    label: 'Video to GIF',
    path: '/media-tools/video-to-gif',
    description: 'Need an animated clip instead of a single frame?'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Confirm image MIME type and size for exported snapshots'
  }
];
