import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';
import type { Model3dPlannedFormat, Model3dRoadmapItem } from '../types/3d-model-viewer.types';

export const MODEL_3D_STATUS_LABEL = 'Soon';
export const MODEL_3D_PROCESSING_LABEL = 'Local';
export const MODEL_3D_MODELS_PLACEHOLDER = '—';

export const MODEL_3D_PLANNED_FORMATS: ReadonlyArray<Model3dPlannedFormat> = [
  { extension: 'gltf', label: 'GLTF' },
  { extension: 'glb', label: 'GLB' },
  { extension: 'obj', label: 'OBJ' },
  { extension: 'stl', label: 'STL' },
  { extension: 'fbx', label: 'FBX' }
];

export const MODEL_3D_ROADMAP_HINT =
  'Drag-and-drop uploads, validation, and metadata extraction are on the roadmap.';

export const MODEL_3D_ROADMAP_ITEMS: ReadonlyArray<Model3dRoadmapItem> = [
  {
    id: 'formats',
    text: 'Initial support for GLTF/GLB, OBJ, STL, and FBX models.'
  },
  {
    id: 'lighting',
    text: 'Environment maps and HDR lighting presets.'
  },
  {
    id: 'inspect',
    text: 'Section cutting, measurements, and annotations.'
  }
];

export const MODEL_3D_CAPABILITY_TAGS: ReadonlyArray<string> = [
  'orbit controls',
  'local processing'
];

export const MODEL_3D_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Image Viewer',
    path: '/file-viewers/image-viewer',
    description: 'Inspect PNG/JPEG texture maps that ship with GLTF packs'
  },
  {
    label: 'Archive Viewer',
    path: '/file-viewers/archive-viewer',
    description: 'Browse ZIP/7z model kits before extracting assets locally'
  },
  {
    label: 'File Metadata Viewer',
    path: '/code-file-tools/file-metadata-viewer',
    description: 'Read size, MIME, and timestamps for model files on disk'
  }
];
