import {
  clampGifFps,
  clampGifWidth,
  estimateGifBytes,
  formatVideoToGifFileSize,
  getVideoToGifFormatsSummary,
  getVideoToGifPlannedFormatCount,
  getVideoToGifQualityPresetCount,
  isClipLongerThanRecommended,
  isPlannedVideoToGifFile,
  resolveVideoToGifSuggestion,
  validateVideoToGifFiles
} from './video-to-gif.utils';

describe('video-to-gif.utils', () => {
  it('summarizes planned formats and presets', () => {
    expect(getVideoToGifPlannedFormatCount()).toBe(3);
    expect(getVideoToGifQualityPresetCount()).toBe(3);
    expect(getVideoToGifFormatsSummary()).toContain('MP4');
    expect(getVideoToGifFormatsSummary()).toContain('MOV');
  });

  it('detects planned video files', () => {
    expect(isPlannedVideoToGifFile({ name: 'clip.mp4', type: '' })).toBe(true);
    expect(isPlannedVideoToGifFile({ name: 'x.bin', type: 'video/webm' })).toBe(true);
    expect(isPlannedVideoToGifFile({ name: 'song.mp3', type: 'audio/mpeg' })).toBe(false);
  });

  it('validates video files for future upload', () => {
    const { validFiles, errors } = validateVideoToGifFiles([
      new File(['x'], 'a.mp4', { type: 'video/mp4' }),
      new File(['x'], 'b.txt', { type: 'text/plain' })
    ]);
    expect(validFiles).toHaveLength(1);
    expect(errors.some((e) => e.includes('Unsupported'))).toBe(true);

    const huge = new File([new ArrayBuffer(1)], 'big.mov', { type: 'video/quicktime' });
    Object.defineProperty(huge, 'size', { value: 201 * 1024 * 1024 });
    expect(validateVideoToGifFiles([huge]).errors[0]).toContain('max 200MB');
  });

  it('clamps quality knobs and estimates output size', () => {
    expect(clampGifFps(0)).toBe(1);
    expect(clampGifFps(60)).toBe(30);
    expect(clampGifWidth(10)).toBe(64);
    expect(clampGifWidth(2000)).toBe(1280);
    expect(estimateGifBytes({ width: 320, height: 240, durationSeconds: 2, fps: 10 })).toBeGreaterThan(
      0
    );
    expect(formatVideoToGifFileSize(0)).toBe('0 Bytes');
    expect(isClipLongerThanRecommended(45)).toBe(true);
    expect(isClipLongerThanRecommended(10)).toBe(false);
  });

  it('resolves coming-soon suggestion to image viewer', () => {
    expect(resolveVideoToGifSuggestion({ isComingSoon: true })?.id).toBe('vg-image-viewer');
    expect(resolveVideoToGifSuggestion({ isComingSoon: false })?.id).toBe('vg-meta');
  });
});
