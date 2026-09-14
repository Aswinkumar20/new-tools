package com.easytoolhub.pdf.job;

import java.time.Instant;

/** Public job status returned to clients (never includes file bytes). */
public record PdfJobSnapshot(
    String jobId,
    PdfJobStatus status,
    String operation,
    int total,
    int completed,
    int failed,
    String message,
    boolean downloadReady,
    String resultContentType,
    String resultFilename,
    Instant createdAt,
    Instant updatedAt
) {
  public double progress() {
    if (total <= 0) {
      return status == PdfJobStatus.COMPLETED ? 1.0 : 0.0;
    }
    return Math.min(1.0, (completed + failed) / (double) total);
  }
}
