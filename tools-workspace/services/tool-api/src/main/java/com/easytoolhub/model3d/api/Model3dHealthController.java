package com.easytoolhub.model3d.api;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/model3d")
public class Model3dHealthController {

  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> health() {
    return ResponseEntity.ok(Map.of(
        "status", "UP",
        "service", "tool-api-model3d",
        "version", "0.1.0",
        "formats", new String[] {"glb", "gltf", "stl", "obj"}
    ));
  }
}
