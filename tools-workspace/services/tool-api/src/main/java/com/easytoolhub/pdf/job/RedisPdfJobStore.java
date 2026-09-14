package com.easytoolhub.pdf.job;

import com.easytoolhub.common.config.ToolApiProperties;
import com.easytoolhub.common.platform.TempWorkspace;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Redis-backed job metadata for multi-replica Stage 1.
 * Result files still live under {@code APP_TEMP_DIR} — mount that volume shared across replicas.
 */
@Configuration
@ConditionalOnProperty(name = "app.job-store", havingValue = "redis")
class RedisJobStoreConfig {
  @Bean
  LettuceConnectionFactory redisConnectionFactory(
      @Value("${spring.data.redis.host:127.0.0.1}") String host,
      @Value("${spring.data.redis.port:6379}") int port,
      @Value("${spring.data.redis.password:}") String password
  ) {
    RedisStandaloneConfiguration cfg = new RedisStandaloneConfiguration(host, port);
    if (password != null && !password.isBlank()) {
      cfg.setPassword(password);
    }
    return new LettuceConnectionFactory(cfg);
  }

  @Bean
  StringRedisTemplate stringRedisTemplate(LettuceConnectionFactory factory) {
    return new StringRedisTemplate(factory);
  }
}

@Component
@ConditionalOnProperty(name = "app.job-store", havingValue = "redis")
public class RedisPdfJobStore implements PdfJobStore {
  private static final String KEY_PREFIX = "pdf:job:";

  private final StringRedisTemplate redis;
  private final TempWorkspace temp;
  private final ToolApiProperties props;
  private final ObjectMapper json;
  /** Local cache for the worker that owns the running job (mutable AtomicInteger fields). */
  private final Map<String, PdfJobRecord> local = new ConcurrentHashMap<>();

  public RedisPdfJobStore(
      StringRedisTemplate redis,
      TempWorkspace temp,
      ToolApiProperties props,
      ObjectMapper json
  ) {
    this.redis = redis;
    this.temp = temp;
    this.props = props;
    this.json = json;
  }

  @Override
  public PdfJobRecord put(PdfJobRecord record) {
    local.put(record.jobId, record);
    save(record);
    return record;
  }

  @Override
  public void remove(String jobId) {
    PdfJobRecord record = local.remove(jobId);
    redis.delete(KEY_PREFIX + jobId);
    if (record != null) {
      temp.deleteQuietly(record.workDir);
    } else {
      find(jobId).ifPresent(r -> temp.deleteQuietly(r.workDir));
    }
  }

  @Override
  public PdfJobRecord require(String jobId) {
    if (jobId == null || jobId.isBlank()) {
      throw new NoSuchElementException("Job not found or expired");
    }
    PdfJobRecord localHit = local.get(jobId);
    if (localHit != null) {
      if (isExpired(localHit)) {
        expire(localHit);
        throw new NoSuchElementException("Job not found or expired");
      }
      return localHit;
    }
    String raw = redis.opsForValue().get(KEY_PREFIX + jobId);
    if (raw == null || raw.isBlank()) {
      throw new NoSuchElementException("Job not found or expired");
    }
    try {
      PdfJobRecord hydrated = fromJson(raw);
      if (hydrated.status == PdfJobStatus.EXPIRED || isExpired(hydrated)) {
        expire(hydrated);
        throw new NoSuchElementException("Job not found or expired");
      }
      local.put(jobId, hydrated);
      return hydrated;
    } catch (NoSuchElementException e) {
      throw e;
    } catch (Exception e) {
      throw new NoSuchElementException("Job not found or expired");
    }
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
    if (record == null || record.jobId == null) {
      return;
    }
    local.put(record.jobId, record);
    try {
      redis.opsForValue().set(
          KEY_PREFIX + record.jobId,
          toJson(record),
          Math.max(1, props.jobTtlMinutes()),
          TimeUnit.MINUTES
      );
    } catch (Exception e) {
      throw new IllegalStateException("Failed to persist job status to Redis", e);
    }
  }

  @Override
  public int size() {
    return local.size();
  }

  @Scheduled(fixedDelayString = "60000")
  public void sweepExpired() {
    for (PdfJobRecord record : local.values().toArray(PdfJobRecord[]::new)) {
      if (isExpired(record)) {
        expire(record);
      }
    }
  }

  private boolean isExpired(PdfJobRecord record) {
    Instant cutoff = Instant.now().minusSeconds(Math.max(1, props.jobTtlMinutes()) * 60L);
    return record.updatedAt.isBefore(cutoff);
  }

  private void expire(PdfJobRecord record) {
    record.status = PdfJobStatus.EXPIRED;
    record.touch("Expired");
    local.remove(record.jobId);
    redis.delete(KEY_PREFIX + record.jobId);
    temp.deleteQuietly(record.workDir);
  }

  private String toJson(PdfJobRecord r) throws Exception {
    ObjectNode n = json.createObjectNode();
    n.put("jobId", r.jobId);
    n.put("operation", r.operation);
    n.put("workDir", r.workDir == null ? null : r.workDir.toString());
    n.put("status", r.status.name());
    n.put("message", r.message);
    n.put("resultFile", r.resultFile == null ? null : r.resultFile.toString());
    n.put("resultContentType", r.resultContentType);
    n.put("resultFilename", r.resultFilename);
    n.put("total", r.total);
    n.put("completed", r.completed.get());
    n.put("failed", r.failed.get());
    n.put("createdAt", r.createdAt.toString());
    n.put("updatedAt", r.updatedAt.toString());
    return json.writeValueAsString(n);
  }

  private PdfJobRecord fromJson(String raw) throws Exception {
    var n = json.readTree(raw);
    Path workDir = Path.of(n.path("workDir").asText("."));
    PdfJobRecord r = new PdfJobRecord(
        n.path("jobId").asText(),
        n.path("operation").asText(),
        workDir,
        n.path("total").asInt(0)
    );
    r.status = PdfJobStatus.valueOf(n.path("status").asText("QUEUED"));
    r.message = n.path("message").asText("");
    String result = n.path("resultFile").asText(null);
    if (result != null && !result.isBlank()) {
      r.resultFile = Path.of(result);
    }
    r.resultContentType = n.path("resultContentType").asText("application/octet-stream");
    r.resultFilename = n.path("resultFilename").asText("download.bin");
    r.completed.set(n.path("completed").asInt(0));
    r.failed.set(n.path("failed").asInt(0));
    r.updatedAt = Instant.parse(n.path("updatedAt").asText(Instant.now().toString()));
    return r;
  }
}
