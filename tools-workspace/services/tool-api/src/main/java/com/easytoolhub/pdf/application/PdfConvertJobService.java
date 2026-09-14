package com.easytoolhub.pdf.application;

import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.pdf.job.PdfJobRecord;
import com.easytoolhub.pdf.job.PdfJobSnapshot;
import com.easytoolhub.pdf.job.PdfJobStatus;
import com.easytoolhub.pdf.job.PdfJobStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Async Office / long convert jobs (LibreOffice, URL→PDF). */
@Service
public class PdfConvertJobService {
  private final PdfAdvancedOperationsService ops;
  private final TempWorkspace temp;
  private final PdfJobStore store;
  private final Executor executor;
  private final Semaphore slots;

  public PdfConvertJobService(
      PdfAdvancedOperationsService ops,
      TempWorkspace temp,
      PdfJobStore store,
      @Qualifier("pdfBatchExecutor") Executor executor,
      @Qualifier("pdfBatchSlot") Semaphore slots
  ) {
    this.ops = ops;
    this.temp = temp;
    this.store = store;
    this.executor = executor;
    this.slots = slots;
  }

  public PdfJobSnapshot submitOfficeToPdf(MultipartFile file) throws Exception {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("Office file is required");
    }
    if (!slots.tryAcquire()) {
      throw new IllegalStateException("Too many concurrent jobs — try again shortly");
    }
    String jobId = UUID.randomUUID().toString();
    Path workDir = temp.createJobDir("office");
    PdfJobRecord record = null;
    try {
      String original = file.getOriginalFilename() == null ? "document.bin" : file.getOriginalFilename();
      String ext = "";
      int dot = original.lastIndexOf('.');
      if (dot > 0 && dot < original.length() - 1) {
        ext = original.substring(dot).replaceAll("[^a-zA-Z0-9.]", "");
      }
      if (ext.isBlank()) {
        ext = ".bin";
      }
      Path in = temp.saveUploadAs(workDir, file, "office-input" + ext.toLowerCase());
      record = new PdfJobRecord(jobId, "office-to-pdf", workDir, 1);
      store.put(record);
      PdfJobRecord job = record;
      Path input = in;
      executor.execute(() -> runOffice(job, input));
      return record.snapshot();
    } catch (RejectedExecutionException e) {
      slots.release();
      if (record != null) {
        store.remove(record.jobId);
      } else {
        temp.deleteQuietly(workDir);
      }
      throw new IllegalStateException("Too many concurrent jobs — try again shortly");
    } catch (Exception e) {
      slots.release();
      if (record != null) {
        store.remove(record.jobId);
      } else {
        temp.deleteQuietly(workDir);
      }
      throw e;
    }
  }

  public PdfJobSnapshot submitUrlToPdf(String url) throws Exception {
    if (!slots.tryAcquire()) {
      throw new IllegalStateException("Too many concurrent jobs — try again shortly");
    }
    String jobId = UUID.randomUUID().toString();
    Path workDir = temp.createJobDir("urlpdf");
    PdfJobRecord record = null;
    try {
      record = new PdfJobRecord(jobId, "url-to-pdf", workDir, 1);
      store.put(record);
      PdfJobRecord job = record;
      String safeUrl = url;
      executor.execute(() -> runUrl(job, safeUrl));
      return record.snapshot();
    } catch (RejectedExecutionException e) {
      slots.release();
      if (record != null) {
        store.remove(record.jobId);
      } else {
        temp.deleteQuietly(workDir);
      }
      throw new IllegalStateException("Too many concurrent jobs — try again shortly");
    } catch (Exception e) {
      slots.release();
      if (record != null) {
        store.remove(record.jobId);
      } else {
        temp.deleteQuietly(workDir);
      }
      throw e;
    }
  }

  public PdfJobSnapshot submitOcr(
      MultipartFile file,
      String mode,
      String language,
      int dpi,
      boolean deskewFirst
  ) throws Exception {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("PDF is required");
    }
    if (!slots.tryAcquire()) {
      throw new IllegalStateException("Too many concurrent jobs — try again shortly");
    }
    String jobId = UUID.randomUUID().toString();
    Path workDir = temp.createJobDir("ocr");
    PdfJobRecord record = null;
    try {
      Path in = temp.saveUploadAs(workDir, file, "in.pdf");
      String safeMode = mode == null || mode.isBlank() ? "searchable" : mode.trim().toLowerCase();
      record = new PdfJobRecord(jobId, "ocr-" + safeMode, workDir, 1);
      store.put(record);
      PdfJobRecord job = record;
      Path input = in;
      String lang = language;
      int renderDpi = dpi;
      boolean deskew = deskewFirst;
      executor.execute(() -> runOcr(job, input, safeMode, lang, renderDpi, deskew));
      return record.snapshot();
    } catch (RejectedExecutionException e) {
      slots.release();
      if (record != null) {
        store.remove(record.jobId);
      } else {
        temp.deleteQuietly(workDir);
      }
      throw new IllegalStateException("Too many concurrent jobs — try again shortly");
    } catch (Exception e) {
      slots.release();
      if (record != null) {
        store.remove(record.jobId);
      } else {
        temp.deleteQuietly(workDir);
      }
      throw e;
    }
  }

  public PdfJobSnapshot status(String jobId) {
    return store.snapshot(jobId);
  }

  private void runOffice(PdfJobRecord record, Path input) {
    try {
      record.status = PdfJobStatus.RUNNING;
      record.touch("Converting with LibreOffice");
      store.save(record);
      byte[] pdf = ops.officeToPdf(
          new com.easytoolhub.common.platform.InMemoryMultipartFile(
              "file",
              input.getFileName().toString(),
              "application/octet-stream",
              Files.readAllBytes(input)
          )
      );
      Path out = record.workDir.resolve("converted.pdf");
      Files.write(out, pdf);
      record.completed.set(1);
      record.completeWithFile(out, "application/pdf", "converted.pdf");
      record.touch("Completed");
      store.save(record);
    } catch (Exception ex) {
      record.status = PdfJobStatus.FAILED;
      record.touch(safeMsg(ex));
      store.save(record);
    } finally {
      slots.release();
      try {
        Files.deleteIfExists(input);
      } catch (Exception ignored) {
        // best effort
      }
    }
  }

  private void runUrl(PdfJobRecord record, String url) {
    try {
      record.status = PdfJobStatus.RUNNING;
      record.touch("Rendering URL with Chromium");
      store.save(record);
      byte[] pdf = ops.urlToPdf(url);
      Path out = record.workDir.resolve("page.pdf");
      Files.write(out, pdf);
      record.completed.set(1);
      record.completeWithFile(out, "application/pdf", "page.pdf");
      record.touch("Completed");
      store.save(record);
    } catch (Exception ex) {
      record.status = PdfJobStatus.FAILED;
      record.touch(safeMsg(ex));
      store.save(record);
    } finally {
      slots.release();
    }
  }

  private void runOcr(
      PdfJobRecord record,
      Path input,
      String mode,
      String language,
      int dpi,
      boolean deskewFirst
  ) {
    try {
      record.status = PdfJobStatus.RUNNING;
      record.touch(deskewFirst ? "Deskew + OCR" : "Running OCR");
      store.save(record);
      byte[] outBytes = ops.ocr(
          new com.easytoolhub.common.platform.InMemoryMultipartFile(
              "file", "document.pdf", "application/pdf", Files.readAllBytes(input)),
          mode,
          language,
          dpi,
          deskewFirst
      );
      String filename;
      String contentType;
      if ("text".equals(mode) || "txt".equals(mode)) {
        filename = "ocr.txt";
        contentType = "text/plain";
      } else if ("docx".equals(mode) || "word".equals(mode)) {
        filename = "ocr.docx";
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else {
        filename = "searchable.pdf";
        contentType = "application/pdf";
      }
      Path out = record.workDir.resolve(filename);
      Files.write(out, outBytes);
      record.completed.set(1);
      record.completeWithFile(out, contentType, filename);
      record.touch("Completed");
      store.save(record);
    } catch (Exception ex) {
      record.status = PdfJobStatus.FAILED;
      record.touch(safeMsg(ex));
      store.save(record);
    } finally {
      slots.release();
      try {
        Files.deleteIfExists(input);
      } catch (Exception ignored) {
        // best effort
      }
    }
  }

  private static String safeMsg(Exception ex) {
    String m = ex.getMessage();
    if (m == null || m.isBlank()) {
      return ex.getClass().getSimpleName();
    }
    return m.length() > 180 ? m.substring(0, 180) : m;
  }
}
