package com.easytoolhub.model3d.engine;

import com.easytoolhub.model3d.domain.TriangleMesh;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Writes a minimal single-mesh GLB (glTF 2.0 binary) suitable for model-viewer / three.js.
 */
public final class GlbWriter {
  private GlbWriter() {}

  public static byte[] write(TriangleMesh mesh) {
    if (mesh == null || mesh.positions() == null || mesh.positions().length < 9) {
      throw new IllegalArgumentException("Mesh has no geometry to export");
    }
    boolean indexed = mesh.indices() != null && mesh.indices().length >= 3;
    boolean hasNormals = mesh.hasNormals();

    byte[] positionBytes = floatsToBytes(mesh.positions());
    byte[] normalBytes = hasNormals ? floatsToBytes(mesh.normals()) : new byte[0];
    byte[] indexBytes = indexed ? intsToBytes(mesh.indices()) : new byte[0];

    int posOffset = 0;
    int nrmOffset = align4(positionBytes.length);
    int idxOffset = align4(nrmOffset + normalBytes.length);
    int binLength = indexed
        ? align4(idxOffset + indexBytes.length)
        : align4(nrmOffset + normalBytes.length);

    ByteBuffer bin = ByteBuffer.allocate(binLength).order(ByteOrder.LITTLE_ENDIAN);
    bin.position(posOffset);
    bin.put(positionBytes);
    if (hasNormals) {
      bin.position(nrmOffset);
      bin.put(normalBytes);
    }
    if (indexed) {
      bin.position(idxOffset);
      bin.put(indexBytes);
    }

    float[] min = mesh.boundsMin();
    float[] max = mesh.boundsMax();

    StringBuilder json = new StringBuilder(512);
    json.append("{\"asset\":{\"version\":\"2.0\",\"generator\":\"easytoolhub-model3d\"},");
    json.append("\"scenes\":[{\"nodes\":[0]}],\"scene\":0,");
    json.append("\"nodes\":[{\"mesh\":0}],");
    json.append("\"meshes\":[{\"primitives\":[{\"attributes\":{\"POSITION\":0");
    if (hasNormals) json.append(",\"NORMAL\":1");
    json.append('}');
    if (indexed) json.append(",\"indices\":").append(hasNormals ? 2 : 1);
    json.append(",\"mode\":4}]}],");
    json.append("\"accessors\":[");
    // POSITION
    json.append("{\"bufferView\":0,\"componentType\":5126,\"count\":")
        .append(mesh.vertexCount())
        .append(",\"type\":\"VEC3\",\"min\":[")
        .append(min[0]).append(',').append(min[1]).append(',').append(min[2])
        .append("],\"max\":[")
        .append(max[0]).append(',').append(max[1]).append(',').append(max[2])
        .append("]}");
    if (hasNormals) {
      json.append(",{\"bufferView\":1,\"componentType\":5126,\"count\":")
          .append(mesh.vertexCount())
          .append(",\"type\":\"VEC3\"}");
    }
    if (indexed) {
      json.append(",{\"bufferView\":").append(hasNormals ? 2 : 1)
          .append(",\"componentType\":5125,\"count\":")
          .append(mesh.indices().length)
          .append(",\"type\":\"SCALAR\"}");
    }
    json.append("],\"bufferViews\":[");
    json.append("{\"buffer\":0,\"byteOffset\":").append(posOffset)
        .append(",\"byteLength\":").append(positionBytes.length).append('}');
    if (hasNormals) {
      json.append(",{\"buffer\":0,\"byteOffset\":").append(nrmOffset)
          .append(",\"byteLength\":").append(normalBytes.length).append('}');
    }
    if (indexed) {
      json.append(",{\"buffer\":0,\"byteOffset\":").append(idxOffset)
          .append(",\"byteLength\":").append(indexBytes.length).append('}');
    }
    json.append("],\"buffers\":[{\"byteLength\":").append(binLength).append("}]}");

    byte[] jsonBytes = padTo4(json.toString().getBytes(StandardCharsets.UTF_8), (byte) 0x20);
    byte[] binBytes = padTo4(bin.array(), (byte) 0x00);

    int totalLength = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
    ByteBuffer out = ByteBuffer.allocate(totalLength).order(ByteOrder.LITTLE_ENDIAN);
    out.put((byte) 'g').put((byte) 'l').put((byte) 'T').put((byte) 'F');
    out.putInt(2);
    out.putInt(totalLength);
    out.putInt(jsonBytes.length);
    out.putInt(0x4E4F534A); // JSON
    out.put(jsonBytes);
    out.putInt(binBytes.length);
    out.putInt(0x004E4942); // BIN
    out.put(binBytes);
    return out.array();
  }

  /** Lightweight GLB validation + bounds/vertex estimates from JSON chunk. */
  public static InspectStats inspectGlb(byte[] data) {
    if (data == null || data.length < 20) {
      throw new IllegalArgumentException("GLB is too small");
    }
    if (!(data[0] == 'g' && data[1] == 'l' && data[2] == 'T' && data[3] == 'F')) {
      throw new IllegalArgumentException("Not a GLB file");
    }
    ByteBuffer buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
    buf.position(4);
    int version = buf.getInt();
    if (version != 2) {
      throw new IllegalArgumentException("Only glTF 2.0 GLB is supported");
    }
    int length = buf.getInt();
    if (length != data.length) {
      throw new IllegalArgumentException("GLB length mismatch");
    }
    int jsonLen = buf.getInt();
    int jsonType = buf.getInt();
    if (jsonType != 0x4E4F534A) {
      throw new IllegalArgumentException("GLB missing JSON chunk");
    }
    byte[] jsonBytes = new byte[jsonLen];
    buf.get(jsonBytes);
    String json = new String(jsonBytes, StandardCharsets.UTF_8);
    int vertexCount = estimateCount(json, "\"type\":\"VEC3\"");
    int triangleCount = estimateIndexTriangles(json);
    return new InspectStats(Math.max(vertexCount, 0), Math.max(triangleCount, 0), json.contains("\"NORMAL\""));
  }

  private static int estimateCount(String json, String marker) {
    // Prefer POSITION accessor count
    int posAttr = json.indexOf("\"POSITION\"");
    if (posAttr < 0) return 0;
    int accessorIdx = digitAfter(json, json.indexOf(':', posAttr));
    List<Integer> counts = new ArrayList<>();
    int from = 0;
    while (true) {
      int c = json.indexOf("\"count\":", from);
      if (c < 0) break;
      counts.add(digitAfter(json, c + 8));
      from = c + 8;
    }
    if (accessorIdx >= 0 && accessorIdx < counts.size()) {
      return counts.get(accessorIdx);
    }
    return counts.isEmpty() ? 0 : counts.get(0);
  }

  private static int estimateIndexTriangles(String json) {
    int idx = json.indexOf("\"indices\"");
    if (idx < 0) return 0;
    int accessorIdx = digitAfter(json, json.indexOf(':', idx));
    List<Integer> counts = new ArrayList<>();
    int from = 0;
    while (true) {
      int c = json.indexOf("\"count\":", from);
      if (c < 0) break;
      counts.add(digitAfter(json, c + 8));
      from = c + 8;
    }
    if (accessorIdx >= 0 && accessorIdx < counts.size()) {
      return counts.get(accessorIdx) / 3;
    }
    return 0;
  }

  private static int digitAfter(String json, int from) {
    int i = from;
    while (i < json.length() && !Character.isDigit(json.charAt(i))) i++;
    int j = i;
    while (j < json.length() && Character.isDigit(json.charAt(j))) j++;
    if (i >= j) return -1;
    return Integer.parseInt(json.substring(i, j));
  }

  private static byte[] floatsToBytes(float[] values) {
    ByteBuffer buf = ByteBuffer.allocate(values.length * 4).order(ByteOrder.LITTLE_ENDIAN);
    for (float v : values) buf.putFloat(v);
    return buf.array();
  }

  private static byte[] intsToBytes(int[] values) {
    ByteBuffer buf = ByteBuffer.allocate(values.length * 4).order(ByteOrder.LITTLE_ENDIAN);
    for (int v : values) buf.putInt(v);
    return buf.array();
  }

  private static int align4(int n) {
    return (n + 3) & ~3;
  }

  private static byte[] padTo4(byte[] input, byte pad) {
    int padded = align4(input.length);
    if (padded == input.length) return input;
    byte[] out = new byte[padded];
    System.arraycopy(input, 0, out, 0, input.length);
    for (int i = input.length; i < padded; i++) out[i] = pad;
    return out;
  }

  public record InspectStats(int vertexCount, int triangleCount, boolean hasNormals) {}
}
