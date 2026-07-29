import {
  formatCapabilityLine,
  formatPlannedFormatsLabel,
  plannedFormatCount,
  resolveModel3dSuggestion
} from './3d-model-viewer.utils';
import { MODEL_3D_PLANNED_FORMATS } from '../constants/3d-model-viewer.constants';

describe('3d-model-viewer utils', () => {
  it('formats planned format labels and counts', () => {
    expect(formatPlannedFormatsLabel()).toBe('GLTF, GLB, OBJ, STL, FBX');
    expect(plannedFormatCount()).toBe('5+');
    expect(plannedFormatCount(MODEL_3D_PLANNED_FORMATS.slice(0, 2))).toBe('2+');
  });

  it('builds the capability line shown in the empty state', () => {
    expect(formatCapabilityLine()).toContain('GLTF, GLB, OBJ, STL, FBX');
    expect(formatCapabilityLine()).toContain('orbit controls');
    expect(formatCapabilityLine()).toContain('local processing');
  });

  it('resolves a texture-preview suggestion while the viewer is coming soon', () => {
    const suggestion = resolveModel3dSuggestion();
    expect(suggestion.id).toBe('m3d-textures');
    expect(suggestion.path).toBe('/file-viewers/image-viewer');
  });
});
