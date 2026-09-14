package com.easytoolhub.model3d.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Supports only self-contained .gltf with data-URI buffers (no external .bin).
 */
public final class GltfEmbedConverter {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private GltfEmbedConverter() {}

  public static byte[] toGlb(byte[] gltfJsonBytes) throws Exception {
    JsonNode root = MAPPER.readTree(gltfJsonBytes);
    JsonNode buffers = root.get("buffers");
    if (buffers == null || !buffers.isArray() || buffers.isEmpty()) {
      throw new IllegalArgumentException("GLTF has no buffers — upload a .glb instead");
    }
    JsonNode buffer0 = buffers.get(0);
    String uri = buffer0.path("uri").asText("");
    if (!uri.startsWith("data:")) {
      throw new IllegalArgumentException(
          "External GLTF buffers are not supported. Export as .glb (single file) and retry.");
    }
    int comma = uri.indexOf(',');
    if (comma < 0) {
      throw new IllegalArgumentException("Invalid data URI in GLTF buffer");
    }
    String meta = uri.substring(5, comma);
    String payload = uri.substring(comma + 1);
    byte[] bin = meta.contains(";base64")
        ? Base64.getDecoder().decode(payload)
        : payload.getBytes(StandardCharsets.UTF_8);

    // Strip uri so buffer is GLB-bin-backed
    ((com.fasterxml.jackson.databind.node.ObjectNode) buffer0).remove("uri");
    ((com.fasterxml.jackson.databind.node.ObjectNode) buffer0).put("byteLength", bin.length);

    byte[] jsonBytes = MAPPER.writeValueAsBytes(root);
    jsonBytes = padTo4(jsonBytes, (byte) 0x20);
    bin = padTo4(bin, (byte) 0x00);

    int total = 12 + 8 + jsonBytes.length + 8 + bin.length;
    java.nio.ByteBuffer out = java.nio.ByteBuffer.allocate(total).order(java.nio.ByteOrder.LITTLE_ENDIAN);
    out.put((byte) 'g').put((byte) 'l').put((byte) 'T').put((byte) 'F');
    out.putInt(2);
    out.putInt(total);
    out.putInt(jsonBytes.length);
    out.putInt(0x4E4F534A);
    out.put(jsonBytes);
    out.putInt(bin.length);
    out.putInt(0x004E4942);
    out.put(bin);
    return out.array();
  }

  private static byte[] padTo4(byte[] input, byte pad) {
    int padded = (input.length + 3) & ~3;
    if (padded == input.length) return input;
    byte[] out = new byte[padded];
    System.arraycopy(input, 0, out, 0, input.length);
    for (int i = input.length; i < padded; i++) out[i] = pad;
    return out;
  }
}
