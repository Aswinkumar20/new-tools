package com.easytoolhub.model3d.domain;

import java.util.Locale;

public final class Model3dFormats {
  private Model3dFormats() {}

  public static String detect(String fileName, byte[] data) {
    String lower = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
    if (data != null && data.length >= 4) {
      // glTF binary magic "glTF"
      if (data[0] == 'g' && data[1] == 'l' && data[2] == 'T' && data[3] == 'F') {
        return "glb";
      }
      // ASCII STL
      String head = new String(data, 0, Math.min(80, data.length), java.nio.charset.StandardCharsets.US_ASCII)
          .toLowerCase(Locale.ROOT);
      if (head.startsWith("solid") && !looksLikeBinaryStl(data)) {
        return "stl";
      }
      if (looksLikeBinaryStl(data)) {
        return "stl";
      }
    }
    if (lower.endsWith(".glb")) return "glb";
    if (lower.endsWith(".gltf")) return "gltf";
    if (lower.endsWith(".stl")) return "stl";
    if (lower.endsWith(".obj")) return "obj";
    if (lower.endsWith(".fbx")) return "fbx";
    throw new IllegalArgumentException("Unsupported 3D format. Use GLB, GLTF, STL, or OBJ.");
  }

  private static boolean looksLikeBinaryStl(byte[] data) {
    if (data.length < 84) return false;
    int triangles = ((data[80] & 0xff))
        | ((data[81] & 0xff) << 8)
        | ((data[82] & 0xff) << 16)
        | ((data[83] & 0xff) << 24);
    if (triangles <= 0 || triangles > 20_000_000) return false;
    long expected = 84L + (50L * (long) triangles);
    return expected == data.length;
  }
}
