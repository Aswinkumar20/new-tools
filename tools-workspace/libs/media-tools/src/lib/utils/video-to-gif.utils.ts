import type { MtToolSuggestion } from '../shared/mt-tool-suggestion.model';
import {
  VIDEO_TO_GIF_MAX_FILE_SIZE_BYTES,
  VIDEO_TO_GIF_MAX_FILE_SIZE_LABEL,
  VIDEO_TO_GIF_PLANNED_FORMATS,
  VIDEO_TO_GIF_QUALITY_PRESETS,
  VIDEO_TO_GIF_RECOMMENDED_MAX_SECONDS
} from '../constants/video-to-gif.constants';
import type {
  VideoToGifPlannedFormat,
  VideoToGifQualityPreset
} from '../types/video-to-gif.types';

export function getVideoToGifPlannedFormatCount(
  formats: ReadonlyArray<VideoToGifPlannedFormat> = VIDEO_TO_GIF_PLANNED_FORMATS
): number {
  return formats.length;
}

export function getVideoToGifFormatsSummary(
  formats: ReadonlyArray<VideoToGifPlannedFormat> = VIDEO_TO_GIF_PLANNED_FORMATS
): string {
  return formats.map((f) => f.label).join(', ');
}

export function getVideoToGifQualityPresetCount(
  presets: ReadonlyArray<VideoToGifQualityPreset> = VIDEO_TO_GIF_QUALITY_PRESETS
): number {
  return presets.length;
}

export function formatVideoToGifFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function isPlannedVideoToGifFile(
  file: Pick<File, 'name' | 'type'>,
  formats: ReadonlyArray<VideoToGifPlannedFormat> = VIDEO_TO_GIF_PLANNED_FORMATS
): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime.startsWith('video/')) {
    return true;
  }
  return formats.some((f) => name.endsWith(f.extension));
}

/**
 * Ready for when upload lands — mirrors other media tools' size gate.
 * Not wired to UI while the tool is coming soon.
 */
export function validateVideoToGifFiles(
  files: ReadonlyArray<File>,
  options: {
    maxFileSize?: number;
    maxFileSizeLabel?: string;
  } = {}
): { validFiles: File[]; errors: string[] } {
  const maxFileSize = options.maxFileSize ?? VIDEO_TO_GIF_MAX_FILE_SIZE_BYTES;
  const maxLabel = options.maxFileSizeLabel ?? VIDEO_TO_GIF_MAX_FILE_SIZE_LABEL;
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!isPlannedVideoToGifFile(file)) {
      errors.push(
        `${file.name}: Unsupported video format. Planned: ${getVideoToGifFormatsSummary()}.`
      );
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

export function clampGifFps(fps: number, min = 1, max = 30): number {
  if (!Number.isFinite(fps)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(fps)));
}

export function clampGifWidth(width: number, min = 64, max = 1280): number {
  if (!Number.isFinite(width)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(width)));
}

/**
 * Rough local estimate used to warn about large outputs once conversion ships.
 * Assumes ~0.35 bytes per pixel per frame before palette compression.
 */
export function estimateGifBytes(options: {
  width: number;
  height: number;
  durationSeconds: number;
  fps: number;
}): number {
  const width = clampGifWidth(options.width);
  const height = Math.max(1, Math.round(options.height));
  const fps = clampGifFps(options.fps);
  const duration = Math.max(0, options.durationSeconds);
  const frames = Math.max(1, Math.ceil(duration * fps));
  return Math.round(width * height * frames * 0.35);
}

export function isClipLongerThanRecommended(
  durationSeconds: number,
  maxSeconds: number = VIDEO_TO_GIF_RECOMMENDED_MAX_SECONDS
): boolean {
  return Number.isFinite(durationSeconds) && durationSeconds > maxSeconds;
}

export function resolveVideoToGifSuggestion(options: {
  isComingSoon: boolean;
}): MtToolSuggestion | null {
  if (options.isComingSoon) {
    return {
      id: 'vg-image-viewer',
      title: 'Working with GIFs already?',
      reason:
        'Video to GIF is launching soon. Use Image Viewer to inspect animated GIFs, or Webcam Snapshot for a single frame.',
      actionLabel: 'Open Image Viewer',
      path: '/file-viewers/image-viewer'
    };
  }

  return {
    id: 'vg-meta',
    title: 'Inspect source video metadata?',
    reason: 'Confirm resolution and duration before converting long or unusual encodes.',
    actionLabel: 'Open File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer'
  };
}
