import {
  effectiveResolution,
  findActiveBreakpoint,
  formatBreakpointName,
  formatOrientationLabel,
  formatRelativeTimestamp,
  formatViewportMetricsText,
  hasVisualViewportShrink,
  isOpenEndedBreakpoint,
  prependViewportHistory,
  readViewportInfo,
  resolveViewportOrientation,
  resolveViewportSuggestion
} from './viewport-size-detector.utils';
import type { ViewportHistoryEntry, ViewportInfo } from '../types/viewport-size-detector.types';

function sampleInfo(overrides: Partial<ViewportInfo> = {}): ViewportInfo {
  return {
    viewportWidth: 1280,
    viewportHeight: 720,
    screenWidth: 1920,
    screenHeight: 1080,
    devicePixelRatio: 1,
    orientation: 'landscape',
    aspectRatio: 1280 / 720,
    timestamp: 1,
    ...overrides
  };
}

describe('viewport-size-detector utils', () => {
  it('reads viewport info from a window-like object', () => {
    const info = readViewportInfo({
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 3,
      screen: { width: 390, height: 844 },
      visualViewport: { width: 390, height: 600 }
    });
    expect(info.viewportWidth).toBe(390);
    expect(info.orientation).toBe('portrait');
    expect(info.visualViewportHeight).toBe(600);
    expect(effectiveResolution(info)).toEqual({ width: 1170, height: 2532 });
  });

  it('resolves orientation and breakpoint labels', () => {
    expect(resolveViewportOrientation(100, 100)).toBe('square');
    expect(formatOrientationLabel('portrait')).toBe('Portrait');
    expect(findActiveBreakpoint(500).name).toBe('Mobile');
    expect(isOpenEndedBreakpoint(findActiveBreakpoint(2000))).toBe(true);
    expect(formatBreakpointName(findActiveBreakpoint(1200))).toContain('1024-1439');
  });

  it('formats metrics and relative timestamps', () => {
    const text = formatViewportMetricsText(sampleInfo(), findActiveBreakpoint(1280));
    expect(text).toContain('Viewport: 1280 × 720 px');
    expect(text).toContain('Breakpoint:');
    expect(formatRelativeTimestamp(Date.now() - 10_000)).toBe('Just now');
  });

  it('prepends unique history within tolerance', () => {
    const entry: ViewportHistoryEntry = {
      timestamp: 1,
      width: 800,
      height: 600,
      aspectRatio: 800 / 600
    };
    expect(prependViewportHistory([], entry)).toHaveLength(1);
    expect(
      prependViewportHistory([entry], { ...entry, timestamp: 2, width: 800.4, height: 600.2 })
    ).toHaveLength(1);
    expect(
      prependViewportHistory([entry], { ...entry, timestamp: 3, width: 900, height: 600 })
    ).toHaveLength(2);
  });

  it('detects visual viewport shrink and suggestions', () => {
    expect(
      hasVisualViewportShrink(
        sampleInfo({
          viewportWidth: 390,
          viewportHeight: 844,
          visualViewportWidth: 390,
          visualViewportHeight: 500
        })
      )
    ).toBe(true);

    expect(
      resolveViewportSuggestion({
        info: sampleInfo({ viewportWidth: 375, viewportHeight: 667, orientation: 'portrait' }),
        hasCopiedMetrics: false
      })?.id
    ).toBe('vsd-mobile');

    expect(
      resolveViewportSuggestion({
        info: sampleInfo(),
        hasCopiedMetrics: true
      })?.id
    ).toBe('vsd-simulate');

    expect(
      resolveViewportSuggestion({
        info: sampleInfo({ devicePixelRatio: 3 }),
        hasCopiedMetrics: false
      })?.id
    ).toBe('vsd-dpr');
  });
});
