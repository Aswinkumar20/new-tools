import { ORIENTATION_SAMPLE_LIMIT } from '../constants/device-orientation.constants';
import {
  createOrientationSample,
  formatAllOrientationSamples,
  formatOrientationAngle,
  formatOrientationSample,
  getOrientationPermissionRequest,
  isDeviceOrientationSupported,
  prependOrientationSample,
  resolveOrientationSuggestion
} from './device-orientation.utils';

describe('device-orientation.utils', () => {
  it('detects DeviceOrientation support safely', () => {
    expect(isDeviceOrientationSupported(false)).toBe(false);
    expect(typeof isDeviceOrientationSupported(true)).toBe('boolean');
  });

  it('creates and prepends samples with a hard limit', () => {
    const sample = createOrientationSample({
      alpha: 10,
      beta: 20,
      gamma: 30,
      absolute: true,
      timestamp: 1000
    });
    expect(sample).toEqual({
      alpha: 10,
      beta: 20,
      gamma: 30,
      absolute: true,
      timestamp: 1000
    });

    const samples = Array.from({ length: ORIENTATION_SAMPLE_LIMIT }, (_, index) =>
      createOrientationSample({
        alpha: index,
        beta: 0,
        gamma: 0,
        timestamp: index
      })
    );
    const next = prependOrientationSample(samples, sample);
    expect(next).toHaveLength(ORIENTATION_SAMPLE_LIMIT);
    expect(next[0]).toEqual(sample);
  });

  it('formats angles, samples, and streams', () => {
    expect(formatOrientationAngle(null)).toBe('N/A');
    expect(formatOrientationAngle(12.34)).toBe('12.3°');

    const sample = createOrientationSample({
      alpha: 1,
      beta: 2,
      gamma: null,
      absolute: false,
      timestamp: 1_700_000_000_000
    });
    const line = formatOrientationSample(sample);
    expect(line).toContain('α=1.0°');
    expect(line).toContain('γ=N/A');
    expect(line).toContain('relative');
    expect(formatAllOrientationSamples([sample])).toBe(line);
  });

  it('resolves permission request helpers', () => {
    expect(getOrientationPermissionRequest(undefined)).toBeNull();
    expect(getOrientationPermissionRequest({})).toBeNull();

    const requestPermission = jest.fn().mockResolvedValue('granted');
    const request = getOrientationPermissionRequest({ requestPermission });
    expect(request).toBeTruthy();
  });

  it('resolves contextual suggestions', () => {
    expect(resolveOrientationSuggestion(false, false, 0)?.path).toBe(
      '/testing-tools/user-agent-parser'
    );
    expect(resolveOrientationSuggestion(true, false, 0)?.path).toBe(
      '/browser-utils/battery-status-viewer'
    );
    expect(resolveOrientationSuggestion(true, true, 3)?.path).toBe(
      '/dev-design-tools/viewport-size-detector'
    );
    expect(resolveOrientationSuggestion(true, false, 2)?.path).toBe(
      '/browser-utils/screen-resolution-info'
    );
  });
});
