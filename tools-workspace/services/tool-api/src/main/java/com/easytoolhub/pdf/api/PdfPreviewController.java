package com.easytoolhub.pdf.api;

import com.easytoolhub.pdf.application.PdfPreviewService;
import java.util.Map;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/pdf/preview")
public class PdfPreviewController {
  private final PdfPreviewService preview;

  public PdfPreviewController(PdfPreviewService preview) {
    this.preview = preview;
  }

  @PostMapping("/session")
  public Map<String, Object> open(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "password", required = false) String password
  ) throws Exception {
    return preview.openSession(file, password);
  }

  @GetMapping("/{sessionId}/pages/{page}.png")
  public ResponseEntity<ByteArrayResource> page(
      @PathVariable("sessionId") String sessionId,
      @PathVariable("page") int page,
      @RequestParam(value = "dpi", defaultValue = "120") int dpi
  ) throws Exception {
    byte[] png = preview.renderPage(sessionId, page, dpi);
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"page-" + page + ".png\"")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .contentType(MediaType.IMAGE_PNG)
        .contentLength(png.length)
        .body(new ByteArrayResource(png));
  }
}
