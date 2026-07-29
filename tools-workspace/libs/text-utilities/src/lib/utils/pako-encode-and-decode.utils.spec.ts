import { pakoCompress, pakoDecompress } from '../shared/pako-compression.utils';
import {
  clampPakoCompressionLevel,
  convertPakoText,
  inputLooksLikePakoEncoded,
  pakoFormatLabel,
  resolvePakoSuggestion
} from './pako-encode-and-decode.utils';

describe('pako-encode-and-decode.utils', () => {
  it('clamps compression level to 0–9', () => {
    expect(clampPakoCompressionLevel(-1)).toBe(0);
    expect(clampPakoCompressionLevel(12)).toBe(9);
    expect(clampPakoCompressionLevel(4.6)).toBe(5);
  });

  it('labels formats', () => {
    expect(pakoFormatLabel('deflate')).toBe('Deflate');
    expect(pakoFormatLabel('deflateRaw')).toBe('Raw');
    expect(pakoFormatLabel('gzip')).toBe('Gzip');
  });

  it('compresses and decompresses via convertPakoText', () => {
    const sample = 'hello world '.repeat(20);
    const compressed = convertPakoText({
      mode: 'encode',
      inputText: sample,
      compressionFormat: 'deflate',
      binaryEncoding: 'base64',
      compressionLevel: 6
    });
    expect(compressed.errorMessage).toBe('');
    expect(compressed.output).toBe(
      pakoCompress(sample, 'deflate', 'base64', 6).output
    );
    expect(compressed.outputBytes).toBeLessThan(compressed.inputBytes);

    const decompressed = convertPakoText({
      mode: 'decode',
      inputText: compressed.output,
      compressionFormat: 'deflate',
      binaryEncoding: 'base64',
      compressionLevel: 6
    });
    expect(decompressed.output).toBe(sample);
    expect(decompressed.output).toBe(pakoDecompress(compressed.output, 'deflate', 'base64'));
  });

  it('reports decompress failures', () => {
    const result = convertPakoText({
      mode: 'decode',
      inputText: 'not-valid-base64!!!',
      compressionFormat: 'gzip',
      binaryEncoding: 'base64',
      compressionLevel: 6
    });
    expect(result.output).toBe('');
    expect(result.errorMessage.length).toBeGreaterThan(0);
  });

  it('detects encoded-looking input', () => {
    expect(inputLooksLikePakoEncoded('SGVsbG8gV29ybGQ=', 'base64')).toBe(true);
    expect(inputLooksLikePakoEncoded('68 65 6c 6c 6f', 'hex')).toBe(true);
    expect(inputLooksLikePakoEncoded('plain text here', 'base64')).toBe(false);
  });

  it('resolves contextual suggestions', () => {
    expect(
      resolvePakoSuggestion({
        mode: 'encode',
        hasInput: false,
        hasOutput: false,
        errorMessage: '',
        binaryEncoding: 'base64',
        compressionRatio: 0,
        inputLooksEncoded: false
      })?.id
    ).toBe('pako-get-started');

    expect(
      resolvePakoSuggestion({
        mode: 'decode',
        hasInput: true,
        hasOutput: false,
        errorMessage: 'Failed to decompress. Check format (gzip) and base64 input.',
        binaryEncoding: 'base64',
        compressionRatio: 0,
        inputLooksEncoded: true
      })?.id
    ).toBe('pako-error');

    expect(
      resolvePakoSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        binaryEncoding: 'base64',
        compressionRatio: 40,
        inputLooksEncoded: true
      })?.id
    ).toBe('pako-looks-encoded');

    expect(
      resolvePakoSuggestion({
        mode: 'encode',
        hasInput: true,
        hasOutput: true,
        errorMessage: '',
        binaryEncoding: 'base64',
        compressionRatio: 55.5,
        inputLooksEncoded: false
      })?.id
    ).toBe('pako-compressed');
  });
});
