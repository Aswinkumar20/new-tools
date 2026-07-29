import type { MtToolSuggestion } from '../shared/mt-tool-suggestion.model';
import {
  VOICE_RECORDER_HISTORY_LIMIT,
  VOICE_RECORDER_MIME_TYPE
} from '../constants/voice-recorder.constants';
import type {
  VoiceRecorderStats,
  VoiceRecorderSuggestionContext,
  VoiceRecording
} from '../types/voice-recorder.types';

export function formatVoiceRecorderTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatVoiceRecorderFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatVoiceRecorderTimestamp(
  timestamp: number,
  locale?: string
): string {
  return new Date(timestamp).toLocaleString(locale);
}

export function createVoiceRecordingId(
  now: number = Date.now(),
  random: () => number = Math.random
): string {
  return now.toString() + random().toString(36).substr(2, 9);
}

export function buildVoiceRecording(options: {
  chunks: Blob[];
  duration: number;
  mimeType?: string;
  now?: number;
  random?: () => number;
}): VoiceRecording {
  const mimeType = options.mimeType ?? VOICE_RECORDER_MIME_TYPE;
  const now = options.now ?? Date.now();
  const blob = new Blob(options.chunks, { type: mimeType });
  const audioUrl = URL.createObjectURL(blob);

  return {
    id: createVoiceRecordingId(now, options.random ?? Math.random),
    audioUrl,
    blob,
    duration: options.duration,
    timestamp: now,
    size: blob.size
  };
}

export function prependVoiceRecordings(
  recordings: VoiceRecording[],
  recording: VoiceRecording,
  limit: number = VOICE_RECORDER_HISTORY_LIMIT
): VoiceRecording[] {
  return [recording, ...recordings].slice(0, limit);
}

export function computeVoiceRecorderStats(
  recordings: ReadonlyArray<VoiceRecording>
): VoiceRecorderStats {
  if (recordings.length === 0) {
    return { count: 0, totalDuration: 0, totalSize: 0 };
  }

  const totalDuration = recordings.reduce((sum, r) => sum + r.duration, 0);
  const totalSize = recordings.reduce((sum, r) => sum + r.size, 0);

  return {
    count: recordings.length,
    totalDuration,
    totalSize,
    averageDuration: totalDuration / recordings.length
  };
}

export function averageFrequencyLevel(dataArray: Uint8Array): number {
  if (dataArray.length === 0) {
    return 0;
  }
  const sum = dataArray.reduce((acc, val) => acc + val, 0);
  return sum / dataArray.length / 255;
}

export function buildVoiceRecordingDownloadName(timestamp: number): string {
  return `recording-${timestamp}.webm`;
}

export function mapMicrophoneAccessError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Failed to access microphone.';
  }

  const name = error.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was denied. Allow access in the browser address bar, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Connect an input device and try again.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The microphone is busy or unreadable. Close other apps using it, then retry.';
  }
  if (name === 'SecurityError') {
    return 'Microphone access requires a secure context (HTTPS or localhost).';
  }

  return error.message || 'Failed to access microphone.';
}

export function resolveVoiceRecorderStatus(options: {
  isRecording: boolean;
  isPaused: boolean;
  isPlaying: boolean;
}): string {
  if (options.isRecording) {
    return options.isPaused ? 'Paused' : 'Recording';
  }
  if (options.isPlaying) {
    return 'Playing';
  }
  return 'Ready';
}

export function resolveVoiceRecorderSuggestion(
  context: VoiceRecorderSuggestionContext
): MtToolSuggestion | null {
  const { hasRecordings, hasError, isRecording, errorMessage } = context;

  if (hasError) {
    const isPermission =
      !!errorMessage &&
      (errorMessage.toLowerCase().includes('permission') ||
        errorMessage.toLowerCase().includes('denied'));
    return {
      id: 'vr-mic-error',
      title: isPermission ? 'Microphone blocked' : 'Microphone unavailable',
      reason: isPermission
        ? 'Browser permission is required for live capture. After allowing access, you can also preview exported clips in Audio Player.'
        : 'Check that a mic is connected and not used by another app. Audio Player can still play files you already have.',
      actionLabel: 'Open Audio Player',
      path: '/file-viewers/audio-player'
    };
  }

  if (hasRecordings && !isRecording) {
    return {
      id: 'vr-audio-player',
      title: 'Review clips in Audio Player?',
      reason:
        'Download a WebM take, then open Audio Player for playlist playback, speed control, and shuffle.',
      actionLabel: 'Open Audio Player',
      path: '/file-viewers/audio-player'
    };
  }

  if (!hasRecordings && !isRecording) {
    return {
      id: 'vr-trimmer',
      title: 'Planning a longer take?',
      reason:
        'Record here first. Audio Trimmer will let you cut start/end once the waveform editor ships.',
      actionLabel: 'Open Audio Trimmer',
      path: '/media-tools/audio-trimmer'
    };
  }

  return null;
}
