package com.easytoolhub.pdf.api;

import com.easytoolhub.pdf.application.PdfConvertJobService;
import com.easytoolhub.pdf.job.PdfJobSnapshot;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/pdf")
public class PdfConvertJobController {
  private final PdfConvertJobService convert;

  public PdfConvertJobController(PdfConvertJobService convert) {
    this.convert = convert;
  }

  @PostMapping("/office-to-pdf-async")
  public Map<String, Object> officeAsync(@RequestPart("file") MultipartFile file) throws Exception {
    return toJson(convert.submitOfficeToPdf(file));
  }

  @PostMapping("/url-to-pdf-async")
  public Map<String, Object> urlAsync(@RequestParam("url") String url) throws Exception {
    return toJson(convert.submitUrlToPdf(url));
  }

  @PostMapping("/ocr-async")
  public Map<String, Object> ocrAsync(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "mode", defaultValue = "searchable") String mode,
      @RequestParam(value = "language", defaultValue = "eng") String language,
      @RequestParam(value = "dpi", defaultValue = "200") int dpi,
      @RequestParam(value = "deskew", defaultValue = "false") boolean deskew
  ) throws Exception {
    return toJson(convert.submitOcr(file, mode, language, dpi, deskew));
  }

  private static Map<String, Object> toJson(PdfJobSnapshot snap) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("jobId", snap.jobId());
    m.put("status", snap.status().name());
    m.put("operation", snap.operation());
    m.put("total", snap.total());
    m.put("completed", snap.completed());
    m.put("failed", snap.failed());
    m.put("progress", snap.progress());
    m.put("message", snap.message());
    m.put("downloadReady", snap.downloadReady());
    m.put("resultContentType", snap.resultContentType());
    m.put("resultFilename", snap.resultFilename());
    m.put("createdAt", snap.createdAt().toString());
    m.put("updatedAt", snap.updatedAt().toString());
    return m;
  }
}
