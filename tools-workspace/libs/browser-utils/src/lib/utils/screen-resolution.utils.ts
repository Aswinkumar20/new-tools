import type { BuToolSuggestion } from '../shared/bu-tool-suggestion.model';
import {
  SCREEN_MOBILE_VIEWPORT_MAX,
  SCREEN_TABLET_VIEWPORT_MAX
} from '../constants/screen-resolution.constants';
import type {
  ScreenInfo,
  ScreenMetricsSource,
  ScreenOrientationType
} from '../types/screen-resolution.types';

export function createEmptyScreenInfo(): ScreenInfo {
  return {
    viewportWidth: 0,
    viewportHeight: 0,
    screenWidth: 0,
    screenHeight: 0,
    devicePixelRatio: 1,
    colorDepth: null,
    orientationType: 'unknown',
    orientationAngle: null,
    aspectRatio: 0
  };
}

export function readScreenInfo(source: ScreenMetricsSource): ScreenInfo {
  const viewportWidth = source.innerWidth;
  const viewportHeight = source.innerHeight;
  const screenWidth = source.screen.width;
  const screenHeight = source.screen.height;
  const devicePixelRatio = source.devicePixelRatio || 1;
  const colorDepth = source.screen.colorDepth || null;
  const orientation = (source.screen.orientation ||
    source.screen.mozOrientation ||
    source.screen.msOrientation) as
    | { type?: string; angle?: number }
    | string
    | undefined;

  let orientationType: ScreenOrientationType = 'unknown';
  let orientationAngle: number | null = null;

  if (orientation && typeof orientation === 'object' && 'type' in orientation && orientation.type) {
    const type = orientation.type;
    orientationType = type.includes('landscape')
      ? 'landscape'
      : type.includes('portrait')
        ? 'portrait'
        : 'unknown';
    orientationAngle = orientation.angle ?? null;
  } else {
    orientationType = viewportWidth >= viewportHeight ? 'landscape' : 'portrait';
  }

  const aspectRatio = viewportHeight ? viewportWidth / viewportHeight : 0;

  return {
    viewportWidth,
    viewportHeight,
    screenWidth,
    screenHeight,
    devicePixelRatio,
    colorDepth,
    orientationType,
    orientationAngle,
    aspectRatio
  };
}

export function isRetinaDisplay(devicePixelRatio: number): boolean {
  return (devicePixelRatio ?? 1) > 1;
}

/** Matches Angular TitleCasePipe for single-word orientation labels. */
export function formatOrientationLabel(orientationType: ScreenOrientationType): string {
  if (!orientationType) {
    return '';
  }
  return orientationType.charAt(0).toUpperCase() + orientationType.slice(1);
}

/** Matches Angular DecimalPipe with digitsInfo `1.2-2`. */
export function formatAspectRatio(aspectRatio: number): string {
  return aspectRatio.toFixed(2);
}

export function formatScreenMetricsText(info: ScreenInfo): string {
  return [
    `Viewport: ${info.viewportWidth} × ${info.viewportHeight} px`,
    `Screen: ${info.screenWidth} × ${info.screenHeight} px`,
    `Aspect ratio: ${formatAspectRatio(info.aspectRatio)}:1`,
    `Device pixel ratio: ${info.devicePixelRatio}x`,
    `Color depth: ${info.colorDepth ?? 'N/A'}-bit`,
    `Orientation: ${info.orientationType}`,
    `Orientation angle: ${info.orientationAngle ?? 0}°`
  ].join('\n');
}

export function resolveScreenSuggestion(info: ScreenInfo): BuToolSuggestion | null {
  if (info.viewportWidth <= 0) {
    return null;
  }

  if (info.viewportWidth <= SCREEN_MOBILE_VIEWPORT_MAX) {
    return {
      id: 'mobile-breakpoints',
      title: 'Mobile viewport detected',
      reason:
        'You’re under typical phone breakpoints. Validate layouts next with the Responsive Breakpoint Tester.',
      actionLabel: 'Open Breakpoint Tester',
      path: '/dev-design-tools/responsive-breakpoint-tester'
    };
  }

  if (info.viewportWidth <= SCREEN_TABLET_VIEWPORT_MAX) {
    return {
      id: 'tablet-viewport',
      title: 'Tablet-width viewport',
      reason:
        'Mid-size viewports hide many responsive bugs. Cross-check live media queries next.',
      actionLabel: 'Open Viewport Size Detector',
      path: '/dev-design-tools/viewport-size-detector'
    };
  }

  if (info.devicePixelRatio > 2) {
    return {
      id: 'high-dpr',
      title: 'High-DPI display',
      reason:
        'DPR above 2x affects image sharpness and CSS pixels. Pair with viewport checks for asset QA.',
      actionLabel: 'Open Viewport Size Detector',
      path: '/dev-design-tools/viewport-size-detector'
    };
  }

  if (info.orientationType === 'landscape') {
    return {
      id: 'landscape-orientation',
      title: 'Landscape orientation',
      reason:
        'Capture device motion alongside screen metrics for a fuller mobile debug profile.',
      actionLabel: 'Open Orientation Logger',
      path: '/browser-utils/device-orientation-logger'
    };
  }

  return {
    id: 'pair-viewport',
    title: 'Continue with viewport checks',
    reason:
      'Screen metrics alone miss media-query state. Use Viewport Size Detector for live CSS environment checks.',
    actionLabel: 'Open Viewport Size Detector',
    path: '/dev-design-tools/viewport-size-detector'
  };
}
