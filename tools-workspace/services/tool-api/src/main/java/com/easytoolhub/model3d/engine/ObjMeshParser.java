package com.easytoolhub.model3d.engine;

import com.easytoolhub.model3d.domain.TriangleMesh;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class ObjMeshParser {
  private static final int MAX_TRIANGLES = 2_000_000;

  private ObjMeshParser() {}

  public static TriangleMesh parse(byte[] data) {
    if (data == null || data.length == 0) {
      throw new IllegalArgumentException("OBJ file is empty");
    }
    String text = new String(data, StandardCharsets.UTF_8);
    String[] lines = text.split("\\R");

    List<float[]> verts = new ArrayList<>();
    List<Float> positions = new ArrayList<>();
    List<Integer> indices = new ArrayList<>();
    float minX = Float.POSITIVE_INFINITY, minY = Float.POSITIVE_INFINITY, minZ = Float.POSITIVE_INFINITY;
    float maxX = Float.NEGATIVE_INFINITY, maxY = Float.NEGATIVE_INFINITY, maxZ = Float.NEGATIVE_INFINITY;

    for (String raw : lines) {
      String line = raw.trim();
      if (line.isEmpty() || line.startsWith("#")) continue;
      String lower = line.toLowerCase(Locale.ROOT);
      if (lower.startsWith("v ")) {
        String[] parts = line.split("\\s+");
        if (parts.length < 4) continue;
        float x = Float.parseFloat(parts[1]);
        float y = Float.parseFloat(parts[2]);
        float z = Float.parseFloat(parts[3]);
        verts.add(new float[] {x, y, z});
        minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
      } else if (lower.startsWith("f ")) {
        String[] parts = line.split("\\s+");
        if (parts.length < 4) continue;
        List<Integer> face = new ArrayList<>(parts.length - 1);
        for (int i = 1; i < parts.length; i++) {
          String token = parts[i];
          String idxPart = token.split("/")[0];
          if (idxPart.isBlank()) continue;
          int vi = Integer.parseInt(idxPart);
          if (vi < 0) vi = verts.size() + vi + 1;
          if (vi < 1 || vi > verts.size()) {
            throw new IllegalArgumentException("OBJ face references missing vertex " + vi);
          }
          face.add(vi - 1);
        }
        if (face.size() < 3) continue;
        for (int t = 1; t < face.size() - 1; t++) {
          addVertex(positions, indices, verts.get(face.get(0)));
          addVertex(positions, indices, verts.get(face.get(t)));
          addVertex(positions, indices, verts.get(face.get(t + 1)));
          if (indices.size() / 3 > MAX_TRIANGLES) {
            throw new IllegalArgumentException("OBJ exceeds " + MAX_TRIANGLES + " triangle limit");
          }
        }
      }
    }

    if (indices.isEmpty()) {
      throw new IllegalArgumentException("OBJ has no triangulated faces");
    }

    float[] pos = toFloatArray(positions);
    float[] normals = computeFlatNormals(pos, toIntArray(indices));
    return new TriangleMesh(
        pos,
        normals,
        toIntArray(indices),
        new float[] {minX, minY, minZ},
        new float[] {maxX, maxY, maxZ}
    );
  }

  private static void addVertex(List<Float> positions, List<Integer> indices, float[] v) {
    int index = positions.size() / 3;
    positions.add(v[0]);
    positions.add(v[1]);
    positions.add(v[2]);
    indices.add(index);
  }

  private static float[] computeFlatNormals(float[] positions, int[] indices) {
    float[] normals = new float[positions.length];
    for (int i = 0; i < indices.length; i += 3) {
      int ia = indices[i] * 3;
      int ib = indices[i + 1] * 3;
      int ic = indices[i + 2] * 3;
      float ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
      float bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
      float cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];
      float ux = bx - ax, uy = by - ay, uz = bz - az;
      float vx = cx - ax, vy = cy - ay, vz = cz - az;
      float nx = uy * vz - uz * vy;
      float ny = uz * vx - ux * vz;
      float nz = ux * vy - uy * vx;
      float len = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 1e-8f) {
        nx /= len; ny /= len; nz /= len;
      } else {
        nx = 0; ny = 0; nz = 1;
      }
      for (int k = 0; k < 3; k++) {
        int vi = indices[i + k] * 3;
        normals[vi] = nx;
        normals[vi + 1] = ny;
        normals[vi + 2] = nz;
      }
    }
    return normals;
  }

  private static float[] toFloatArray(List<Float> list) {
    float[] out = new float[list.size()];
    for (int i = 0; i < list.size(); i++) out[i] = list.get(i);
    return out;
  }

  private static int[] toIntArray(List<Integer> list) {
    int[] out = new int[list.size()];
    for (int i = 0; i < list.size(); i++) out[i] = list.get(i);
    return out;
  }
}
