import {
  detectPresentationType,
  ensureReadableTextColor,
  formatPowerpointFileSize,
  getPresentationTypeLabel,
  getSlidePreviewLabel,
  resolvePowerpointSuggestion,
  stepPowerpointZoom,
  validatePresentationFiles
} from './powerpoint-viewer.utils';
import { PresentationType } from '../types/powerpoint-viewer.types';
import type { PptxSlide } from '../types/powerpoint-viewer.types';

describe('powerpoint-viewer.utils', () => {
  it('detects and validates PPTX files', () => {
    expect(detectPresentationType(new File(['x'], 'deck.pptx'))).toBe(PresentationType.PPTX);
    expect(detectPresentationType(new File(['x'], 'notes.txt'))).toBe(PresentationType.UNSUPPORTED);

    const { validFiles, errors } = validatePresentationFiles([
      new File(['x'], 'a.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }),
      new File(['x'], 'b.txt', { type: 'text/plain' })
    ]);
    expect(validFiles).toHaveLength(1);
    expect(errors.some((e) => e.includes('Unsupported'))).toBe(true);
  });

  it('formats sizes and zooms', () => {
    expect(formatPowerpointFileSize(0)).toBe('0 Bytes');
    expect(formatPowerpointFileSize(2048)).toContain('KB');
    expect(stepPowerpointZoom(100, 1)).toBe(125);
    expect(stepPowerpointZoom(50, -1)).toBe(50);
    expect(stepPowerpointZoom(300, 1)).toBe(300);
  });

  it('labels presentation types and slides', () => {
    expect(getPresentationTypeLabel(PresentationType.PPTX)).toBe('PPTX');
    expect(getPresentationTypeLabel(PresentationType.UNSUPPORTED)).toBe('Unknown');

    const slide: PptxSlide = {
      id: 1,
      background: '#fff',
      elements: [{ type: 'text', content: 'Hello world from slide', x: 0, y: 0, width: 10, height: 10 }]
    };
    expect(getSlidePreviewLabel(slide, 0)).toContain('Hello');
    expect(getSlidePreviewLabel({ id: 2, elements: [], parseError: 'bad' }, 1)).toBe('Parse error');
  });

  it('ensures readable text color on light backgrounds', () => {
    expect(ensureReadableTextColor('#ffffff', '#ffffff')).toBe('#1e293b');
    expect(ensureReadableTextColor('#111111', '#ffffff')).toBe('#111111');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolvePowerpointSuggestion({
        hasFiles: false,
        hasError: false,
        slideCount: 0,
        currentSize: 0,
        hasParseWarnings: false
      })?.id
    ).toBe('pp-pdf');

    expect(
      resolvePowerpointSuggestion({
        hasFiles: true,
        hasError: true,
        slideCount: 1,
        currentSize: 100,
        hasParseWarnings: false
      })?.id
    ).toBe('pp-meta');

    expect(
      resolvePowerpointSuggestion({
        hasFiles: true,
        hasError: false,
        slideCount: 5,
        currentSize: 100,
        hasParseWarnings: true
      })?.id
    ).toBe('pp-image');
  });
});
