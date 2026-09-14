export interface Model3dPlannedFormat {
  extension: string;
  label: string;
}

export interface Model3dRoadmapItem {
  id: string;
  text: string;
}

export interface Model3dInspectResult {
  format: string;
  fileName: string;
  byteSize: number;
  vertexCount?: number;
  triangleCount?: number;
  hasNormals?: boolean;
  boundsMin?: number[];
  boundsMax?: number[];
  notes?: string;
  normalizedFormat?: string;
}

export interface Model3dLoadedModel {
  sourceName: string;
  sourceSize: number;
  glbBlob: Blob;
  objectUrl: string;
  meta: Model3dInspectResult;
}
