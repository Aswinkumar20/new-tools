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

export function formatVideoTime(seconds: number): string {
  if (Number.isNaN(seconds) || !Number.isFinite(seconds)) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
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

export function loadVideoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.addEventListener('loadedmetadata', () => {
      resolve(video.duration);
    });

    video.addEventListener('error', () => {
      reject(new Error('Failed to load video metadata'));
    });

    video.src = url;
  });
}

export function isIgnorableVideoPlaybackError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: string }).name;
  return name === 'AbortError' || name === 'NotAllowedError';
}

export function resolveVideoSuggestion(options: {
  hasVideos: boolean;
  hasError: boolean;
  isPlaying: boolean;
  videoCount: number;
}): FvToolSuggestion | null {
  const { hasVideos, hasError, isPlaying, videoCount } = options;

  if (hasError) {
    return {
      id: 'vp-meta',
      title: 'Check the file metadata?',
      reason:
        'Playback failed. Confirm MIME type and container support before retrying with another encode.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasVideos) {
    return {
      id: 'vp-audio',
      title: 'Need playback right now?',
      reason:
        'Upload a video here, or use Audio Player for soundtracks and Image Viewer for stills.',
      actionLabel: 'Open Audio Player',
      path: '/file-viewers/audio-player'
    };
  }

  if (videoCount > 1 && isPlaying) {
    return {
      id: 'vp-archive',
      title: 'Unpacking a media ZIP?',
      reason: 'Many video packs ship as archives. Browse the ZIP first, then load individual clips here.',
      actionLabel: 'Open Archive Viewer',
      path: '/file-viewers/archive-viewer'
    };
  }

  if (hasVideos) {
    return {
      id: 'vp-meta-loaded',
      title: 'Inspect container details?',
      reason: 'Verify codec and MIME metadata for unusual video containers.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  return null;
}
