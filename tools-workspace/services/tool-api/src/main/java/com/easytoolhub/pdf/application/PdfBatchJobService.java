package com.easytoolhub.pdf.application;

import com.easytoolhub.common.platform.InMemoryMultipartFile;
import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.pdf.config.PdfProperties;
import com.easytoolhub.pdf.engine.pdfbox.PdfBoxEngine;
import com.easytoolhub.pdf.platform.PdfIoGuard;
import com.easytoolhub.pdf.job.PdfJobStore;
import com.easytoolhub.pdf.job.PdfJobRecord;
import com.easytoolhub.pdf.job.PdfJobSnapshot;
import com.easytoolhub.pdf.job.PdfJobStatus;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Slice 10 — async ZIP/multi-PDF batch processing with progress polling.
 * Job metadata is in-memory (Stage 1); payloads live only under ephemeral temp dirs.
 */
@Service
public class PdfBatchJobService {
  private final PdfBoxEngine pdfBox;
  private final TempWorkspace temp;
  private final PdfJobStore store;
  private final PdfProperties props;
  private final Executor executor;
  private final Semaphore slots;

  public PdfBatchJobService(
      PdfBoxEngine pdfBox,
      TempWorkspace temp,
      PdfJobStore store,
      PdfProperties props,
      @Qualifier("pdfBatchExecutor") Executor executor,
      @Qualifier("pdfBatchSlot") Semaphore slots
  ) {
    this.pdfBox = pdfBox;
    this.temp = temp;
    this.store = store;
    this.props = props;
    this.executor = executor;
    this.slots = slots;
  }

  public PdfJobSnapshot submit(
      MultipartFile zipOrPdf,
      List<MultipartFile> files,
      String operation,
      Map<String, String> options
  ) throws Exception {
    String op = normalizeOperation(operation);
    List<NamedPdf> inputs = collectInputs(zipOrPdf, files);
    if (inputs.isEmpty()) {
      throw new IllegalArgumentException("Upload a ZIP of PDFs or one or more PDF files");
    }
    if (inputs.size() > props.batchMaxFiles()) {
      throw new IllegalArgumentException("Too many PDFs in batch (max " + props.batchMaxFiles() + ")");
    }
    for (NamedPdf pdf : inputs) {
      PdfIoGuard.assertPdfMagic(pdf.bytes());
      PdfIoGuard.countPages(pdf.bytes(), props.maxPages());
    }
    if (!slots.tryAcquire()) {
      throw new IllegalStateException("Too many concurrent batch jobs — try again shortly");
    }

    String jobId = UUID.randomUUID().toString();
    Path workDir = temp.createJobDir("batch");
    Path inputDir = workDir.resolve("in");
    Files.createDirectories(inputDir);

    List<NamedPdf> staged = new ArrayList<>();
    PdfJobRecord record = null;
    try {
      int i = 0;
      for (NamedPdf pdf : inputs) {
        String safe = "doc-" + (++i) + ".pdf";
        Path path = inputDir.resolve(safe);
        Files.write(path, pdf.bytes());
        staged.add(new NamedPdf(pdf.name(), path));
      }
      record = new PdfJobRecord(jobId, op, workDir, staged.size());
      store.put(record);
      Map<String, String> opts = options == null ? Map.of() : Map.copyOf(options);
      List<NamedPdf> stagedCopy = List.copyOf(staged);
      PdfJobRecord job = record;
      executor.execute(() -> runJob(job, stagedCopy, opts));
      return record.snapshot();
    } catch (RejectedExecutionException e) {
      slots.release();
      if (record != null) {
        store.remove(record.jobId);
      } else {
        temp.deleteQuietly(workDir);
      }
      throw new IllegalStateException("Too many concurrent batch jobs — try again shortly");
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

  public byte[] download(String jobId) throws IOException {
    PdfJobRecord record = store.require(jobId);
    if (record.status != PdfJobStatus.COMPLETED || record.resultFile == null) {
      throw new IllegalStateException("Job result is not ready");
    }
    return Files.readAllBytes(record.resultFile);
  }

  private void runJob(PdfJobRecord record, List<NamedPdf> staged, Map<String, String> options) {
    try {
      record.status = PdfJobStatus.RUNNING;
      record.touch("Processing");
      store.save(record);

      Path outDir = record.workDir.resolve("out");
      Files.createDirectories(outDir);
      List<String> errors = new ArrayList<>();

      for (NamedPdf pdf : staged) {
        try {
          byte[] input = Files.readAllBytes(pdf.path());
          byte[] output = apply(record.operation, input, pdf.name(), options);
          String outName = outputName(pdf.name(), record.operation);
          Files.write(outDir.resolve(outName), output);
          record.completed.incrementAndGet();
          record.touch("Processed " + (record.completed.get() + record.failed.get()) + "/" + record.total);
          store.save(record);
        } catch (Exception ex) {
          record.failed.incrementAndGet();
          errors.add(pdf.name() + ": " + safeMsg(ex));
          record.touch("Processed " + (record.completed.get() + record.failed.get()) + "/" + record.total);
          store.save(record);
        }
      }

      if (record.completed.get() == 0) {
        record.status = PdfJobStatus.FAILED;
        record.touch(errors.isEmpty() ? "All files failed" : String.join("; ", errors));
        store.save(record);
        return;
      }

      Path zipPath = record.workDir.resolve("result.zip");
      zipDirectory(outDir, zipPath);
      record.completeWithFile(zipPath, "application/zip", "batch-result.zip");
      if (record.failed.get() > 0) {
        record.touch("Completed with " + record.failed.get() + " failure(s)");
      } else {
        record.touch("Completed");
      }
      store.save(record);
    } catch (Exception ex) {
      record.status = PdfJobStatus.FAILED;
      record.touch(safeMsg(ex));
      store.save(record);
    } finally {
      slots.release();
      // Keep workDir until TTL / download window; wipe raw inputs to reduce retention.
      temp.deleteQuietly(record.workDir.resolve("in"));
    }
  }

  private byte[] apply(String operation, byte[] input, String name, Map<String, String> options)
      throws Exception {
    return switch (operation) {
      case "remove-metadata" -> pdfBox.removeMetadata(input);
      case "remove-annotations" -> pdfBox.removeAnnotations(input);
      case "remove-hidden" -> pdfBox.removeHiddenData(input);
      case "flatten-form" -> pdfBox.flattenForm(input);
      case "repair" -> pdfBox.repair(input);
      case "rotate" -> {
        int degrees = parseInt(options.get("degrees"), 90);
        yield pdfBox.rotatePages(InMemoryMultipartFile.pdf(name, input), List.of(), degrees);
      }
      case "watermark" -> {
        String text = options.getOrDefault("watermarkText", "CONFIDENTIAL");
        if (text == null || text.isBlank()) {
          text = "CONFIDENTIAL";
        }
        float opacity = parseFloat(options.get("opacity"), 0.3f);
        yield pdfBox.addWatermark(InMemoryMultipartFile.pdf(name, input), text, opacity);
      }
      case "page-numbers" -> {
        int startAt = parseInt(options.get("startAt"), 1);
        yield pdfBox.addPageNumbers(InMemoryMultipartFile.pdf(name, input), startAt);
      }
      default -> throw new IllegalArgumentException("Unsupported batch operation: " + operation);
    };
  }

  private List<NamedPdf> collectInputs(MultipartFile zipOrPdf, List<MultipartFile> files)
      throws IOException {
    List<NamedPdf> out = new ArrayList<>();
    if (files != null) {
      for (MultipartFile f : files) {
        if (f == null || f.isEmpty()) {
          continue;
        }
        String name = f.getOriginalFilename() == null ? "document.pdf" : f.getOriginalFilename();
        if (isZipName(name) || PdfIoGuard.looksLikeZip(f)) {
          out.addAll(extractPdfsFromZip(f.getInputStream(), name));
        } else {
          byte[] bytes = f.getBytes();
          if (isPdfName(name) || looksLikePdf(bytes)) {
            out.add(new NamedPdf(safePdfName(name), bytes));
          }
        }
      }
    }
    if (zipOrPdf != null && !zipOrPdf.isEmpty()) {
      String name = zipOrPdf.getOriginalFilename() == null ? "upload.bin" : zipOrPdf.getOriginalFilename();
      if (isZipName(name) || PdfIoGuard.looksLikeZip(zipOrPdf)) {
        out.addAll(extractPdfsFromZip(zipOrPdf.getInputStream(), name));
      } else {
        byte[] bytes = zipOrPdf.getBytes();
        if (isPdfName(name) || looksLikePdf(bytes)) {
          out.add(new NamedPdf(safePdfName(name), bytes));
        } else {
          throw new IllegalArgumentException("Upload a .zip of PDFs or PDF files");
        }
      }
    }
    return out;
  }

  private List<NamedPdf> extractPdfsFromZip(InputStream in, String zipName) throws IOException {
    List<NamedPdf> out = new ArrayList<>();
    long totalUncompressed = 0;
    int entries = 0;
    try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(in))) {
      ZipEntry entry;
      while ((entry = zis.getNextEntry()) != null) {
        entries++;
        if (entries > props.batchMaxZipEntries()) {
          throw new IllegalArgumentException("ZIP has too many entries (max " + props.batchMaxZipEntries() + ")");
        }
        if (entry.isDirectory()) {
          continue;
        }
        String entryName = entry.getName();
        if (entryName.contains("..") || entryName.startsWith("/") || entryName.startsWith("\\")) {
          throw new IllegalArgumentException("ZIP contains unsafe paths");
        }
        if (!isPdfName(entryName)) {
          continue;
        }
        long declared = entry.getSize();
        byte[] data = readEntryLimited(zis, entry, totalUncompressed);
        totalUncompressed += data.length;
        if (declared > 0 && entry.getCompressedSize() > 0) {
          double ratio = declared / (double) Math.max(1, entry.getCompressedSize());
          if (ratio > props.batchMaxCompressionRatio()) {
            throw new IllegalArgumentException("ZIP entry compression ratio too high (possible zip bomb)");
          }
        }
        if (totalUncompressed > props.batchMaxUncompressedBytes()) {
          throw new IllegalArgumentException("Uncompressed ZIP content exceeds limit");
        }
        if (!looksLikePdf(data)) {
          continue;
        }
        out.add(new NamedPdf(safePdfName(Path.of(entryName).getFileName().toString()), data));
        if (out.size() > props.batchMaxFiles()) {
          throw new IllegalArgumentException("Too many PDFs in ZIP (max " + props.batchMaxFiles() + ")");
        }
      }
    }
    if (out.isEmpty()) {
      throw new IllegalArgumentException("No PDF files found in " + zipName);
    }
    return out;
  }

  private byte[] readEntryLimited(ZipInputStream zis, ZipEntry entry, long already)
      throws IOException {
    long remainingBudget = props.batchMaxUncompressedBytes() - already;
    if (remainingBudget <= 0) {
      throw new IllegalArgumentException("Uncompressed ZIP content exceeds limit");
    }
    ByteArrayOutputStream bos = new ByteArrayOutputStream();
    byte[] buf = new byte[8192];
    long read = 0;
    int n;
    while ((n = zis.read(buf)) >= 0) {
      read += n;
      if (read > remainingBudget) {
        throw new IllegalArgumentException("Uncompressed ZIP content exceeds limit");
      }
      // Individual entry soft cap: half of max uncompressed or 40MB
      long entryCap = Math.min(remainingBudget, Math.max(1_000_000L, props.batchMaxUncompressedBytes() / 2));
      if (read > entryCap) {
        throw new IllegalArgumentException("ZIP entry too large: " + entry.getName());
      }
      bos.write(buf, 0, n);
    }
    return bos.toByteArray();
  }

  private static void zipDirectory(Path dir, Path zipPath) throws IOException {
    try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zipPath))) {
      try (var walk = Files.list(dir)) {
        for (Path file : walk.filter(Files::isRegularFile).sorted().toList()) {
          zos.putNextEntry(new ZipEntry(file.getFileName().toString()));
          Files.copy(file, zos);
          zos.closeEntry();
        }
      }
    }
  }

  private static String normalizeOperation(String operation) {
    String op = operation == null ? "remove-metadata" : operation.trim().toLowerCase(Locale.ROOT);
    return switch (op) {
      case "remove-metadata", "metadata", "clean-metadata" -> "remove-metadata";
      case "remove-annotations", "annotations" -> "remove-annotations";
      case "remove-hidden", "hidden" -> "remove-hidden";
      case "flatten-form", "flatten" -> "flatten-form";
      case "repair" -> "repair";
      case "rotate" -> "rotate";
      case "watermark" -> "watermark";
      case "page-numbers", "page-number", "pagenumbers" -> "page-numbers";
      default -> throw new IllegalArgumentException(
          "Unsupported operation. Use: remove-metadata, remove-annotations, remove-hidden, "
              + "rotate, watermark, page-numbers, flatten-form, repair");
    };
  }

  private static String outputName(String original, String operation) {
    String base = original.replaceAll("(?i)\\.pdf$", "");
    base = base.replaceAll("[^a-zA-Z0-9._-]", "_");
    if (base.isBlank()) {
      base = "document";
    }
    return base + "-" + operation + ".pdf";
  }

  private static boolean isPdfName(String name) {
    return name != null && name.toLowerCase(Locale.ROOT).endsWith(".pdf");
  }

  private static boolean isZipName(String name) {
    if (name == null) {
      return false;
    }
    String lower = name.toLowerCase(Locale.ROOT);
    return lower.endsWith(".zip");
  }


  private static boolean looksLikePdf(byte[] bytes) {
    return bytes != null && bytes.length >= 5
        && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F';
  }

  private static String safePdfName(String name) {
    String base = Path.of(name == null ? "document.pdf" : name).getFileName().toString();
    base = base.replaceAll("[^a-zA-Z0-9._-]", "_");
    if (!base.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
      base = base + ".pdf";
    }
    return base;
  }

  private static int parseInt(String raw, int fallback) {
    if (raw == null || raw.isBlank()) {
      return fallback;
    }
    try {
      return Integer.parseInt(raw.trim());
    } catch (NumberFormatException e) {
      return fallback;
    }
  }

  private static float parseFloat(String raw, float fallback) {
    if (raw == null || raw.isBlank()) {
      return fallback;
    }
    try {
      return Float.parseFloat(raw.trim());
    } catch (NumberFormatException e) {
      return fallback;
    }
  }

  private static String safeMsg(Exception ex) {
    String m = ex.getMessage();
    if (m == null || m.isBlank()) {
      return ex.getClass().getSimpleName();
    }
    return m.length() > 180 ? m.substring(0, 180) : m;
  }

  /** Public helper for OpenAPI / UI docs. */
  public Map<String, Object> supportedOperations() {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("operations", List.of(
        "remove-metadata",
        "remove-annotations",
        "remove-hidden",
        "rotate",
        "watermark",
        "page-numbers",
        "flatten-form",
        "repair"
    ));
    return m;
  }

  private record NamedPdf(String name, byte[] bytes, Path path) {
    NamedPdf(String name, byte[] bytes) {
      this(name, bytes, null);
    }

    NamedPdf(String name, Path path) {
      this(name, null, path);
    }
  }
}
