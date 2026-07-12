import { pakoCompress, pakoDecompress } from './pako-compression.utils';

describe('pako-compression.utils', () => {
  const sample = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

  it.each(['deflate', 'deflateRaw', 'gzip'] as const)('round-trips %s with base64', (format) => {
    const { output } = pakoCompress(sample, format, 'base64', 6);
    expect(pakoDecompress(output, format, 'base64')).toBe(sample);
  });

  it('round-trips deflate with hex', () => {
    const { output } = pakoCompress(sample, 'deflate', 'hex', 9);
    expect(pakoDecompress(output, 'deflate', 'hex')).toBe(sample);
  });

  it('reports compression ratio', () => {
    const repeated = 'abc'.repeat(200);
    const result = pakoCompress(repeated, 'deflate', 'base64', 9);
    expect(result.ratio).toBeGreaterThan(0);
    expect(result.outputBytes).toBeLessThan(result.inputBytes);
  });
});
