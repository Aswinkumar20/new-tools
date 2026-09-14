package com.easytoolhub.pdf.application;

import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.common.security.SensitivePayload;
import com.easytoolhub.pdf.config.PdfProperties;
import com.easytoolhub.pdf.engine.pdfbox.PdfBoxEngine;
import com.easytoolhub.pdf.job.PdfJobRecord;
import com.easytoolhub.pdf.job.PdfJobStore;
import com.easytoolhub.pdf.platform.PdfIoGuard;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Ephemeral preview sessions: upload once, fetch page PNGs by index until TTL.
 * Supports password-protected PDFs (password kept only in the job dir, wiped with TTL).
 */
@Service
public class PdfPreviewService {
  private final PdfBoxEngine pdfBox;
  private final TempWorkspace temp;
  private final PdfJobStore store;
  private final PdfProperties props;

  public PdfPreviewService(
      PdfBoxEngine pdfBox,
      TempWorkspace temp,
      PdfJobStore store,
      PdfProperties props
  ) {
    this.pdfBox = pdfBox;
    this.temp = temp;
    this.store = store;
    this.props = props;
  }

  public Map<String, Object> openSession(MultipartFile file, String passwordEncoded) throws Exception {
    PdfIoGuard.requireNonEmpty(file, "PDF");
    PdfIoGuard.assertPdfMagic(file);
    String password = SensitivePayload.decode(passwordEncoded == null ? "" : passwordEncoded);
    Path workDir = temp.createJobDir("preview");
    Path in = workDir.resolve("in.pdf");
    file.transferTo(in);
    byte[] bytes = Files.readAllBytes(in);
    int pages;
    try {
      pages = pdfBox.pageCount(bytes, password);
    } catch (Exception e) {
      temp.deleteQuietly(workDir);
      throw new IllegalArgumentException("Unable to open PDF (wrong password or damaged file)");
    }
    if (pages > props.maxPages()) {
      temp.deleteQuietly(workDir);
      throw new IllegalArgumentException("PDF exceeds max pages (" + props.maxPages() + ")");
    }
    if (password != null && !password.isBlank()) {
      Files.writeString(workDir.resolve(".password"), password);
    }
    String jobId = UUID.randomUUID().toString();
    PdfJobRecord record = new PdfJobRecord(jobId, "preview", workDir, pages);
    record.completeWithFile(in, "application/pdf", "source.pdf");
    record.touch("Preview ready");
    store.put(record);
    store.save(record);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("sessionId", jobId);
    out.put("pageCount", pages);
    out.put("maxDpi", props.previewMaxDpi());
    out.put("expiresWithJobTtl", true);
    return out;
  }

  public byte[] renderPage(String sessionId, int pageOneBased, int dpi) throws Exception {
    PdfJobRecord record = store.require(sessionId);
    if (!"preview".equals(record.operation) || record.resultFile == null
        || !Files.isRegularFile(record.resultFile)) {
      throw new IllegalStateException("Preview session is not ready");
    }
    int pageIndex = pageOneBased - 1;
    if (pageIndex < 0 || pageIndex >= record.total) {
      throw new IllegalArgumentException("Page out of range");
    }
    int safeDpi = Math.max(36, Math.min(props.previewMaxDpi(), dpi <= 0 ? 120 : dpi));
    byte[] bytes = Files.readAllBytes(record.resultFile);
    String password = "";
    Path pw = record.workDir.resolve(".password");
    if (Files.isRegularFile(pw)) {
      password = Files.readString(pw);
    }
    byte[] png = pdfBox.renderPagePng(bytes, password, pageIndex, safeDpi);
    record.touch("Rendered page " + pageOneBased);
    store.save(record);
    return png;
  }
}
