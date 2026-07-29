import {
  formatVideoFileSize,
  getVideoFormatsSummary,
  getVideoPlannedFormatCount,
  isPlannedVideoFile,
  resolveVideoSuggestion,
  validateVideoFiles
} from './video-player.utils';

describe('video-player.utils', () => {
  it('summarizes planned formats', () => {
    expect(getVideoPlannedFormatCount()).toBe(4);
    expect(getVideoFormatsSummary()).toContain('MP4');
    expect(getVideoFormatsSummary()).toContain('WebM');
  });

  it('detects planned video files', () => {
    expect(isPlannedVideoFile({ name: 'clip.mp4', type: '' })).toBe(true);
    expect(isPlannedVideoFile({ name: 'x.bin', type: 'video/webm' })).toBe(true);
    expect(isPlannedVideoFile({ name: 'song.mp3', type: 'audio/mpeg' })).toBe(false);
  });

  it('validates video files for future upload', () => {
    const { validFiles, errors } = validateVideoFiles([
      new File(['x'], 'a.mp4', { type: 'video/mp4' }),
      new File(['x'], 'b.txt', { type: 'text/plain' })
    ]);
    expect(validFiles).toHaveLength(1);
    expect(errors.some((e) => e.includes('Unsupported'))).toBe(true);

    const huge = new File([new ArrayBuffer(1)], 'big.mp4', { type: 'video/mp4' });
    Object.defineProperty(huge, 'size', { value: 501 * 1024 * 1024 });
    expect(validateVideoFiles([huge]).errors[0]).toContain('max 500MB');
  });

  it('formats sizes', () => {
    expect(formatVideoFileSize(0)).toBe('0 Bytes');
    expect(formatVideoFileSize(2048)).toContain('KB');
  });

  it('resolves coming-soon suggestion to audio player', () => {
    expect(resolveVideoSuggestion({ isComingSoon: true })?.id).toBe('vp-audio');
    expect(resolveVideoSuggestion({ isComingSoon: false })?.id).toBe('vp-meta');
  });
});
