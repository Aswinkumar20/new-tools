import type { BuToolSuggestion } from '../shared/bu-tool-suggestion.model';
import { ORIENTATION_SAMPLE_LIMIT } from '../constants/device-orientation.constants';
import type {
  DeviceOrientationEventConstructor,
  DeviceOrientationPermissionResult,
  OrientationSample
} from '../types/device-orientation.types';

export function isDeviceOrientationSupported(isBrowser: boolean): boolean {
  return isBrowser && typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

export function createOrientationSample(event: {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute?: boolean;
  timestamp?: number;
}): OrientationSample {
  return {
    alpha: event.alpha ?? null,
    beta: event.beta ?? null,
    gamma: event.gamma ?? null,
    absolute: event.absolute ?? false,
    timestamp: event.timestamp ?? Date.now()
  };
}

export function prependOrientationSample(
  samples: OrientationSample[],
  sample: OrientationSample,
  limit = ORIENTATION_SAMPLE_LIMIT
): OrientationSample[] {
  return [sample, ...samples].slice(0, limit);
}

export function formatOrientationAngle(value: number | null): string {
  return value !== null ? `${value.toFixed(1)}°` : 'N/A';
}

export function formatOrientationTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function formatOrientationSample(sample: OrientationSample): string {
  return `[${formatOrientationTimestamp(sample.timestamp)}] α=${formatOrientationAngle(sample.alpha)} β=${formatOrientationAngle(sample.beta)} γ=${formatOrientationAngle(sample.gamma)} (${sample.absolute ? 'absolute' : 'relative'})`;
}

export function formatAllOrientationSamples(samples: OrientationSample[]): string {
  return samples.map((sample) => formatOrientationSample(sample)).join('\n');
}

export function getOrientationPermissionRequest(
  eventConstructor: DeviceOrientationEventConstructor | undefined
): (() => Promise<DeviceOrientationPermissionResult>) | null {
  if (!eventConstructor || typeof eventConstructor.requestPermission !== 'function') {
    return null;
  }
  return () => eventConstructor.requestPermission!();
}

export function resolveOrientationSuggestion(
  isSupported: boolean,
  isListening: boolean,
  sampleCount: number
): BuToolSuggestion | null {
  if (!isSupported) {
    return {
      id: 'unsupported-orientation',
      title: 'Orientation API not available here',
      reason:
        'Desktop browsers often lack motion sensors. Parse this client’s user agent, then retry on a phone or tablet.',
      actionLabel: 'Open User Agent Parser',
      path: '/testing-tools/user-agent-parser'
    };
  }

  if (!isListening && sampleCount === 0) {
    return {
      id: 'start-device-qa',
      title: 'Ready for a device QA pass',
      reason:
        'Start logging orientation, then capture battery and screen metrics for a complete mobile profile.',
      actionLabel: 'Open Battery Status Viewer',
      path: '/browser-utils/battery-status-viewer'
    };
  }

  if (isListening && sampleCount > 0) {
    return {
      id: 'pair-viewport',
      title: 'Pair with viewport checks',
      reason:
        'You have live motion samples. Capture viewport size next to correlate tilt with responsive layout changes.',
      actionLabel: 'Open Viewport Size Detector',
      path: '/dev-design-tools/viewport-size-detector'
    };
  }

  return {
    id: 'pair-screen-info',
    title: 'Continue device inspection',
    reason:
      'Orientation alone is incomplete. Add screen resolution and DPR details for fuller debugging notes.',
    actionLabel: 'Open Screen Resolution Info',
    path: '/browser-utils/screen-resolution-info'
  };
}
