import { parsePeBinary } from './pe-binary-viewer.utils';

describe('pe-binary-viewer.utils', () => {
  it('rejects non-PE buffers', () => {
    const buffer = new ArrayBuffer(128);
    expect(() => parsePeBinary(buffer)).toThrow(/MZ header/i);
  });
});
