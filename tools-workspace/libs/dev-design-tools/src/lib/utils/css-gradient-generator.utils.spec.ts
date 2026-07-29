import {
  buildGradientCss,
  buildGradientResult,
  buildPresetPreview,
  capitalizeGradientType,
  formatRelativeTimestamp,
  hexToRgb,
  interpolateColor,
  prependGradientHistory,
  resolveCssGradientSuggestion,
  resolveGradientStyle,
  validateGradientColorStops
} from './css-gradient-generator.utils';
import type { GradientHistoryEntry, GradientResult } from '../types/css-gradient-generator.types';
import { CSS_GRADIENT_FALLBACK_STYLE, CSS_GRADIENT_PRESETS } from '../constants/css-gradient-generator.constants';

describe('css-gradient-generator utils', () => {
  it('builds linear, radial, and conic CSS', () => {
    const stops = [
      { color: '#007bff', position: 0 },
      { color: '#0056b3', position: 100 }
    ];
    expect(buildGradientCss('linear', stops, { angle: 135, position: 'center', shape: 'ellipse', size: 'farthest-corner' })).toBe(
      'linear-gradient(135deg, #007bff 0%, #0056b3 100%)'
    );
    expect(buildGradientCss('radial', stops, { angle: 0, position: 'center', shape: 'circle', size: 'farthest-corner' })).toContain(
      'radial-gradient(circle farthest-corner at center'
    );
    expect(buildGradientCss('conic', stops, { angle: 0, position: 'center', shape: 'ellipse', size: '' })).toContain(
      'conic-gradient(from 0deg at center'
    );
  });

  it('validates stops and preserves invalid-hex vs too-few semantics', () => {
    expect(validateGradientColorStops([{ color: '#000', position: 0 }])).toBe('Add at least two color stops.');
    expect(
      validateGradientColorStops([
        { color: 'red', position: 0 },
        { color: '#0056b3', position: 100 }
      ])
    ).toContain('valid hex');
  });

  it('returns gradient results and keeps fallback style', () => {
    const ok = buildGradientResult({
      type: 'linear',
      angle: 135,
      position: 'center',
      shape: 'ellipse',
      size: 'farthest-corner',
      colorStops: [
        { color: '#007bff', position: 0 },
        { color: '#0056b3', position: 100 }
      ]
    });
    expect('css' in ok && ok.css).toContain('linear-gradient(135deg');
    expect(resolveGradientStyle(null)).toBe(CSS_GRADIENT_FALLBACK_STYLE);
  });

  it('interpolates hex colors and builds preset previews', () => {
    expect(hexToRgb('#007bff')).toEqual({ r: 0, g: 123, b: 255 });
    expect(interpolateColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    const radial = CSS_GRADIENT_PRESETS.find((preset) => preset.label === 'Radial blue');
    expect(radial && buildPresetPreview(radial)).toContain('radial-gradient');
    expect(capitalizeGradientType('linear')).toBe('Linear');
  });

  it('formats timestamps and prepends unique history', () => {
    const now = Date.now();
    expect(formatRelativeTimestamp(now - 5_000, now)).toBe('Just now');
    const entry: GradientHistoryEntry = {
      timestamp: 1,
      css: 'linear-gradient(90deg, #000 0%, #fff 100%)',
      type: 'linear',
      angle: 90,
      position: 'center',
      shape: 'ellipse',
      size: 'farthest-corner',
      colors: []
    };
    expect(prependGradientHistory([entry], entry)).toHaveLength(1);
    expect(prependGradientHistory([], { ...entry, css: 'other' })).toHaveLength(1);
  });

  it('resolves contextual suggestions', () => {
    const linear: GradientResult = {
      css: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
      type: 'linear',
      colors: [
        { color: '#007bff', position: 0 },
        { color: '#0056b3', position: 100 }
      ]
    };
    expect(resolveCssGradientSuggestion({ result: linear, hasCopiedCss: false, stopCount: 2 })).toBeNull();
    expect(resolveCssGradientSuggestion({ result: linear, hasCopiedCss: true, stopCount: 2 })?.id).toBe(
      'cgg-copied-shadow'
    );
    expect(
      resolveCssGradientSuggestion({
        result: { ...linear, type: 'radial' },
        hasCopiedCss: false,
        stopCount: 2
      })?.id
    ).toBe('cgg-radius');
  });
});
