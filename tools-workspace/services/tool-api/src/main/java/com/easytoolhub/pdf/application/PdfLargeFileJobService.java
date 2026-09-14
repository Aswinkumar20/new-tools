package com.easytoolhub.pdf.application;

import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.pdf.job.PdfJobStore;
import com.easytoolhub.pdf.job.PdfJobRecord;
import com.easytoolhub.pdf.job.PdfJobSnapshot;
import com.easytoolhub.pdf.job.PdfJobStatus;
import com.easytoolhub.pdf.platform.PdfIoGuard;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Slice 7 — async large merge/split jobs (reuses Stage-1 job store). */
@Service
public class PdfLargeFileJobService {
  private final PdfOperationsService ops;
  private final TempWorkspace temp;
  private final PdfJobStore store;
  private final Executor executor;
  private final Semaphore slots;

  public PdfLargeFileJobService(
      PdfOperationsService ops,
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

  public PdfJobSnapshot submitMerge(List<MultipartFile> files) throws Exception {
    if (files == null || files.size() < 2) {
      throw new IllegalArgumentException("Provide at least 2 PDF files to merge");
    }
    if (!slots.tryAcquire()) {
      throw new IllegalStateException("Too many concurrent jobs — try again shortly");
    }

    String jobId = UUID.randomUUID().toString();
    Path workDir = temp.createJobDir("large");
    Path inDir = workDir.resolve("in");
    Files.createDirectories(inDir);

    List<Path> staged = new ArrayList<>();
    PdfJobRecord record = null;
    try {
      int i = 0;
      for (MultipartFile file : files) {
        if (file == null || file.isEmpty()) {
          continue;
        }
        PdfIoGuard.assertPdfMagic(file);
        Path path = inDir.resolve("in-" + (++i) + ".pdf");
        file.transferTo(path);
        staged.add(path);
      }
      if (staged.size() < 2) {
        throw new IllegalArgumentException("Provide at least 2 PDF files to merge");
      }
      record = new PdfJobRecord(jobId, "merge", workDir, staged.size());
      store.put(record);
      List<Path> paths = List.copyOf(staged);
      PdfJobRecord job = record;
      executor.execute(() -> runMerge(job, paths));
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

  public PdfJobSnapshot submitSplit(MultipartFile file, String ranges, String prefix) throws Exception {
    PdfIoGuard.requireNonEmpty(file, "PDF");
    PdfIoGuard.assertPdfMagic(file);
    List<String> specs = Arrays.stream((ranges == null ? "" : ranges).split(";"))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .toList();
    if (specs.isEmpty()) {
      throw new IllegalArgumentException("Provide at least one page range (e.g. 1-3;4-6)");
    }
    if (specs.size() > 100) {
      throw new IllegalArgumentException("Too many split ranges (max 100)");
    }
    if (!slots.tryAcquire()) {
      throw new IllegalStateException("Too many concurrent jobs — try again shortly");
    }

    String jobId = UUID.randomUUID().toString();
    Path workDir = temp.createJobDir("large");
    PdfJobRecord record = null;
    try {
      Path in = workDir.resolve("in.pdf");
      file.transferTo(in);
      record = new PdfJobRecord(jobId, "split", workDir, specs.size());
      store.put(record);
      String safePrefix = prefix == null || prefix.isBlank() ? "split" : prefix;
      PdfJobRecord job = record;
      Path input = in;
      List<String> rangeSpecs = List.copyOf(specs);
      executor.execute(() -> runSplit(job, input, rangeSpecs, safePrefix));
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

  private void runMerge(PdfJobRecord record, List<Path> staged) {
    try {
      record.status = PdfJobStatus.RUNNING;
      record.touch("Merging with scratch-file cache");
      store.save(record);
      Path out = record.workDir.resolve("merged.pdf");
      ops.mergePathsTo(staged, out);
      record.completed.set(staged.size());
      record.completeWithFile(out, "application/pdf", "merged.pdf");
      record.touch("Completed");
      store.save(record);
    } catch (Exception ex) {
      record.status = PdfJobStatus.FAILED;
      record.touch(safeMsg(ex));
      store.save(record);
    } finally {
      slots.release();
      temp.deleteQuietly(record.workDir.resolve("in"));
    }
  }

  private void runSplit(PdfJobRecord record, Path in, List<String> specs, String prefix) {
    try {
      record.status = PdfJobStatus.RUNNING;
      record.touch("Splitting");
      store.save(record);
      byte[] zip = ops.splitWithScratch(
          new com.easytoolhub.common.platform.InMemoryMultipartFile(
              "file", "document.pdf", "application/pdf", Files.readAllBytes(in)),
          specs,
          prefix
      );
      record.completed.set(specs.size());
      Path out = record.workDir.resolve("split.zip");
      Files.write(out, zip);
      record.completeWithFile(out, "application/zip", "split.zip");
      record.touch("Completed");
      store.save(record);
    } catch (Exception ex) {
      record.status = PdfJobStatus.FAILED;
      record.touch(safeMsg(ex));
      store.save(record);
    } finally {
      slots.release();
      try {
        Files.deleteIfExists(in);
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
