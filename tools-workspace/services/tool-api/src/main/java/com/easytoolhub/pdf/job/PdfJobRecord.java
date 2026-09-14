package com.easytoolhub.pdf.job;

import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

public final class PdfJobRecord {
  public final String jobId;
  public final String operation;
  public final Path workDir;
  public volatile PdfJobStatus status;
  public volatile String message;
  public volatile Path resultFile;
  public volatile String resultContentType = "application/zip";
  public volatile String resultFilename = "batch-result.zip";
  public final int total;
  public final AtomicInteger completed = new AtomicInteger();
  public final AtomicInteger failed = new AtomicInteger();
  public final Instant createdAt;
  public volatile Instant updatedAt;

  public PdfJobRecord(String jobId, String operation, Path workDir, int total) {
    this.jobId = jobId;
    this.operation = operation;
    this.workDir = workDir;
    this.total = total;
    this.status = PdfJobStatus.QUEUED;
    this.message = "Queued";
    this.createdAt = Instant.now();
    this.updatedAt = this.createdAt;
  }

  public PdfJobSnapshot snapshot() {
    boolean ready = status == PdfJobStatus.COMPLETED && resultFile != null;
    return new PdfJobSnapshot(
        jobId,
        status,
        operation,
        total,
        completed.get(),
        failed.get(),
        message,
        ready,
        resultContentType,
        resultFilename,
        createdAt,
        updatedAt
    );
  }

  public void touch(String msg) {
    this.message = msg;
    this.updatedAt = Instant.now();
  }

  public void completeWithFile(Path file, String contentType, String filename) {
    this.resultFile = file;
    this.resultContentType = contentType == null ? "application/octet-stream" : contentType;
    this.resultFilename = filename == null ? "download.bin" : filename;
    this.status = PdfJobStatus.COMPLETED;
  }
}
