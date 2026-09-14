package com.easytoolhub.model3d.application;

import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.model3d.domain.Model3dFormats;
import com.easytoolhub.model3d.domain.TriangleMesh;
import com.easytoolhub.model3d.engine.GlbWriter;
import com.easytoolhub.model3d.engine.GltfEmbedConverter;
import com.easytoolhub.model3d.engine.ObjMeshParser;
import com.easytoolhub.model3d.engine.StlMeshParser;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class Model3dOperationsService {
  private static final long MAX_BYTES = 50L * 1024L * 1024L;

  private final TempWorkspace temp;

  public Model3dOperationsService(TempWorkspace temp) {
    this.temp = temp;
  }

  public Map<String, Object> inspect(MultipartFile file) throws Exception {
    byte[] data = readUpload(file);
    String name = safeName(file);
    String format = Model3dFormats.detect(name, data);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("format", format);
    out.put("fileName", name);
    out.put("byteSize", data.length);
    out.put("normalizedFormat", "glb");

    switch (format) {
      case "fbx" -> throw unsupportedFbx();
      case "stl" -> fillMeshStats(out, StlMeshParser.parse(data), "Parsed STL mesh");
      case "obj" -> fillMeshStats(out, ObjMeshParser.parse(data), "Parsed OBJ mesh");
      case "glb" -> {
        GlbWriter.InspectStats stats = GlbWriter.inspectGlb(data);
        out.put("vertexCount", stats.vertexCount());
        out.put("triangleCount", stats.triangleCount());
        out.put("hasNormals", stats.hasNormals());
        out.put("notes", "Validated GLB (glTF 2.0)");
      }
      case "gltf" -> {
        byte[] glb = GltfEmbedConverter.toGlb(data);
        GlbWriter.InspectStats stats = GlbWriter.inspectGlb(glb);
        out.put("vertexCount", stats.vertexCount());
        out.put("triangleCount", stats.triangleCount());
        out.put("hasNormals", stats.hasNormals());
        out.put("notes", "Embedded GLTF converted for inspection");
      }
      default -> throw new IllegalArgumentException("Unsupported format: " + format);
    }
    return out;
  }

  public byte[] normalize(MultipartFile file) throws Exception {
    byte[] data = readUpload(file);
    String name = safeName(file);
    String format = Model3dFormats.detect(name, data);

    return switch (format) {
      case "fbx" -> throw unsupportedFbx();
      case "glb" -> {
        GlbWriter.inspectGlb(data); // validate
        yield data;
      }
      case "gltf" -> GltfEmbedConverter.toGlb(data);
      case "stl" -> GlbWriter.write(StlMeshParser.parse(data));
      case "obj" -> GlbWriter.write(ObjMeshParser.parse(data));
      default -> throw new IllegalArgumentException("Unsupported format: " + format);
    };
  }

  private static void fillMeshStats(Map<String, Object> out, TriangleMesh mesh, String notes) {
    out.put("vertexCount", mesh.vertexCount());
    out.put("triangleCount", mesh.triangleCount());
    out.put("hasNormals", mesh.hasNormals());
    out.put("boundsMin", mesh.boundsMin());
    out.put("boundsMax", mesh.boundsMax());
    out.put("notes", notes);
  }

  private byte[] readUpload(MultipartFile file) throws Exception {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("Upload a 3D model file");
    }
    if (file.getSize() > MAX_BYTES) {
      throw new IllegalArgumentException("File exceeds 50 MB upload limit");
    }
    var job = temp.createJobDir("model3d");
    try {
      Path saved = temp.saveUpload(job, file, "upload.bin");
      return java.nio.file.Files.readAllBytes(saved);
    } finally {
      temp.deleteQuietly(job);
    }
  }

  private static String safeName(MultipartFile file) {
    String name = file.getOriginalFilename();
    if (name == null || name.isBlank()) return "model.bin";
    name = name.replace('\\', '/');
    int slash = name.lastIndexOf('/');
    if (slash >= 0) name = name.substring(slash + 1);
    return name.toLowerCase(Locale.ROOT);
  }

  private static IllegalArgumentException unsupportedFbx() {
    return new IllegalArgumentException(
        "FBX requires conversion first. Export as GLB, STL, or OBJ and retry.");
  }
}
