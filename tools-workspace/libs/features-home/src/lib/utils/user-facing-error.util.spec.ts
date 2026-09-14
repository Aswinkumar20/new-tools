import {
  extractErrorMessage,
  isTechnicalApiErrorMessage,
  toUserFacingError,
} from './user-facing-error.util';

describe('user-facing-error.util', () => {
  it('flags technical API messages', () => {
    expect(isTechnicalApiErrorMessage('Tool API unreachable. Start services/tool-api on port 8080.')).toBe(true);
    expect(isTechnicalApiErrorMessage('PDF API error (500)')).toBe(true);
    expect(isTechnicalApiErrorMessage('SERVICE_UNAVAILABLE')).toBe(true);
    expect(isTechnicalApiErrorMessage('Internal Error')).toBe(true);
    expect(isTechnicalApiErrorMessage('Request processing failed')).toBe(true);
  });

  it('keeps useful validation details', () => {
    expect(isTechnicalApiErrorMessage('Select at least one page')).toBe(false);
    expect(isTechnicalApiErrorMessage('FBX requires conversion first. Export as GLB, STL, or OBJ and retry.')).toBe(
      false
    );
    expect(isTechnicalApiErrorMessage('File is too large to process')).toBe(false);
  });

  it('maps technical errors to action fallback', () => {
    expect(toUserFacingError(new Error('SERVICE_ERROR'), 'Could not merge the PDFs')).toBe(
      'Could not merge the PDFs'
    );
    expect(toUserFacingError(new Error('Select at least one page'), 'Could not process the PDF')).toBe(
      'Select at least one page'
    );
    expect(toUserFacingError(null, 'Could not load the model')).toBe('Could not load the model');
  });

  it('extracts Error messages', () => {
    expect(extractErrorMessage(new Error('hello'))).toBe('hello');
    expect(extractErrorMessage('plain')).toBe('plain');
  });
});
