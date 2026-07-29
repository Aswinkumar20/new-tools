import {
  buildPaletteColorInfos,
  buildPaletteCssExport,
  buildPaletteCssFilename,
  collectQuantizedColors,
  createPaletteHistoryEntry,
  extractPaletteFromImageData,
  filterColorsByMethod,
  prependPaletteHistory,
  resolvePaletteMethodLabel,
  resolvePaletteSuggestion,
  validatePaletteFile
} from './palette-generator.utils';

function makeImageData(width: number, height: number, rgba: number[]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

describe('palette-generator.utils', () => {
  it('validates image files and size', () => {
    expect(validatePaletteFile(new File(['x'], 'a.txt', { type: 'text/plain' })).errors).toEqual([
      'Please select a valid image file.'
    ]);

    const oversized = validatePaletteFile({
      type: 'image/png',
      size: 26 * 1024 * 1024,
      name: 'big.png'
    } as File);
    expect(oversized.isOversized).toBe(true);
  });

  it('quantizes, filters, and builds palette infos', () => {
    const imageData = makeImageData(4, 4, [255, 0, 0, 255]);
    const quantized = collectQuantizedColors(imageData);
    expect(quantized[0].r).toBe(250);
    expect(filterColorsByMethod(quantized, 'vibrant').length).toBeGreaterThan(0);

    const colors = extractPaletteFromImageData(imageData, 3, 'dominant');
    expect(colors[0].hex).toBe('#FA0000');
    expect(buildPaletteColorInfos(quantized, 1)[0].percentage).toBe(100);
  });

  it('builds CSS export and history with dedupe', () => {
    expect(resolvePaletteMethodLabel('muted')).toBe('Muted colors');
    expect(buildPaletteCssFilename('photo.PNG')).toBe('photo.css');

    const colors = [
      {
        hex: '#FA0000',
        rgb: { r: 250, g: 0, b: 0 },
        hsl: { h: 0, s: 100, l: 49 },
        percentage: 100
      }
    ];
    expect(buildPaletteCssExport(colors)).toContain('--color-1: #FA0000');

    const entry = createPaletteHistoryEntry(
      {
        colors,
        previewUrl: 'blob:x' as never,
        filename: 'a.png',
        method: 'Dominant colors',
        colorCount: 1
      },
      () => 1
    );
    expect(prependPaletteHistory([entry], entry)).toHaveLength(1);
  });

  it('resolves suggestions', () => {
    expect(
      resolvePaletteSuggestion({
        hasFile: false,
        hasResult: false,
        hasError: true,
        isOversizedHint: true,
        colorCount: 0,
        method: 'dominant'
      })?.id
    ).toBe('pg-oversized');

    expect(
      resolvePaletteSuggestion({
        hasFile: true,
        hasResult: true,
        hasError: false,
        isOversizedHint: false,
        colorCount: 5,
        method: 'vibrant'
      })?.id
    ).toBe('pg-gradient');
  });
});
