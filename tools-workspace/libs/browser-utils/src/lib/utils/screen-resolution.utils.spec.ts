import {
  createEmptyScreenInfo,
  formatAspectRatio,
  formatOrientationLabel,
  formatScreenMetricsText,
  isRetinaDisplay,
  readScreenInfo,
  resolveScreenSuggestion
} from './screen-resolution.utils';
import type { ScreenMetricsSource } from '../types/screen-resolution.types';

function metricsSource(overrides: Partial<ScreenMetricsSource> = {}): ScreenMetricsSource {
  return {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    screen: {
      width: 1920,
      height: 1080,
      colorDepth: 24,
      orientation: { type: 'landscape-primary', angle: 0 }
    },
    ...overrides,
    screen: {
      width: 1920,
      height: 1080,
      colorDepth: 24,
      orientation: { type: 'landscape-primary', angle: 0 },
      ...(overrides.screen ?? {})
    }
  };
}

describe('screen-resolution.utils', () => {
  it('creates an empty SSR-safe snapshot', () => {
    expect(createEmptyScreenInfo()).toEqual({
      viewportWidth: 0,
      viewportHeight: 0,
      screenWidth: 0,
      screenHeight: 0,
      devicePixelRatio: 1,
      colorDepth: null,
      orientationType: 'unknown',
      orientationAngle: null,
      aspectRatio: 0
    });
  });

  it('reads metrics from a window-like source', () => {
    const info = readScreenInfo(metricsSource());
    expect(info.viewportWidth).toBe(1280);
    expect(info.viewportHeight).toBe(720);
    expect(info.screenWidth).toBe(1920);
    expect(info.devicePixelRatio).toBe(1);
    expect(info.colorDepth).toBe(24);
    expect(info.orientationType).toBe('landscape');
    expect(info.orientationAngle).toBe(0);
    expect(info.aspectRatio).toBeCloseTo(1280 / 720);
  });

  it('infers orientation from viewport when Screen Orientation API is missing', () => {
    const portrait = readScreenInfo({
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 1,
      screen: { width: 390, height: 844, colorDepth: 24 }
    });
    expect(portrait.orientationType).toBe('portrait');
    expect(portrait.orientationAngle).toBeNull();
  });

  it('detects retina and formats labels/metrics', () => {
    expect(isRetinaDisplay(1)).toBe(false);
    expect(isRetinaDisplay(2)).toBe(true);
    expect(formatOrientationLabel('portrait')).toBe('Portrait');
    expect(formatAspectRatio(16 / 9)).toBe('1.78');

    const text = formatScreenMetricsText(readScreenInfo(metricsSource()));
    expect(text).toContain('Viewport: 1280 × 720 px');
    expect(text).toContain('Device pixel ratio: 1x');
    expect(text).toContain('Orientation: landscape');
  });

  it('resolves contextual suggestions by viewport and DPR', () => {
    expect(resolveScreenSuggestion(createEmptyScreenInfo())).toBeNull();

    expect(
      resolveScreenSuggestion(readScreenInfo(metricsSource({ innerWidth: 390, innerHeight: 844 })))
        ?.path
    ).toBe('/dev-design-tools/responsive-breakpoint-tester');

    expect(
      resolveScreenSuggestion(readScreenInfo(metricsSource({ innerWidth: 900, innerHeight: 700 })))
        ?.path
    ).toBe('/dev-design-tools/viewport-size-detector');

    expect(
      resolveScreenSuggestion(
        readScreenInfo(metricsSource({ devicePixelRatio: 3, innerWidth: 1440, innerHeight: 900 }))
      )?.id
    ).toBe('high-dpr');

    expect(
      resolveScreenSuggestion(
        readScreenInfo(
          metricsSource({
            innerWidth: 1440,
            innerHeight: 900,
            devicePixelRatio: 1,
            screen: {
              width: 1440,
              height: 900,
              orientation: { type: 'landscape-primary', angle: 0 }
            }
          })
        )
      )?.path
    ).toBe('/browser-utils/device-orientation-logger');
  });
});
