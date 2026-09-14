package com.easytoolhub.pdf.api;

import com.easytoolhub.pdf.application.PdfBatchJobService;
import com.easytoolhub.pdf.job.PdfJobStore;
import com.easytoolhub.pdf.job.PdfJobRecord;
import com.easytoolhub.pdf.job.PdfJobSnapshot;
import com.easytoolhub.pdf.job.PdfJobStatus;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
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
@RequestMapping("/api/v1/pdf")
public class PdfBatchJobController {
  private final PdfBatchJobService batch;
  private final PdfJobStore store;

  public PdfBatchJobController(PdfBatchJobService batch, PdfJobStore store) {
    this.batch = batch;
    this.store = store;
  }

  @PostMapping("/batch")
  public Map<String, Object> submit(
      @RequestPart(value = "file", required = false) MultipartFile file,
      @RequestPart(value = "files", required = false) List<MultipartFile> files,
      @RequestParam(value = "operation", defaultValue = "remove-metadata") String operation,
      @RequestParam(value = "degrees", required = false) String degrees,
      @RequestParam(value = "watermarkText", required = false) String watermarkText,
      @RequestParam(value = "opacity", required = false) String opacity,
      @RequestParam(value = "startAt", required = false) String startAt
  ) throws Exception {
    Map<String, String> options = new HashMap<>();
    if (degrees != null) {
      options.put("degrees", degrees);
    }
    if (watermarkText != null) {
      options.put("watermarkText", watermarkText);
    }
    if (opacity != null) {
      options.put("opacity", opacity);
    }
    if (startAt != null) {
      options.put("startAt", startAt);
    }
    return toJson(batch.submit(file, files, operation, options));
  }

  @GetMapping("/jobs/{id}")
  public Map<String, Object> status(@PathVariable("id") String id) {
    return toJson(batch.status(id));
  }

  /** Stream result from disk — avoids loading large ZIPs/PDFs into heap for download. */
  @GetMapping("/jobs/{id}/download")
  public ResponseEntity<Resource> download(@PathVariable("id") String id) throws Exception {
    PdfJobRecord record = store.require(id);
    if (record.status != PdfJobStatus.COMPLETED || record.resultFile == null
        || !Files.isRegularFile(record.resultFile)) {
      throw new IllegalStateException("Job result is not ready");
    }
    PdfJobSnapshot snap = record.snapshot();
    String filename = snap.resultFilename() == null ? "download.bin" : snap.resultFilename();
    String type = snap.resultContentType() == null ? "application/octet-stream" : snap.resultContentType();
    FileSystemResource body = new FileSystemResource(record.resultFile);
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .contentType(MediaType.parseMediaType(type))
        .contentLength(Files.size(record.resultFile))
        .body(body);
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
