import {
  computeFitToWidthZoom,
  createPdfFileRecord,
  formatPdfFileSize,
  isPdfFile,
  isPdfPasswordError,
  resolvePdfSuggestion,
  stepPdfZoom,
  validatePdfFiles
} from './pdf-viewer.utils';

describe('pdf-viewer.utils', () => {
  it('validates PDF files', () => {
    expect(isPdfFile({ name: 'doc.pdf', type: '' })).toBe(true);
    expect(isPdfFile({ name: 'x.bin', type: 'application/pdf' })).toBe(true);
    expect(isPdfFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);

    const { validFiles, errors } = validatePdfFiles([
      new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }),
      new File(['x'], 'b.txt', { type: 'text/plain' })
    ]);
    expect(validFiles).toHaveLength(1);
    expect(errors.some((e) => e.includes('Not a PDF'))).toBe(true);
  });

  it('rejects oversized PDFs with original message', () => {
    const huge = new File([new ArrayBuffer(1)], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(huge, 'size', { value: 101 * 1024 * 1024 });
    const { errors } = validatePdfFiles([huge]);
    expect(errors[0]).toContain('max 100MB');
  });

  it('formats sizes and zooms', () => {
    expect(formatPdfFileSize(0)).toBe('0 Bytes');
    expect(formatPdfFileSize(2048)).toContain('KB');
    expect(stepPdfZoom(100, 1)).toBe(125);
    expect(stepPdfZoom(50, -1)).toBe(50);
    expect(stepPdfZoom(300, 1)).toBe(300);
    expect(computeFitToWidthZoom(200, 400)).toBe(200);
  });

  it('creates file records and detects password errors', () => {
    const record = createPdfFileRecord(new File(['x'], 'a.pdf'), 'blob:x');
    expect(record.name).toBe('a.pdf');
    expect(record.pdfDoc).toBeNull();
    expect(record.needsPassword).toBe(false);

    expect(
      isPdfPasswordError(new Error('Password required'), {
        PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 }
      })
    ).toBe(true);
    expect(
      isPdfPasswordError(new Error('Corrupt'), {
        PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 }
      })
    ).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolvePdfSuggestion({
        hasFiles: false,
        hasError: false,
        pdfCount: 0,
        currentSize: 0,
        totalPages: 0,
        needsPassword: false
      })?.id
    ).toBe('pv-compress');

    expect(
      resolvePdfSuggestion({
        hasFiles: true,
        hasError: true,
        pdfCount: 1,
        currentSize: 100,
        totalPages: 2,
        needsPassword: false
      })?.id
    ).toBe('pv-meta');

    expect(
      resolvePdfSuggestion({
        hasFiles: true,
        hasError: false,
        pdfCount: 3,
        currentSize: 100,
        totalPages: 2,
        needsPassword: false
      })?.id
    ).toBe('pv-merge');

    expect(
      resolvePdfSuggestion({
        hasFiles: true,
        hasError: false,
        pdfCount: 1,
        currentSize: 12 * 1024 * 1024,
        totalPages: 2,
        needsPassword: false
      })?.id
    ).toBe('pv-compress-large');

    expect(
      resolvePdfSuggestion({
        hasFiles: true,
        hasError: false,
        pdfCount: 1,
        currentSize: 100,
        totalPages: 40,
        needsPassword: false
      })?.id
    ).toBe('pv-split');
  });
});
