import type { BuToolSuggestion } from '../shared/bu-tool-suggestion.model';
import {
  SPEED_TEST_MAX_RUNS,
  SPEED_TEST_MIN_RUNS,
  SPEED_TEST_RESULT_LIMIT
} from '../constants/network-speed-test.constants';
import type { SpeedTestFormValues, SpeedTestResult } from '../types/network-speed-test.types';

export function validateSpeedTestConfig(values: SpeedTestFormValues): string | null {
  if (!values.url.trim()) {
    return 'Enter a URL to download from.';
  }
  if (values.sizeBytes <= 0) {
    return 'Expected size must be greater than 0 bytes.';
  }
  if (values.runs < SPEED_TEST_MIN_RUNS || values.runs > SPEED_TEST_MAX_RUNS) {
    return 'Runs must be between 1 and 5.';
  }
  return null;
}

export function calculateMbps(bytes: number, durationMs: number): number {
  return durationMs > 0 ? (bytes * 8) / (durationMs / 1000) / 1_000_000 : 0;
}

export function formatSpeedMbps(mbps: number): string {
  return `${mbps.toFixed(2)} Mbps`;
}

export function formatSpeedDurationMs(ms: number): string {
  return `${ms.toFixed(0)} ms`;
}

export function formatSpeedTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function formatSpeedBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes.toFixed(0)} B`;
}

export function formatSpeedTestResultLine(result: SpeedTestResult): string {
  const parts = [
    formatSpeedMbps(result.mbps),
    formatSpeedDurationMs(result.durationMs),
    formatSpeedBytes(result.bytes),
    result.url,
    formatSpeedTimestamp(result.timestamp)
  ];
  if (result.error) {
    parts.push(`Error: ${result.error}`);
  }
  return parts.join(' · ');
}

export function formatAllSpeedTestResults(results: SpeedTestResult[]): string {
  return results.map((result) => formatSpeedTestResultLine(result)).join('\n');
}

export function averageMbps(results: SpeedTestResult[]): number {
  if (!results.length) return 0;
  const sum = results.reduce((acc, result) => acc + result.mbps, 0);
  return sum / results.length;
}

export function mergeSpeedTestResults(
  newResults: SpeedTestResult[],
  existingResults: SpeedTestResult[],
  limit = SPEED_TEST_RESULT_LIMIT
): SpeedTestResult[] {
  if (!newResults.length) {
    return existingResults;
  }
  return [...newResults, ...existingResults].slice(0, limit);
}

export function looksLikeCorsFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('cors') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('blocked by')
  );
}

export async function measureDownloadSpeed(
  url: string,
  expectedSizeBytes: number,
  fetchImpl: typeof fetch = fetch,
  now: () => number = () => performance.now()
): Promise<SpeedTestResult> {
  const start = now();
  let bytesDownloaded = 0;
  let error: string | undefined;

  try {
    const response = await fetchImpl(url, { cache: 'no-store' });
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body not readable.');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesDownloaded += value?.length ?? 0;
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Unknown error during download.';
  }

  const durationMs = now() - start;
  const usedBytes = bytesDownloaded || expectedSizeBytes;
  const mbps = calculateMbps(usedBytes, durationMs);

  return {
    url,
    bytes: usedBytes,
    durationMs,
    mbps,
    timestamp: Date.now(),
    ...(error ? { error } : {})
  };
}

export function resolveSpeedTestSuggestion(
  isRunning: boolean,
  results: SpeedTestResult[],
  latestError: string | null
): BuToolSuggestion | null {
  if (looksLikeCorsFailure(latestError)) {
    return {
      id: 'cors-blocked',
      title: 'Download looks blocked by CORS',
      reason:
        'The browser may be rejecting a cross-origin response. Verify the URL with CORS Test Tool, then retry with a CORS-enabled file.',
      actionLabel: 'Open CORS Test Tool',
      path: '/dev-design-tools/cors-test-tool'
    };
  }

  if (!isRunning && results.length === 0) {
    return {
      id: 'check-battery-first',
      title: 'Check battery before long runs',
      reason:
        'Repeated multi-megabyte downloads drain power on mobile. Confirm battery health first, then run 1–5 timed fetches.',
      actionLabel: 'Open Battery Status Viewer',
      path: '/browser-utils/battery-status-viewer'
    };
  }

  if (results.some((result) => !result.error)) {
    return {
      id: 'pair-screen-info',
      title: 'Capture device context',
      reason:
        'You have speed samples. Add screen resolution details so QA notes include both network and display context.',
      actionLabel: 'Open Screen Resolution Info',
      path: '/browser-utils/screen-resolution-info'
    };
  }

  return {
    id: 'confirm-client',
    title: 'Confirm the client environment',
    reason:
      'If results look unexpected, parse the user agent to verify browser and platform before comparing runs.',
    actionLabel: 'Open User Agent Parser',
    path: '/testing-tools/user-agent-parser'
  };
}
