import {
  convertRtfToHtml,
  detectDocumentType,
  extractRtfText,
  formatWordFileSize,
  getDocumentTypeLabel,
  resolveWordSuggestion,
  stepWordZoom,
  validateWordFiles
} from './word-viewer.utils';
import { DocumentType } from '../types/word-viewer.types';

describe('word-viewer.utils', () => {
  it('detects document types', () => {
    expect(detectDocumentType(new File(['x'], 'a.docx'))).toBe(DocumentType.DOCX);
    expect(detectDocumentType(new File(['x'], 'a.doc'))).toBe(DocumentType.DOC);
    expect(detectDocumentType(new File(['x'], 'a.rtf'))).toBe(DocumentType.RTF);
    expect(detectDocumentType(new File(['x'], 'a.txt'))).toBe(DocumentType.TXT);
    expect(detectDocumentType(new File(['x'], 'a.png'))).toBe(DocumentType.UNSUPPORTED);
  });

  it('validates files with original messages', () => {
    const { validFiles, errors } = validateWordFiles([
      new File(['x'], 'a.docx'),
      new File(['x'], 'b.png')
    ]);
    expect(validFiles).toHaveLength(1);
    expect(errors[0]).toContain('Unsupported');

    const huge = new File([new ArrayBuffer(1)], 'big.docx');
    Object.defineProperty(huge, 'size', { value: 51 * 1024 * 1024 });
    expect(validateWordFiles([huge]).errors[0]).toContain('max 50MB');
  });

  it('formats sizes and zooms', () => {
    expect(formatWordFileSize(0)).toBe('0 Bytes');
    expect(formatWordFileSize(2048)).toContain('KB');
    expect(stepWordZoom(100, 1)).toBe(125);
    expect(stepWordZoom(50, -1)).toBe(50);
    expect(stepWordZoom(200, 1)).toBe(200);
  });

  it('converts basic RTF and labels types', () => {
    const rtf = '{\\rtf1\\ansi Hello\\par World}';
    expect(convertRtfToHtml(rtf)).toContain('rtf-content');
    expect(extractRtfText(rtf)).toContain('Hello');
    expect(getDocumentTypeLabel(DocumentType.DOCX)).toBe('DOCX');
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolveWordSuggestion({
        hasFiles: false,
        hasError: false,
        documentType: null,
        textLength: 0
      })?.id
    ).toBe('wv-pdf');

    expect(
      resolveWordSuggestion({
        hasFiles: true,
        hasError: false,
        documentType: DocumentType.DOC,
        textLength: 10
      })?.id
    ).toBe('wv-convert');

    expect(
      resolveWordSuggestion({
        hasFiles: true,
        hasError: true,
        documentType: DocumentType.DOCX,
        textLength: 10
      })?.id
    ).toBe('wv-meta');
  });
});
