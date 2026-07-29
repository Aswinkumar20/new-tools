import type { MtToolSuggestion } from '../shared/mt-tool-suggestion.model';
import {
  AUDIO_TRIMMER_EXPORT_FORMATS,
  AUDIO_TRIMMER_MAX_FILE_SIZE_BYTES,
  AUDIO_TRIMMER_MAX_FILE_SIZE_LABEL,
  AUDIO_TRIMMER_PLANNED_FORMATS
} from '../constants/audio-trimmer.constants';
import type {
  AudioTrimmerExportFormat,
  AudioTrimmerPlannedFormat
} from '../types/audio-trimmer.types';

export function getAudioTrimmerPlannedFormatCount(
  formats: ReadonlyArray<AudioTrimmerPlannedFormat> = AUDIO_TRIMMER_PLANNED_FORMATS
): number {
  return formats.length;
}

export function getAudioTrimmerExportFormatCount(
  formats: ReadonlyArray<AudioTrimmerExportFormat> = AUDIO_TRIMMER_EXPORT_FORMATS
): number {
  return formats.length;
}

export function getAudioTrimmerFormatsSummary(
  formats: ReadonlyArray<AudioTrimmerPlannedFormat> = AUDIO_TRIMMER_PLANNED_FORMATS
): string {
  return formats.map((f) => f.label).join(', ');
}

export function formatAudioTrimmerFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function isPlannedAudioTrimmerFile(
  file: Pick<File, 'name' | 'type'>,
  formats: ReadonlyArray<AudioTrimmerPlannedFormat> = AUDIO_TRIMMER_PLANNED_FORMATS
): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime.startsWith('audio/')) {
    return true;
  }
  return formats.some((f) => name.endsWith(f.extension));
}

/**
 * Ready for when upload lands — mirrors other media tools' size gate.
 * Not wired to UI while the tool is coming soon.
 */
export function validateAudioTrimmerFiles(
  files: ReadonlyArray<File>,
  options: {
    maxFileSize?: number;
    maxFileSizeLabel?: string;
  } = {}
): { validFiles: File[]; errors: string[] } {
  const maxFileSize = options.maxFileSize ?? AUDIO_TRIMMER_MAX_FILE_SIZE_BYTES;
  const maxLabel = options.maxFileSizeLabel ?? AUDIO_TRIMMER_MAX_FILE_SIZE_LABEL;
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!isPlannedAudioTrimmerFile(file)) {
      errors.push(
        `${file.name}: Unsupported audio format. Planned: ${getAudioTrimmerFormatsSummary()}.`
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

/** Clamp a trim window so start stays before end within the clip duration. */
export function clampTrimRange(
  startSeconds: number,
  endSeconds: number,
  durationSeconds: number
): { startSeconds: number; endSeconds: number } {
  const duration = Math.max(0, durationSeconds);
  let start = Math.max(0, Math.min(startSeconds, duration));
  let end = Math.max(0, Math.min(endSeconds, duration));
  if (end < start) {
    [start, end] = [end, start];
  }
  return { startSeconds: start, endSeconds: end };
}

export function formatTrimTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00.000';
  }
  const totalMs = Math.floor(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSecs = Math.floor(totalMs / 1000);
  const s = totalSecs % 60;
  const m = Math.floor(totalSecs / 60) % 60;
  const h = Math.floor(totalSecs / 3600);
  const frac = ms.toString().padStart(3, '0');
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${frac}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}.${frac}`;
}

export function resolveAudioTrimmerSuggestion(options: {
  isComingSoon: boolean;
}): MtToolSuggestion | null {
  if (options.isComingSoon) {
    return {
      id: 'at-audio-player',
      title: 'Need to preview a clip now?',
      reason:
        'Audio Trimmer is launching soon. Use Audio Player to listen to full tracks, or Voice Recorder to capture a new take.',
      actionLabel: 'Open Audio Player',
      path: '/file-viewers/audio-player'
    };
  }

  return {
    id: 'at-meta',
    title: 'Inspect audio metadata?',
    reason: 'Confirm container, bitrate, and duration before exporting unusual encodes.',
    actionLabel: 'Open File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer'
  };
}
