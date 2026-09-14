package com.easytoolhub.pdf.engine.qpdf;

import com.easytoolhub.pdf.config.PdfProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

/**
 * qpdf helpers. Prefer PDFBox for encrypt/decrypt (memory-only, no passwords on argv).
 * This engine is used for linearize and optional decrypt via a password file inside the job dir.
 */
@Component
public class QpdfEngine {
  private static final Set<PosixFilePermission> OWNER_RW =
      PosixFilePermissions.fromString("rw-------");

  private final PdfProperties props;

  public QpdfEngine(PdfProperties props) {
    this.props = props;
  }

  public boolean isAvailable() {
    try {
      Process p = new ProcessBuilder(props.qpdfBin(), "--version").redirectErrorStream(true).start();
      boolean finished = p.waitFor(5, TimeUnit.SECONDS);
      return finished && p.exitValue() == 0;
    } catch (Exception e) {
      return false;
    }
  }

  /**
   * @deprecated Prefer PDFBox encrypt (no disk / no password argv). Kept for emergency tooling.
   */
  @Deprecated
  public byte[] encrypt(
      Path input,
      Path output,
      String userPassword,
      String ownerPassword,
      boolean allowPrint,
      boolean allowModify
  ) throws IOException, InterruptedException {
    // Still avoid putting passwords on argv when possible by using PDFBox instead.
    throw new UnsupportedOperationException(
        "qpdf encrypt is disabled for security (passwords would appear on process argv). Use PDFBox encrypt."
    );
  }

  public byte[] decrypt(Path input, Path output, String password) throws IOException, InterruptedException {
    Path passwordFile = input.getParent().resolve(".qpdf-password");
    try {
      Files.writeString(passwordFile, password == null ? "" : password, StandardCharsets.UTF_8);
      try {
        Files.setPosixFilePermissions(passwordFile, OWNER_RW);
      } catch (UnsupportedOperationException ignored) {
        // non-POSIX
      }
      List<String> cmd = List.of(
          props.qpdfBin(),
          "--password-file=" + passwordFile.toAbsolutePath(),
          "--decrypt",
          input.toAbsolutePath().toString(),
          output.toAbsolutePath().toString()
      );
      return run(cmd, output);
    } finally {
      try {
        if (Files.exists(passwordFile)) {
          Files.writeString(passwordFile, "\0".repeat(64), StandardCharsets.UTF_8);
          Files.deleteIfExists(passwordFile);
        }
      } catch (IOException ignored) {
        // best effort
      }
    }
  }

  public byte[] linearize(Path input, Path output) throws IOException, InterruptedException {
    List<String> cmd = List.of(
        props.qpdfBin(),
        "--linearize",
        input.toAbsolutePath().toString(),
        output.toAbsolutePath().toString()
    );
    return run(cmd, output);
  }

  private byte[] run(List<String> cmd, Path output) throws IOException, InterruptedException {
    ProcessBuilder pb = new ProcessBuilder(cmd);
    pb.redirectErrorStream(true);
    Process process = pb.start();
    String logs = new String(process.getInputStream().readAllBytes());
    boolean finished = process.waitFor(60, TimeUnit.SECONDS);
    if (!finished) {
      process.destroyForcibly();
      throw new IllegalStateException("qpdf timed out");
    }
    int code = process.exitValue();
    // qpdf uses exit code 3 for success-with-warnings
    if (!Files.exists(output) || (code != 0 && code != 3)) {
      throw new IllegalStateException("qpdf failed: " + sanitizeLogs(logs));
    }
    return Files.readAllBytes(output);
  }

  private static String sanitizeLogs(String logs) {
    if (logs == null) return "";
    return logs.replaceAll("(?i)password[=:].*", "password=[redacted]");
  }
}
