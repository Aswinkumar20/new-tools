import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';
import type { Model3dPlannedFormat, Model3dRoadmapItem } from '../types/3d-model-viewer.types';

export const MODEL_3D_ACCEPT_ATTR =
  '.glb,.gltf,.stl,.obj,.fbx,model/gltf-binary,model/gltf+json,model/stl,text/plain,application/octet-stream';

export const MODEL_3D_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const MODEL_3D_SUPPORTED_FORMATS: ReadonlyArray<Model3dPlannedFormat> = [
  { extension: 'glb', label: 'GLB' },
  { extension: 'gltf', label: 'GLTF' },
  { extension: 'stl', label: 'STL' },
  { extension: 'obj', label: 'OBJ' },
  { extension: 'fbx', label: 'FBX*' }
];

export const MODEL_3D_MODEL_VIEWER_SRC =
  'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';

export const MODEL_3D_ROADMAP_HINT =
  'Server-side normalize converts STL/OBJ/embedded GLTF to GLB. FBX needs a prior export to GLB/STL/OBJ.';

export const MODEL_3D_ROADMAP_ITEMS: ReadonlyArray<Model3dRoadmapItem> = [
  {
    id: 'formats',
    text: 'Live: GLB, embedded GLTF, STL, and OBJ via tool-api normalize → interactive orbit viewer.'
  },
  {
    id: 'lighting',
    text: 'Environment lighting and auto-rotate are available in the viewer toolbar.'
  },
  {
    id: 'inspect',
    text: 'Next: section cuts, measurements, and FBX conversion.'
  }
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
    description: 'Browse ZIP model kits before uploading meshes'
  },
  {
    label: 'STEP Viewer',
    path: '/cad-viewers/step-viewer',
    description: 'Inspect CAD STEP dumps (wireframe) for engineering files'
  }
];
