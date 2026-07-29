import {
  averageFrequencyLevel,
  buildVoiceRecording,
  buildVoiceRecordingDownloadName,
  computeVoiceRecorderStats,
  formatVoiceRecorderFileSize,
  formatVoiceRecorderTime,
  mapMicrophoneAccessError,
  prependVoiceRecordings,
  resolveVoiceRecorderStatus,
  resolveVoiceRecorderSuggestion
} from './voice-recorder.utils';
import type { VoiceRecording } from '../types/voice-recorder.types';

function recording(partial: Partial<VoiceRecording> & { id: string }): VoiceRecording {
  return {
    audioUrl: 'blob:x',
    blob: new Blob(['x']),
    duration: 1,
    timestamp: 1,
    size: 10,
    ...partial
  };
}

describe('voice-recorder.utils', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 'blob:mock')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn()
    });
  });

  it('formats time and file size', () => {
    expect(formatVoiceRecorderTime(65)).toBe('01:05');
    expect(formatVoiceRecorderTime(-1)).toBe('00:00');
    expect(formatVoiceRecorderFileSize(500)).toBe('500 B');
    expect(formatVoiceRecorderFileSize(2048)).toBe('2.0 KB');
    expect(formatVoiceRecorderFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('builds and prepends recordings with history limit', () => {
    const built = buildVoiceRecording({
      chunks: [new Blob(['abc'])],
      duration: 3.2,
      now: 42,
      random: () => 0.123456789
    });
    expect(built.duration).toBe(3.2);
    expect(built.timestamp).toBe(42);
    expect(built.blob.type).toBe('audio/webm');
    expect(buildVoiceRecordingDownloadName(42)).toBe('recording-42.webm');

    const next = prependVoiceRecordings([recording({ id: 'old' })], recording({ id: 'new' }), 1);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('new');
  });

  it('computes stats and frequency level', () => {
    expect(computeVoiceRecorderStats([])).toEqual({
      count: 0,
      totalDuration: 0,
      totalSize: 0
    });
    const stats = computeVoiceRecorderStats([
      recording({ id: '1', duration: 2, size: 100 }),
      recording({ id: '2', duration: 4, size: 300 })
    ]);
    expect(stats.count).toBe(2);
    expect(stats.totalDuration).toBe(6);
    expect(stats.totalSize).toBe(400);
    expect(stats.averageDuration).toBe(3);

    expect(averageFrequencyLevel(new Uint8Array([0, 255]))).toBeCloseTo(0.5);
  });

  it('maps microphone errors and status labels', () => {
    const denied = new Error('denied');
    denied.name = 'NotAllowedError';
    expect(mapMicrophoneAccessError(denied)).toContain('permission');

    const missing = new Error('missing');
    missing.name = 'NotFoundError';
    expect(mapMicrophoneAccessError(missing)).toContain('microphone');

    expect(resolveVoiceRecorderStatus({ isRecording: true, isPaused: true, isPlaying: false })).toBe(
      'Paused'
    );
    expect(resolveVoiceRecorderStatus({ isRecording: false, isPaused: false, isPlaying: true })).toBe(
      'Playing'
    );
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveVoiceRecorderSuggestion({
        hasRecordings: false,
        hasError: false,
        isRecording: false,
        errorMessage: null
      })?.id
    ).toBe('vr-trimmer');

    expect(
      resolveVoiceRecorderSuggestion({
        hasRecordings: true,
        hasError: false,
        isRecording: false,
        errorMessage: null
      })?.id
    ).toBe('vr-audio-player');

    expect(
      resolveVoiceRecorderSuggestion({
        hasRecordings: false,
        hasError: true,
        isRecording: false,
        errorMessage: 'Microphone permission was denied.'
      })?.id
    ).toBe('vr-mic-error');
  });
});
