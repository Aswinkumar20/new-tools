import { formatElfSize } from './elf-binary-viewer.utils';

describe('elf-binary-viewer.utils', () => {
  it('formats sizes', () => {
    expect(formatElfSize(0)).toBe('0 B');
    expect(formatElfSize(2048)).toContain('KB');
  });
});
