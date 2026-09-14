package com.easytoolhub.pdf.job;

import java.util.Optional;

/** Stage-1 async job status store (in-memory or Redis). */
public interface PdfJobStore {
  PdfJobRecord put(PdfJobRecord record);

  void remove(String jobId);

  PdfJobRecord require(String jobId);

  Optional<PdfJobRecord> find(String jobId);

  PdfJobSnapshot snapshot(String jobId);

  /** Persist latest mutable fields (status, progress, result path). */
  void save(PdfJobRecord record);

  int size();
}
