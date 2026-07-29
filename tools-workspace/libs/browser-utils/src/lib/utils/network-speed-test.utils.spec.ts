import {
  SPEED_TEST_RESULT_LIMIT
} from '../constants/network-speed-test.constants';
import {
  averageMbps,
  calculateMbps,
  formatAllSpeedTestResults,
  formatSpeedBytes,
  formatSpeedMbps,
  looksLikeCorsFailure,
  measureDownloadSpeed,
  mergeSpeedTestResults,
  resolveSpeedTestSuggestion,
  validateSpeedTestConfig
} from './network-speed-test.utils';
import type { SpeedTestResult } from '../types/network-speed-test.types';

describe('network-speed-test.utils', () => {
  it('validates configuration', () => {
    expect(
      validateSpeedTestConfig({ url: '', sizeBytes: 1000, runs: 1 })
    ).toBe('Enter a URL to download from.');
    expect(
      validateSpeedTestConfig({ url: 'https://x', sizeBytes: 0, runs: 1 })
    ).toBe('Expected size must be greater than 0 bytes.');
    expect(
      validateSpeedTestConfig({ url: 'https://x', sizeBytes: 1000, runs: 6 })
    ).toBe('Runs must be between 1 and 5.');
    expect(
      validateSpeedTestConfig({ url: 'https://x', sizeBytes: 1000, runs: 2 })
    ).toBeNull();
  });

  it('calculates and formats speed metrics', () => {
    expect(calculateMbps(1_000_000, 1000)).toBeCloseTo(8);
    expect(formatSpeedMbps(12.345)).toBe('12.35 Mbps');
    expect(formatSpeedBytes(2048)).toBe('2.00 KB');
    expect(formatSpeedBytes(2_097_152)).toBe('2.00 MB');
    expect(averageMbps([])).toBe(0);
    expect(
      averageMbps([
        { url: 'a', bytes: 1, durationMs: 1, mbps: 10, timestamp: 1 },
        { url: 'b', bytes: 1, durationMs: 1, mbps: 20, timestamp: 2 }
      ])
    ).toBe(15);
  });

  it('merges and formats results', () => {
    const existing: SpeedTestResult[] = Array.from({ length: SPEED_TEST_RESULT_LIMIT }, (_, i) => ({
      url: `u${i}`,
      bytes: 1,
      durationMs: 1,
      mbps: i,
      timestamp: i
    }));
    const next = mergeSpeedTestResults(
      [{ url: 'new', bytes: 2, durationMs: 2, mbps: 99, timestamp: 999 }],
      existing
    );
    expect(next).toHaveLength(SPEED_TEST_RESULT_LIMIT);
    expect(next[0].url).toBe('new');

    const line = formatAllSpeedTestResults([
      {
        url: 'https://example.com/file.bin',
        bytes: 1024,
        durationMs: 250,
        mbps: 1.5,
        timestamp: 1_700_000_000_000,
        error: 'boom'
      }
    ]);
    expect(line).toContain('1.50 Mbps');
    expect(line).toContain('Error: boom');
  });

  it('detects cors-like failures', () => {
    expect(looksLikeCorsFailure('Failed to fetch')).toBe(true);
    expect(looksLikeCorsFailure('CORS blocked')).toBe(true);
    expect(looksLikeCorsFailure('timeout')).toBe(false);
  });

  it('measures download speed with an injectable fetch', async () => {
    const chunks = [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6])];
    let index = 0;
    const fetchImpl = jest.fn().mockResolvedValue({
      body: {
        getReader: () => ({
          read: async () => {
            if (index >= chunks.length) {
              return { done: true, value: undefined };
            }
            const value = chunks[index++];
            return { done: false, value };
          }
        })
      }
    });

    let clock = 0;
    const result = await measureDownloadSpeed(
      'https://example.com/file.bin',
      1000,
      fetchImpl as unknown as typeof fetch,
      () => {
        clock += 500;
        return clock;
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/file.bin', { cache: 'no-store' });
    expect(result.bytes).toBe(6);
    expect(result.error).toBeUndefined();
    expect(result.mbps).toBeGreaterThan(0);
  });

  it('resolves contextual suggestions', () => {
    expect(resolveSpeedTestSuggestion(false, [], 'Failed to fetch')?.path).toBe(
      '/dev-design-tools/cors-test-tool'
    );
    expect(resolveSpeedTestSuggestion(false, [], null)?.path).toBe(
      '/browser-utils/battery-status-viewer'
    );
    expect(
      resolveSpeedTestSuggestion(
        false,
        [{ url: 'u', bytes: 1, durationMs: 1, mbps: 5, timestamp: 1 }],
        null
      )?.path
    ).toBe('/browser-utils/screen-resolution-info');
  });
});
