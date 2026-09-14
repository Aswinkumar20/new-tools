package com.easytoolhub.model3d;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.easytoolhub.common.config.ToolApiProperties;
import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.model3d.application.Model3dOperationsService;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class Model3dOperationsServiceTest {
  private Model3dOperationsService service;

  @BeforeEach
  void setUp() {
    TempWorkspace temp = new TempWorkspace(new ToolApiProperties("/tmp/tool-api-model3d-test", 10, "http://localhost:4200", 200, 120, "memory"));
    service = new Model3dOperationsService(temp);
  }

  @Test
  void inspectAndNormalizeAsciiStl() throws Exception {
    String stl = """
        solid cube
          facet normal 0 0 1
            outer loop
              vertex 0 0 0
              vertex 1 0 0
              vertex 0 1 0
            endloop
          endfacet
        endsolid cube
        """;
    MockMultipartFile file = new MockMultipartFile(
        "file", "cube.stl", "model/stl", stl.getBytes(StandardCharsets.US_ASCII));

    Map<String, Object> meta = service.inspect(file);
    assertEquals("stl", meta.get("format"));
    assertEquals(3, meta.get("vertexCount"));
    assertEquals(1, meta.get("triangleCount"));

    byte[] glb = service.normalize(file);
    assertTrue(glb.length > 20);
    assertEquals('g', glb[0]);
    assertEquals('l', glb[1]);
    assertEquals('T', glb[2]);
    assertEquals('F', glb[3]);
  }

  @Test
  void normalizeBinaryStl() throws Exception {
    byte[] stl = binaryStlTriangle();
    MockMultipartFile file = new MockMultipartFile("file", "tri.stl", "model/stl", stl);
    byte[] glb = service.normalize(file);
    assertTrue(glb.length > 100);
    ByteBuffer buf = ByteBuffer.wrap(glb).order(ByteOrder.LITTLE_ENDIAN);
    buf.position(8);
    assertEquals(glb.length, buf.getInt());
  }

  @Test
  void normalizeObj() throws Exception {
    String obj = """
        v 0 0 0
        v 1 0 0
        v 0 1 0
        f 1 2 3
        """;
    MockMultipartFile file = new MockMultipartFile(
        "file", "tri.obj", "text/plain", obj.getBytes(StandardCharsets.UTF_8));
    Map<String, Object> meta = service.inspect(file);
    assertEquals("obj", meta.get("format"));
    assertEquals(1, meta.get("triangleCount"));
    byte[] glb = service.normalize(file);
    assertTrue(glb.length > 80);
  }

  private static byte[] binaryStlTriangle() {
    ByteBuffer buf = ByteBuffer.allocate(84 + 50).order(ByteOrder.LITTLE_ENDIAN);
    buf.put(new byte[80]);
    buf.putInt(1);
    buf.putFloat(0f); buf.putFloat(0f); buf.putFloat(1f); // normal
    buf.putFloat(0f); buf.putFloat(0f); buf.putFloat(0f);
    buf.putFloat(1f); buf.putFloat(0f); buf.putFloat(0f);
    buf.putFloat(0f); buf.putFloat(1f); buf.putFloat(0f);
    buf.putShort((short) 0);
    return buf.array();
  }
}
