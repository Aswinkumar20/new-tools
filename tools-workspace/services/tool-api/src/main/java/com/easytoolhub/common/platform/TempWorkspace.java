package com.easytoolhub.common.platform;

import com.easytoolhub.common.config.ToolApiProperties;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.Comparator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * Ephemeral job directories only. Uploads are never kept after the request:
 * each job is deleted in {@code finally}, with a TTL sweeper as a safety net.
 * No permanent upload store exists.
 */
@Component
public class TempWorkspace {
  private static final Logger log = LoggerFactory.getLogger(TempWorkspace.class);
  private static final Set<PosixFilePermission> OWNER_ONLY =
      PosixFilePermissions.fromString("rwx------");

  private final ToolApiProperties props;

  public TempWorkspace(ToolApiProperties props) {
    this.props = props;
  }

  @PostConstruct
  void ensureRoot() throws IOException {
    Path root = Path.of(props.tempDir());
    Files.createDirectories(root);
    trySetOwnerOnly(root);
    Path multipart = root.resolve("multipart");
    Files.createDirectories(multipart);
    trySetOwnerOnly(multipart);
  }

  public Path createJobDir() throws IOException {
    return createJobDir("jobs");
  }

  public Path createJobDir(String domain) throws IOException {
    Path root = Path.of(props.tempDir()).resolve(domain == null || domain.isBlank() ? "jobs" : domain);
    Files.createDirectories(root);
    trySetOwnerOnly(root);
    Path job = root.resolve(UUID.randomUUID().toString());
    Files.createDirectories(job);
    trySetOwnerOnly(job);
    return job;
  }

  /**
   * Saves an upload under a fixed safe name inside {@code jobDir}.
   * Original client filenames are never used as path segments (path-traversal safe).
   */
  public Path saveUpload(Path jobDir, MultipartFile file, String preferredName) throws IOException {
    String safe = sanitizeFileName(preferredName);
    Path target = jobDir.resolve(safe).normalize();
    if (!target.startsWith(jobDir.normalize())) {
      throw new IOException("Refusing to write upload outside job directory");
    }
    file.transferTo(target);
    trySetOwnerOnly(target);
    return target;
  }

  /** Fixed-name save for PDF pipelines (never uses client filename). */
  public Path saveUploadAs(Path jobDir, MultipartFile file, String fixedName) throws IOException {
    return saveUpload(jobDir, file, fixedName);
  }

  public Path writeBytes(Path jobDir, String fixedName, byte[] bytes) throws IOException {
    String safe = sanitizeFileName(fixedName);
    Path target = jobDir.resolve(safe).normalize();
    if (!target.startsWith(jobDir.normalize())) {
      throw new IOException("Refusing to write outside job directory");
    }
    Files.write(target, bytes);
    trySetOwnerOnly(target);
    return target;
  }

  public void deleteQuietly(Path jobDir) {
    if (jobDir == null || !Files.exists(jobDir)) {
      return;
    }
    try (Stream<Path> walk = Files.walk(jobDir)) {
      walk.sorted(Comparator.reverseOrder()).forEach(this::secureDelete);
    } catch (IOException e) {
      log.warn("Failed to clean ephemeral job directory (will retry via TTL sweeper)");
    }
  }

  @Scheduled(fixedDelayString = "300000")
  public void cleanupExpired() {
    Path root = Path.of(props.tempDir());
    if (!Files.isDirectory(root)) {
      return;
    }
    long ttlMs = Math.max(1, props.jobTtlMinutes()) * 60_000L;
    long cutoff = Instant.now().toEpochMilli() - ttlMs;
    try (Stream<Path> children = Files.list(root)) {
      children.forEach(child -> cleanupTree(child, cutoff));
    } catch (IOException e) {
      log.warn("Ephemeral temp cleanup failed: {}", e.getMessage());
    }
  }

  private void cleanupTree(Path path, long cutoff) {
    try {
      if (Files.isDirectory(path)) {
        String name = path.getFileName().toString();
        // multipart spill + domain job dirs
        if ("multipart".equals(name)) {
          try (Stream<Path> parts = Files.list(path)) {
            parts.forEach(p -> {
              try {
                if (Files.getLastModifiedTime(p).toMillis() < cutoff) {
                  secureDelete(p);
                }
              } catch (IOException ignored) {
                // skip
              }
            });
          }
          return;
        }
        try (Stream<Path> jobs = Files.list(path)) {
          jobs.filter(Files::isDirectory).forEach(job -> {
            try {
              if (Files.getLastModifiedTime(job).toMillis() < cutoff) {
                deleteQuietly(job);
              }
            } catch (IOException ignored) {
              // skip
            }
          });
        }
      }
    } catch (IOException e) {
      log.warn("Ephemeral temp cleanup failed under {}: {}", path.getFileName(), e.getMessage());
    }
  }

  private void secureDelete(Path path) {
    try {
      if (Files.isRegularFile(path)) {
        wipeFile(path);
      }
      Files.deleteIfExists(path);
    } catch (IOException ignored) {
      // best effort — TTL sweeper retries
    }
  }

  private static void wipeFile(Path path) {
    try {
      long size = Files.size(path);
      if (size <= 0 || size > 200_000_000L) {
        return;
      }
      byte[] zeros = new byte[8192];
      try (FileChannel channel = FileChannel.open(path, StandardOpenOption.WRITE)) {
        long remaining = size;
        while (remaining > 0) {
          int n = (int) Math.min(zeros.length, remaining);
          channel.write(ByteBuffer.wrap(zeros, 0, n));
          remaining -= n;
        }
        channel.force(true);
      }
    } catch (IOException ignored) {
      // best effort
    }
  }

  static String sanitizeFileName(String name) {
    if (name == null || name.isBlank()) {
      return "upload.bin";
    }
    String base = Path.of(name).getFileName().toString();
    base = base.replaceAll("[^a-zA-Z0-9._-]", "_");
    if (base.isBlank() || base.equals(".") || base.equals("..")) {
      return "upload.bin";
    }
    if (base.length() > 80) {
      int dot = base.lastIndexOf('.');
      String ext = dot > 0 ? base.substring(dot) : "";
      base = base.substring(0, Math.min(60, base.length())) + ext;
    }
    return base.toLowerCase(Locale.ROOT);
  }

  private static void trySetOwnerOnly(Path path) {
    try {
      Files.setPosixFilePermissions(path, OWNER_ONLY);
    } catch (UnsupportedOperationException | IOException ignored) {
      // non-POSIX filesystems (e.g. some CI) — skip
    }
  }
}
