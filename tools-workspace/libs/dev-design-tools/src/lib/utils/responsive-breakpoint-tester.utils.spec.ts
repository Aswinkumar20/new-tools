import {
  buildGridMarks,
  findActiveBreakpoint,
  formatAspectRatio,
  formatBreakpointName,
  formatDimensionsText,
  getBreakpointColor,
  isOpenEndedBreakpoint,
  isValidHttpUrl,
  resolveResponsiveSuggestion,
  rotateViewport
} from './responsive-breakpoint-tester.utils';
import { RESPONSIVE_URL_PATTERN } from '../constants/responsive-breakpoint-tester.constants';

describe('responsive-breakpoint-tester utils', () => {
  it('validates http(s) URLs', () => {
    expect(isValidHttpUrl('https://example.com')).toBe(true);
    expect(isValidHttpUrl('ftp://x')).toBe(false);
    expect(RESPONSIVE_URL_PATTERN.test('https://a.test')).toBe(true);
  });

  it('resolves active breakpoints and open-ended labels', () => {
    expect(findActiveBreakpoint(400).name).toBe('Mobile');
    expect(findActiveBreakpoint(900).name).toBe('Tablet');
    expect(findActiveBreakpoint(1200).name).toBe('Desktop');
    expect(findActiveBreakpoint(1600).name).toBe('Large Desktop');
    expect(isOpenEndedBreakpoint(findActiveBreakpoint(2000))).toBe(true);
    expect(formatBreakpointName(findActiveBreakpoint(400))).toContain('0-767');
    expect(formatBreakpointName(findActiveBreakpoint(2000))).toContain('1440+');
  });

  it('maps breakpoint colors, grid marks, aspect, and rotate', () => {
    expect(getBreakpointColor(findActiveBreakpoint(400))).toBe('#007bff');
    expect(buildGridMarks(160, 50)).toEqual([50, 100, 150]);
    expect(formatAspectRatio(1280, 720)).toBe('1.78');
    expect(formatDimensionsText({ width: 375, height: 667 })).toBe('375x667');
    expect(rotateViewport({ width: 375, height: 667 })).toEqual({ width: 667, height: 375 });
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveResponsiveSuggestion({
        width: 375,
        height: 667,
        hasLoadedPreview: false,
        hasCopiedDimensions: false,
        hasUrlError: false
      })?.id
    ).toBe('rbt-viewport');

    expect(
      resolveResponsiveSuggestion({
        width: 1280,
        height: 720,
        hasLoadedPreview: false,
        hasCopiedDimensions: true,
        hasUrlError: false
      })?.id
    ).toBe('rbt-pixel-rem');

    expect(
      resolveResponsiveSuggestion({
        width: 3840,
        height: 2160,
        hasLoadedPreview: true,
        hasCopiedDimensions: false,
        hasUrlError: false
      })?.id
    ).toBe('rbt-screen');

    expect(
      resolveResponsiveSuggestion({
        width: 800,
        height: 1024,
        hasLoadedPreview: true,
        hasCopiedDimensions: false,
        hasUrlError: false
      })?.id
    ).toBe('rbt-orientation');
  });
});
