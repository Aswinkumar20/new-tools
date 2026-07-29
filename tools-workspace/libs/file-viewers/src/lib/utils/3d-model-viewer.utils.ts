import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  MODEL_3D_CAPABILITY_TAGS,
  MODEL_3D_PLANNED_FORMATS
} from '../constants/3d-model-viewer.constants';
import type { Model3dPlannedFormat } from '../types/3d-model-viewer.types';

export function formatPlannedFormatsLabel(
  formats: ReadonlyArray<Model3dPlannedFormat> = MODEL_3D_PLANNED_FORMATS
): string {
  return formats.map((format) => format.label).join(', ');
}

export function formatCapabilityLine(
  formats: ReadonlyArray<Model3dPlannedFormat> = MODEL_3D_PLANNED_FORMATS,
  tags: ReadonlyArray<string> = MODEL_3D_CAPABILITY_TAGS
): string {
  return `${formatPlannedFormatsLabel(formats)} · ${tags.join(' · ')}`;
}

export function plannedFormatCount(
  formats: ReadonlyArray<Model3dPlannedFormat> = MODEL_3D_PLANNED_FORMATS
): string {
  return `${formats.length}+`;
}

export function resolveModel3dSuggestion(): FvToolSuggestion {
  return {
    id: 'm3d-textures',
    title: 'Preview texture maps while you wait?',
    reason:
      'GLTF/GLB packs often include PNG or JPEG textures. Inspect them in Image Viewer until interactive 3D orbit lands.',
    actionLabel: 'Open Image Viewer',
    path: '/file-viewers/image-viewer'
  };
}
