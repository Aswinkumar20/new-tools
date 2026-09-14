package com.easytoolhub.model3d.engine;

import com.easytoolhub.model3d.domain.TriangleMesh;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class StlMeshParser {
  private static final int MAX_TRIANGLES = 2_000_000;

  private StlMeshParser() {}

  public static TriangleMesh parse(byte[] data) {
    if (data == null || data.length < 15) {
      throw new IllegalArgumentException("STL file is empty or too small");
    }
    String head = new String(data, 0, Math.min(80, data.length), StandardCharsets.US_ASCII)
        .toLowerCase(Locale.ROOT);
    if (head.startsWith("solid") && !isBinaryLength(data)) {
      return parseAscii(data);
    }
    return parseBinary(data);
  }

  private static boolean isBinaryLength(byte[] data) {
    if (data.length < 84) return false;
    int triangles = leInt(data, 80);
    if (triangles <= 0 || triangles > MAX_TRIANGLES) return false;
    return 84L + 50L * triangles == data.length;
  }

  private static TriangleMesh parseBinary(byte[] data) {
    if (data.length < 84) {
      throw new IllegalArgumentException("Invalid binary STL header");
    }
    int triangles = leInt(data, 80);
    if (triangles <= 0) {
      throw new IllegalArgumentException("Binary STL has no triangles");
    }
    if (triangles > MAX_TRIANGLES) {
      throw new IllegalArgumentException("STL exceeds " + MAX_TRIANGLES + " triangle limit");
    }
    long expected = 84L + 50L * triangles;
    if (data.length < expected) {
      throw new IllegalArgumentException("Binary STL is truncated");
    }

    float[] positions = new float[triangles * 9];
    float[] normals = new float[triangles * 9];
    int[] indices = new int[triangles * 3];
    float minX = Float.POSITIVE_INFINITY, minY = Float.POSITIVE_INFINITY, minZ = Float.POSITIVE_INFINITY;
    float maxX = Float.NEGATIVE_INFINITY, maxY = Float.NEGATIVE_INFINITY, maxZ = Float.NEGATIVE_INFINITY;

    ByteBuffer buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
    buf.position(84);
    int p = 0;
    int i = 0;
    for (int t = 0; t < triangles; t++) {
      float nx = buf.getFloat();
      float ny = buf.getFloat();
      float nz = buf.getFloat();
      for (int v = 0; v < 3; v++) {
        float x = buf.getFloat();
        float y = buf.getFloat();
        float z = buf.getFloat();
        positions[p] = x;
        positions[p + 1] = y;
        positions[p + 2] = z;
        normals[p] = nx;
        normals[p + 1] = ny;
        normals[p + 2] = nz;
        indices[i++] = p / 3;
        minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
        p += 3;
      }
      buf.getShort(); // attribute byte count
    }
    return new TriangleMesh(
        positions,
        normals,
        indices,
        new float[] {minX, minY, minZ},
        new float[] {maxX, maxY, maxZ}
    );
  }

  private static TriangleMesh parseAscii(byte[] data) {
    String text = new String(data, StandardCharsets.US_ASCII);
    String[] lines = text.split("\\R");
    List<Float> pos = new ArrayList<>();
    List<Float> nrm = new ArrayList<>();
    List<Integer> idx = new ArrayList<>();
    float nx = 0, ny = 0, nz = 1;
    float minX = Float.POSITIVE_INFINITY, minY = Float.POSITIVE_INFINITY, minZ = Float.POSITIVE_INFINITY;
    float maxX = Float.NEGATIVE_INFINITY, maxY = Float.NEGATIVE_INFINITY, maxZ = Float.NEGATIVE_INFINITY;
    int vertexInFacet = 0;

    for (String raw : lines) {
      String line = raw.trim().toLowerCase(Locale.ROOT);
      if (line.startsWith("facet normal")) {
        String[] parts = line.split("\\s+");
        if (parts.length >= 5) {
          nx = Float.parseFloat(parts[2]);
          ny = Float.parseFloat(parts[3]);
          nz = Float.parseFloat(parts[4]);
        }
        vertexInFacet = 0;
      } else if (line.startsWith("vertex")) {
        String[] parts = line.split("\\s+");
        if (parts.length < 4) continue;
        float x = Float.parseFloat(parts[1]);
        float y = Float.parseFloat(parts[2]);
        float z = Float.parseFloat(parts[3]);
        int vi = pos.size() / 3;
        pos.add(x); pos.add(y); pos.add(z);
        nrm.add(nx); nrm.add(ny); nrm.add(nz);
        idx.add(vi);
        vertexInFacet++;
        if (idx.size() / 3 > MAX_TRIANGLES) {
          throw new IllegalArgumentException("STL exceeds " + MAX_TRIANGLES + " triangle limit");
        }
        minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
      } else if (line.startsWith("endfacet") && vertexInFacet != 3) {
        throw new IllegalArgumentException("ASCII STL facet must have exactly 3 vertices");
      }
    }
    if (idx.isEmpty()) {
      throw new IllegalArgumentException("ASCII STL has no triangles");
    }
    return new TriangleMesh(
        toFloatArray(pos),
        toFloatArray(nrm),
        toIntArray(idx),
        new float[] {minX, minY, minZ},
        new float[] {maxX, maxY, maxZ}
    );
  }

  private static int leInt(byte[] data, int offset) {
    return (data[offset] & 0xff)
        | ((data[offset + 1] & 0xff) << 8)
        | ((data[offset + 2] & 0xff) << 16)
        | ((data[offset + 3] & 0xff) << 24);
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
