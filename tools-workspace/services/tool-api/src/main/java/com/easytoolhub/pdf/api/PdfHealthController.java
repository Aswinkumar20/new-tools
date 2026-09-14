package com.easytoolhub.pdf.api;

import com.easytoolhub.common.config.ToolApiProperties;
import com.easytoolhub.pdf.config.PdfProperties;
import com.easytoolhub.pdf.engine.chromium.ChromiumPdfEngine;
import com.easytoolhub.pdf.engine.ghostscript.GhostscriptEngine;
import com.easytoolhub.pdf.engine.libreoffice.LibreOfficeEngine;
import com.easytoolhub.pdf.engine.ocr.OcrEngine;
import com.easytoolhub.pdf.engine.qpdf.QpdfEngine;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pdf")
public class PdfHealthController {
  private final QpdfEngine qpdf;
  private final GhostscriptEngine gs;
  private final LibreOfficeEngine libreOffice;
  private final ChromiumPdfEngine chromium;
  private final OcrEngine ocr;
  private final ToolApiProperties app;
  private final PdfProperties pdf;

  public PdfHealthController(
      QpdfEngine qpdf,
      GhostscriptEngine gs,
      LibreOfficeEngine libreOffice,
      ChromiumPdfEngine chromium,
      OcrEngine ocr,
      ToolApiProperties app,
      PdfProperties pdf
  ) {
    this.qpdf = qpdf;
    this.gs = gs;
    this.libreOffice = libreOffice;
    this.chromium = chromium;
    this.ocr = ocr;
    this.app = app;
    this.pdf = pdf;
  }

  @GetMapping("/health")
  public ResponseEntity<Map<String, Object>> health() {
    Map<String, Object> engines = new LinkedHashMap<>();
    engines.put("qpdf", qpdf.isAvailable());
    engines.put("ghostscript", gs.isAvailable());
    engines.put("libreOffice", libreOffice.isAvailable());
    engines.put("chromium", chromium.isAvailable());
    engines.put("tesseract", ocr.isAvailable());

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("status", "UP");
    body.put("service", "tool-api-pdf");
    body.put("version", "0.1.0");
    body.put("jobStore", app.redisJobStore() ? "redis" : "memory");
    body.put("engines", engines);
    body.put("capabilities", Map.of(
        "officeToPdf", libreOffice.isAvailable(),
        "pdfA", gs.isAvailable(),
        "webOptimize", qpdf.isAvailable() || gs.isAvailable(),
        "urlToPdf", chromium.isAvailable(),
        "ocr", ocr.isAvailable(),
        "preview", true,
        "maxPages", pdf.maxPages()
    ));
    return ResponseEntity.ok(body);
  }
}
