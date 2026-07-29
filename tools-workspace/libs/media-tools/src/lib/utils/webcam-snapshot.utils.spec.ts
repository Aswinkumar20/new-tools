import {
  buildWebcamSnapshotFileName,
  getWebcamSnapshotCountdownOptionCount,
  getWebcamSnapshotExportFormatCount,
  getWebcamSnapshotExportFormatsSummary,
  isSecureContextForCamera,
  mapCameraAccessError,
  resolveWebcamSnapshotSuggestion
} from './webcam-snapshot.utils';

describe('webcam-snapshot.utils', () => {
  it('summarizes planned exports and countdown options', () => {
    expect(getWebcamSnapshotExportFormatCount()).toBe(2);
    expect(getWebcamSnapshotCountdownOptionCount()).toBe(4);
    expect(getWebcamSnapshotExportFormatsSummary()).toContain('PNG');
    expect(getWebcamSnapshotExportFormatsSummary()).toContain('JPG');
    expect(buildWebcamSnapshotFileName(42)).toBe('snapshot-42.png');
  });

  it('maps camera errors and secure-context checks', () => {
    const denied = new Error('denied');
    denied.name = 'NotAllowedError';
    expect(mapCameraAccessError(denied)).toContain('permission');

    const missing = new Error('missing');
    missing.name = 'NotFoundError';
    expect(mapCameraAccessError(missing)).toContain('camera');

    expect(isSecureContextForCamera(true)).toBe(true);
    expect(isSecureContextForCamera(false)).toBe(false);
  });

  it('resolves coming-soon suggestion to image viewer', () => {
    expect(resolveWebcamSnapshotSuggestion({ isComingSoon: true })?.id).toBe('ws-image-viewer');
    expect(resolveWebcamSnapshotSuggestion({ isComingSoon: false })?.id).toBe('ws-meta');
  });
});
