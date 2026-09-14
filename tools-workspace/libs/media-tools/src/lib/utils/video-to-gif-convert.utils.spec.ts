import { buildGifFileName, computeScaledVideoDimensions } from './video-to-gif-convert.utils';

describe('video-to-gif-convert.utils', () => {
  it('computes scaled dimensions', () => {
    expect(computeScaledVideoDimensions(1920, 1080, 480)).toEqual({ width: 480, height: 270 });
    expect(computeScaledVideoDimensions(640, 640, 320)).toEqual({ width: 320, height: 320 });
  });

  it('builds gif file names', () => {
    expect(buildGifFileName('clip.mp4')).toBe('clip.gif');
  });
});
