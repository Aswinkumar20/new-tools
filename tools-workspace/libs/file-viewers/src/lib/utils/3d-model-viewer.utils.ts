import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  MODEL_3D_MAX_FILE_SIZE_BYTES,
  MODEL_3D_MODEL_VIEWER_SRC,
  MODEL_3D_SUPPORTED_FORMATS
} from '../constants/3d-model-viewer.constants';
import type { Model3dPlannedFormat } from '../types/3d-model-viewer.types';

const EXT_RE = /\.(glb|gltf|stl|obj|fbx)$/i;

export function formatSupportedFormatsLabel(
  formats: ReadonlyArray<Model3dPlannedFormat> = MODEL_3D_SUPPORTED_FORMATS
): string {
  return formats.map((f) => f.label).join(', ');
}

export function supportedFormatCount(
  formats: ReadonlyArray<Model3dPlannedFormat> = MODEL_3D_SUPPORTED_FORMATS
): string {
  return String(formats.filter((f) => !f.label.endsWith('*')).length);
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

export function formatNumber(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString();
}

export function detectModelExtension(fileName: string): string | null {
  const m = fileName.toLowerCase().match(EXT_RE);
  return m ? m[1] : null;
}

export function validateModel3dFile(file: File): string | null {
  if (!file) return 'Choose a 3D model file';
  if (file.size <= 0) return 'File is empty';
  if (file.size > MODEL_3D_MAX_FILE_SIZE_BYTES) return 'File exceeds 50 MB limit';
  const ext = detectModelExtension(file.name);
  if (!ext) return 'Unsupported type. Use GLB, GLTF, STL, or OBJ.';
  return null;
}

export function resolveModel3dSuggestion(
  hasModel: boolean,
  apiReachable: boolean | null
): FvToolSuggestion | null {
  if (apiReachable === false) {
    return {
      id: 'm3d-api',
      title: 'Processing is temporarily unavailable',
      reason: 'Try again in a moment. Your model is processed securely and not stored.',
      actionLabel: 'Related: Archive Viewer',
      path: '/file-viewers/archive-viewer'
    };
  }
  if (!hasModel) {
    return {
      id: 'm3d-upload',
      title: 'Drop a mesh to begin',
      reason: 'GLB validates on the server; STL/OBJ are normalized to GLB for orbit viewing.',
      actionLabel: 'Open Image Viewer',
      path: '/file-viewers/image-viewer'
    };
  }
  return null;
}

let modelViewerLoading: Promise<void> | null = null;

/** Loads Google model-viewer once (CDN module script). */
export function ensureModelViewerDefined(): Promise<void> {
  if (typeof customElements === 'undefined') {
    return Promise.resolve();
  }
  if (customElements.get('model-viewer')) {
    return Promise.resolve();
  }
  if (modelViewerLoading) return modelViewerLoading;

  modelViewerLoading = new Promise<void>((resolve, reject) => {
    // Jest / non-browser: skip CDN load
    if (typeof document === 'undefined' || !document.head) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-m3d-model-viewer]');
    if (existing) {
      customElements
        .whenDefined('model-viewer')
        .then(() => resolve())
        .catch(reject);
      // Avoid hanging tests if the CDN never defines the element
      setTimeout(() => resolve(), 50);
      return;
    }
    const script = document.createElement('script');
    script.type = 'module';
    script.src = MODEL_3D_MODEL_VIEWER_SRC;
    script.dataset['m3dModelViewer'] = '1';
    script.onload = () => {
      const timeout = setTimeout(() => resolve(), 1500);
      customElements
        .whenDefined('model-viewer')
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    };
    script.onerror = () => reject(new Error('Failed to load model-viewer'));
    document.head.appendChild(script);
  }).catch((err) => {
    modelViewerLoading = null;
    throw err;
  });

  return modelViewerLoading;
}
