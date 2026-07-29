import type { MtToolSuggestion } from '../shared/mt-tool-suggestion.model';
import {
  WEBCAM_SNAPSHOT_COUNTDOWN_OPTIONS,
  WEBCAM_SNAPSHOT_EXPORT_FORMATS
} from '../constants/webcam-snapshot.constants';
import type {
  WebcamSnapshotCountdownOption,
  WebcamSnapshotExportFormat
} from '../types/webcam-snapshot.types';

export function getWebcamSnapshotExportFormatCount(
  formats: ReadonlyArray<WebcamSnapshotExportFormat> = WEBCAM_SNAPSHOT_EXPORT_FORMATS
): number {
  return formats.length;
}

export function getWebcamSnapshotCountdownOptionCount(
  options: ReadonlyArray<WebcamSnapshotCountdownOption> = WEBCAM_SNAPSHOT_COUNTDOWN_OPTIONS
): number {
  return options.length;
}

export function getWebcamSnapshotExportFormatsSummary(
  formats: ReadonlyArray<WebcamSnapshotExportFormat> = WEBCAM_SNAPSHOT_EXPORT_FORMATS
): string {
  return formats.map((f) => f.label).join(', ');
}

export function buildWebcamSnapshotFileName(
  timestamp: number,
  format: Pick<WebcamSnapshotExportFormat, 'extension'> = WEBCAM_SNAPSHOT_EXPORT_FORMATS[0]
): string {
  return `snapshot-${timestamp}${format.extension}`;
}

export function isSecureContextForCamera(
  isSecureContext: boolean = typeof globalThis !== 'undefined'
    ? globalThis.isSecureContext
    : false
): boolean {
  return isSecureContext;
}

export function mapCameraAccessError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Failed to access the camera.';
  }

  const name = error.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Allow access in the browser address bar, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found. Connect a webcam and try again.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is busy or unreadable. Close other apps using it, then retry.';
  }
  if (name === 'SecurityError' || name === 'NotSupportedError') {
    return 'Camera access requires a secure context (HTTPS or localhost).';
  }

  return error.message || 'Failed to access the camera.';
}

/**
 * Ready for when capture lands — mirrors other media tools' canvas export helpers.
 * Not wired to UI while the tool is coming soon.
 */
export function canvasToSnapshotBlob(
  canvas: HTMLCanvasElement,
  format: WebcamSnapshotExportFormat = WEBCAM_SNAPSHOT_EXPORT_FORMATS[0],
  jpegQuality = 0.92
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (format.mimeType === 'image/jpeg') {
      canvas.toBlob((blob) => resolve(blob), format.mimeType, jpegQuality);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), format.mimeType);
  });
}

export function resolveWebcamSnapshotSuggestion(options: {
  isComingSoon: boolean;
}): MtToolSuggestion | null {
  if (options.isComingSoon) {
    return {
      id: 'ws-image-viewer',
      title: 'Need to inspect photos now?',
      reason:
        'Webcam Snapshot is launching soon. Use Image Viewer for stills you already have, or Voice Recorder for a matching audio note.',
      actionLabel: 'Open Image Viewer',
      path: '/file-viewers/image-viewer'
    };
  }

  return {
    id: 'ws-meta',
    title: 'Inspect snapshot metadata?',
    reason: 'Confirm MIME type and dimensions before sharing exported captures.',
    actionLabel: 'Open File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer'
  };
}
