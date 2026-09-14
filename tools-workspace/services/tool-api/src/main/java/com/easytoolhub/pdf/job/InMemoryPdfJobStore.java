package com.easytoolhub.pdf.job;

import com.easytoolhub.common.config.ToolApiProperties;
import com.easytoolhub.common.platform.TempWorkspace;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Stage-1 job status store (in-process). Ephemeral — jobs expire with {@code app.job-ttl-minutes}.
 * Cap prevents unbounded growth under load.
 */
@Component
@ConditionalOnProperty(name = "app.job-store", havingValue = "memory", matchIfMissing = true)
public class InMemoryPdfJobStore implements PdfJobStore {
  private final Map<String, PdfJobRecord> jobs = new ConcurrentHashMap<>();
  private final TempWorkspace temp;
  private final ToolApiProperties props;

  public InMemoryPdfJobStore(TempWorkspace temp, ToolApiProperties props) {
    this.temp = temp;
    this.props = props;
  }

  @Override
  public PdfJobRecord put(PdfJobRecord record) {
    evictIfNeeded();
    jobs.put(record.jobId, record);
    return record;
  }

  @Override
  public void remove(String jobId) {
    PdfJobRecord record = jobs.remove(jobId);
    if (record != null) {
      temp.deleteQuietly(record.workDir);
    }
  }

  @Override
  public PdfJobRecord require(String jobId) {
    if (jobId == null || jobId.isBlank()) {
      throw new NoSuchElementException("Job not found or expired");
    }
    PdfJobRecord record = jobs.get(jobId);
    if (record == null || record.status == PdfJobStatus.EXPIRED) {
      throw new NoSuchElementException("Job not found or expired");
    }
    if (isExpired(record)) {
      expire(record);
      throw new NoSuchElementException("Job not found or expired");
    }
    return record;
  }

  @Override
  public Optional<PdfJobRecord> find(String jobId) {
    try {
      return Optional.of(require(jobId));
    } catch (NoSuchElementException e) {
      return Optional.empty();
    }
  }

  @Override
  public PdfJobSnapshot snapshot(String jobId) {
    return require(jobId).snapshot();
  }

  @Override
  public void save(PdfJobRecord record) {
    if (record != null && record.jobId != null) {
      jobs.put(record.jobId, record);
    }
  }

  @Override
  public int size() {
    return jobs.size();
  }

  @Scheduled(fixedDelayString = "60000")
  public void sweepExpired() {
    Instant cutoff = Instant.now().minusSeconds(Math.max(1, props.jobTtlMinutes()) * 60L);
    for (PdfJobRecord record : List.copyOf(jobs.values())) {
      if (record.updatedAt.isBefore(cutoff) || record.createdAt.isBefore(cutoff)) {
        expire(record);
      }
    }
  }

  private void evictIfNeeded() {
    int max = Math.max(20, props.maxStoredJobs());
    if (jobs.size() < max) {
      return;
    }
    List<PdfJobRecord> candidates = new ArrayList<>();
    for (PdfJobRecord r : jobs.values()) {
      if (r.status == PdfJobStatus.COMPLETED
          || r.status == PdfJobStatus.FAILED
          || r.status == PdfJobStatus.EXPIRED) {
        candidates.add(r);
      }
    }
    candidates.sort(Comparator.comparing(r -> r.updatedAt));
    int toRemove = Math.max(1, jobs.size() - max + 1);
    for (int i = 0; i < candidates.size() && i < toRemove; i++) {
      expire(candidates.get(i));
    }
    if (jobs.size() >= max) {
      throw new IllegalStateException("Too many jobs in progress — try again shortly");
    }
  }

  private boolean isExpired(PdfJobRecord record) {
    Instant cutoff = Instant.now().minusSeconds(Math.max(1, props.jobTtlMinutes()) * 60L);
    return record.updatedAt.isBefore(cutoff);
  }

  private void expire(PdfJobRecord record) {
    record.status = PdfJobStatus.EXPIRED;
    record.touch("Expired");
    Path dir = record.workDir;
    jobs.remove(record.jobId);
    temp.deleteQuietly(dir);
  }
}
