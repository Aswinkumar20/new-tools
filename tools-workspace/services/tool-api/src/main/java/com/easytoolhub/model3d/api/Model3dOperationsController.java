package com.easytoolhub.model3d.api;

import com.easytoolhub.model3d.application.Model3dOperationsService;
import java.util.Map;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/model3d")
public class Model3dOperationsController {
  private final Model3dOperationsService ops;

  public Model3dOperationsController(Model3dOperationsService ops) {
    this.ops = ops;
  }

  @PostMapping(value = "/inspect", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public Map<String, Object> inspect(@RequestPart("file") MultipartFile file) throws Exception {
    return ops.inspect(file);
  }

  @PostMapping(value = "/normalize", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<ByteArrayResource> normalize(@RequestPart("file") MultipartFile file) throws Exception {
    byte[] glb = ops.normalize(file);
    String base = file.getOriginalFilename() == null ? "model" : file.getOriginalFilename();
    int dot = base.lastIndexOf('.');
    if (dot > 0) base = base.substring(0, dot);
    String filename = base + ".glb";
    ByteArrayResource body = new ByteArrayResource(glb);
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .contentType(MediaType.parseMediaType("model/gltf-binary"))
        .contentLength(glb.length)
        .body(body);
  }
}
