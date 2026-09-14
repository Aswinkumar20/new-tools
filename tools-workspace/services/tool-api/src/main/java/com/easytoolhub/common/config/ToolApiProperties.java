package com.easytoolhub.common.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Shared settings for the whole tool-api (all domains). */
@ConfigurationProperties(prefix = "app")
public record ToolApiProperties(
    String tempDir,
    int jobTtlMinutes,
    String corsOrigins,
    /** Max in-memory async jobs retained (completed + running). */
    int maxStoredJobs,
    /** Per-IP write requests per minute (POST/PUT/PATCH/DELETE under /api/). */
    int rateLimitPerMinute,
    /**
     * Job status store: {@code memory} (default) or {@code redis} for multi-replica Stage 1.
     * Redis mode still requires a shared {@code APP_TEMP_DIR} volume for result files.
     */
    String jobStore
) {
  public List<String> corsOriginList() {
    return Arrays.stream(corsOrigins.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .toList();
  }

  public boolean redisJobStore() {
    return "redis".equalsIgnoreCase(jobStore == null ? "memory" : jobStore.trim());
  }
}
