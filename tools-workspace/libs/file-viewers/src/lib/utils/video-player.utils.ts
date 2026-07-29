import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  VIDEO_MAX_FILE_SIZE_BYTES,
  VIDEO_MAX_FILE_SIZE_LABEL,
  VIDEO_PLANNED_FORMATS
} from '../constants/video-player.constants';
import type { VideoPlannedFormat } from '../types/video-player.types';

export function getVideoPlannedFormatCount(
  formats: ReadonlyArray<VideoPlannedFormat> = VIDEO_PLANNED_FORMATS
): number {
  return formats.length;
}

export function getVideoFormatsSummary(
  formats: ReadonlyArray<VideoPlannedFormat> = VIDEO_PLANNED_FORMATS
): string {
  return formats.map((f) => f.label).join(', ');
}

export function formatVideoFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function isPlannedVideoFile(
  file: Pick<File, 'name' | 'type'>,
  formats: ReadonlyArray<VideoPlannedFormat> = VIDEO_PLANNED_FORMATS
): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime.startsWith('video/')) {
    return true;
  }
  return formats.some((f) => name.endsWith(f.extension));
}

/**
 * Ready for when upload lands — mirrors other viewers' size gate.
 * Not wired to UI while the tool is coming soon.
 */
export function validateVideoFiles(
  files: ReadonlyArray<File>,
  options: {
    maxFileSize?: number;
    maxFileSizeLabel?: string;
  } = {}
): { validFiles: File[]; errors: string[] } {
  const maxFileSize = options.maxFileSize ?? VIDEO_MAX_FILE_SIZE_BYTES;
  const maxLabel = options.maxFileSizeLabel ?? VIDEO_MAX_FILE_SIZE_LABEL;
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!isPlannedVideoFile(file)) {
      errors.push(`${file.name}: Unsupported video format. Planned: ${getVideoFormatsSummary()}.`);
      continue;
    }
    if (file.size > maxFileSize) {
      errors.push(`${file.name}: File too large (max ${maxLabel})`);
      continue;
    }
    validFiles.push(file);
  }

  return { validFiles, errors };
}

export function resolveVideoSuggestion(options: {
  isComingSoon: boolean;
}): FvToolSuggestion | null {
  if (options.isComingSoon) {
    return {
      id: 'vp-audio',
      title: 'Need playback right now?',
      reason:
        'Video Player is launching soon. Use Audio Player for soundtracks, or Image Viewer for stills and thumbnails.',
      actionLabel: 'Open Audio Player',
      path: '/file-viewers/audio-player'
    };
  }

  return {
    id: 'vp-meta',
    title: 'Inspect video metadata?',
    reason: 'Confirm container and codec details before sharing unusual encodes.',
    actionLabel: 'Open File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer'
  };
}
