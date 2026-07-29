import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  AUDIO_REPEAT_MODES,
  AUDIO_SUPPORTED_EXTENSIONS
} from '../constants/audio-player.constants';
import type { AudioRepeatMode } from '../types/audio-player.types';

export function getAudioFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) {
    return '';
  }
  return `.${parts.pop()?.toLowerCase() ?? ''}`;
}

export function isSupportedAudioFile(
  file: Pick<File, 'name' | 'type'>,
  extensions: ReadonlyArray<string> = AUDIO_SUPPORTED_EXTENSIONS
): boolean {
  const ext = getAudioFileExtension(file.name);
  return extensions.includes(ext) || file.type.startsWith('audio/');
}

export function filterValidAudioFiles(files: ReadonlyArray<File>): File[] {
  return files.filter((file) => isSupportedAudioFile(file));
}

export function formatAudioTime(seconds: number): string {
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

export function formatAudioFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function clampVolumePercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function cycleRepeatMode(
  current: AudioRepeatMode,
  modes: ReadonlyArray<AudioRepeatMode> = AUDIO_REPEAT_MODES
): AudioRepeatMode {
  const currentIndex = modes.indexOf(current);
  return modes[(currentIndex + 1) % modes.length];
}

/** Fisher–Yates shuffle of playlist indices. */
export function generateShuffledIndices(
  length: number,
  random: () => number = Math.random
): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

export function resolvePreviousTrackIndex(options: {
  trackCount: number;
  currentIndex: number;
  shuffleMode: boolean;
  shuffledIndices: ReadonlyArray<number>;
}): number {
  const { trackCount, currentIndex, shuffleMode, shuffledIndices } = options;
  if (trackCount === 0) {
    return -1;
  }
  if (shuffleMode && shuffledIndices.length > 0) {
    const currentShuffleIndex = shuffledIndices.indexOf(currentIndex);
    return currentShuffleIndex > 0
      ? shuffledIndices[currentShuffleIndex - 1]
      : shuffledIndices[shuffledIndices.length - 1];
  }
  return currentIndex > 0 ? currentIndex - 1 : trackCount - 1;
}

export function resolveNextTrackIndex(options: {
  trackCount: number;
  currentIndex: number;
  shuffleMode: boolean;
  shuffledIndices: ReadonlyArray<number>;
}): number {
  const { trackCount, currentIndex, shuffleMode, shuffledIndices } = options;
  if (trackCount === 0) {
    return -1;
  }
  if (shuffleMode && shuffledIndices.length > 0) {
    const currentShuffleIndex = shuffledIndices.indexOf(currentIndex);
    return currentShuffleIndex < shuffledIndices.length - 1
      ? shuffledIndices[currentShuffleIndex + 1]
      : shuffledIndices[0];
  }
  return currentIndex < trackCount - 1 ? currentIndex + 1 : 0;
}

export function shouldStopAtPlaylistEnd(options: {
  repeatMode: AudioRepeatMode;
  currentIndex: number;
  nextIndex: number;
  trackCount: number;
}): boolean {
  const { repeatMode, currentIndex, nextIndex, trackCount } = options;
  return (
    nextIndex === 0 &&
    repeatMode === 'none' &&
    currentIndex === trackCount - 1
  );
}

export function loadAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'metadata';

    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });

    audio.addEventListener('error', () => {
      reject(new Error('Failed to load audio metadata'));
    });

    audio.src = url;
  });
}

export function isIgnorablePlaybackError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: string }).name;
  return name === 'AbortError' || name === 'NotAllowedError';
}

export function resolveAudioSuggestion(options: {
  hasTracks: boolean;
  hasError: boolean;
  isPlaying: boolean;
  trackCount: number;
}): FvToolSuggestion | null {
  const { hasTracks, hasError, isPlaying, trackCount } = options;

  if (hasError) {
    return {
      id: 'ap-meta',
      title: 'Check the file metadata?',
      reason:
        'Playback failed. Confirm MIME type and container support before retrying with another encode.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasTracks) {
    return {
      id: 'ap-archive',
      title: 'Unpacking an album ZIP?',
      reason:
        'Many music packs ship as archives. Browse the ZIP first, then load individual tracks here — or record a new clip with Voice Recorder.',
      actionLabel: 'Open Archive Viewer',
      path: '/file-viewers/archive-viewer'
    };
  }

  if (trackCount > 1 && isPlaying) {
    return {
      id: 'ap-video',
      title: 'Have matching video takes?',
      reason: 'Multi-track sessions often include video. Preview those files in Video Player without leaving EasyToolHub.',
      actionLabel: 'Open Video Player',
      path: '/file-viewers/video-player'
    };
  }

  if (hasTracks) {
    return {
      id: 'ap-meta-loaded',
      title: 'Inspect container details?',
      reason: 'Verify bitrate and codec metadata for unusual formats like WMA or AIFF.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  return null;
}
