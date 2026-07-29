import {
  clampTrimRange,
  formatAudioTrimmerFileSize,
  formatTrimTimestamp,
  getAudioTrimmerExportFormatCount,
  getAudioTrimmerFormatsSummary,
  getAudioTrimmerPlannedFormatCount,
  isPlannedAudioTrimmerFile,
  resolveAudioTrimmerSuggestion,
  validateAudioTrimmerFiles
} from './audio-trimmer.utils';

describe('audio-trimmer.utils', () => {
  it('summarizes planned formats and exports', () => {
    expect(getAudioTrimmerPlannedFormatCount()).toBe(3);
    expect(getAudioTrimmerExportFormatCount()).toBe(2);
    expect(getAudioTrimmerFormatsSummary()).toContain('MP3');
    expect(getAudioTrimmerFormatsSummary()).toContain('OGG');
  });

  it('detects planned audio files', () => {
    expect(isPlannedAudioTrimmerFile({ name: 'clip.mp3', type: '' })).toBe(true);
    expect(isPlannedAudioTrimmerFile({ name: 'x.bin', type: 'audio/wav' })).toBe(true);
    expect(isPlannedAudioTrimmerFile({ name: 'clip.mp4', type: 'video/mp4' })).toBe(false);
  });

  it('validates audio files for future upload', () => {
    const { validFiles, errors } = validateAudioTrimmerFiles([
      new File(['x'], 'a.mp3', { type: 'audio/mpeg' }),
      new File(['x'], 'b.txt', { type: 'text/plain' })
    ]);
    expect(validFiles).toHaveLength(1);
    expect(errors.some((e) => e.includes('Unsupported'))).toBe(true);

    const huge = new File([new ArrayBuffer(1)], 'big.wav', { type: 'audio/wav' });
    Object.defineProperty(huge, 'size', { value: 101 * 1024 * 1024 });
    expect(validateAudioTrimmerFiles([huge]).errors[0]).toContain('max 100MB');
  });

  it('formats sizes and timestamps', () => {
    expect(formatAudioTrimmerFileSize(0)).toBe('0 Bytes');
    expect(formatAudioTrimmerFileSize(2048)).toContain('KB');
    expect(formatTrimTimestamp(65.5)).toBe('1:05.500');
    expect(formatTrimTimestamp(3661.001)).toBe('1:01:01.001');
  });

  it('clamps trim ranges within duration', () => {
    expect(clampTrimRange(-1, 12, 10)).toEqual({ startSeconds: 0, endSeconds: 10 });
    expect(clampTrimRange(8, 3, 10)).toEqual({ startSeconds: 3, endSeconds: 8 });
  });

  it('resolves coming-soon suggestion to audio player', () => {
    expect(resolveAudioTrimmerSuggestion({ isComingSoon: true })?.id).toBe('at-audio-player');
    expect(resolveAudioTrimmerSuggestion({ isComingSoon: false })?.id).toBe('at-meta');
  });
});
