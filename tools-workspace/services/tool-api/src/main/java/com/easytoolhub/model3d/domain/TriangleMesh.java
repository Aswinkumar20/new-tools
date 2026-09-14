package com.easytoolhub.model3d.domain;

/**
 * Triangle mesh used for normalize → GLB conversion.
 * Positions are xyz interleaved; normals optional; indices optional (non-indexed when null).
 */
public record TriangleMesh(
    float[] positions,
    float[] normals,
    int[] indices,
    float[] boundsMin,
    float[] boundsMax
) {
  public int vertexCount() {
    return positions == null ? 0 : positions.length / 3;
  }

  public int triangleCount() {
    if (indices != null && indices.length > 0) {
      return indices.length / 3;
    }
    return vertexCount() / 3;
  }

  public boolean hasNormals() {
    return normals != null && normals.length == positions.length;
  }
}
