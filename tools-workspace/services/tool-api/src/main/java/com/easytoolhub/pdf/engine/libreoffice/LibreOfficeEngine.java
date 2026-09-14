package com.easytoolhub.pdf.engine.libreoffice;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

@Component
public class LibreOfficeEngine {

  public boolean isAvailable() {
    return resolveBinary() != null;
  }

  public byte[] convertToPdf(Path input, Path outDir) throws IOException, InterruptedException {
    return convertTo(input, outDir, "pdf");
  }

  /** Convert to a LibreOffice filter target such as {@code pdf} or {@code docx}. */
  public byte[] convertTo(Path input, Path outDir, String format)
      throws IOException, InterruptedException {
    String bin = resolveBinary();
    if (bin == null) {
      throw new IllegalStateException(
          "LibreOffice is not installed. Install LibreOffice and ensure `soffice` or `libreoffice` is on PATH."
      );
    }
    String target = format == null || format.isBlank() ? "pdf" : format.trim().toLowerCase(Locale.ROOT);
    Files.createDirectories(outDir);
    Path profile = outDir.resolve("lo-profile");
    Files.createDirectories(profile);
    String userInstallation = "file://" + profile.toAbsolutePath();

    List<String> cmd = new ArrayList<>();
    cmd.add(bin);
    cmd.add("--headless");
    cmd.add("--nologo");
    cmd.add("--nofirststartwizard");
    cmd.add("-env:UserInstallation=" + userInstallation);
    cmd.add("--convert-to");
    cmd.add(target);
    cmd.add("--outdir");
    cmd.add(outDir.toAbsolutePath().toString());
    cmd.add(input.toAbsolutePath().toString());

    ProcessBuilder pb = new ProcessBuilder(cmd);
    pb.directory(outDir.toFile());
    pb.redirectErrorStream(true);
    Process process = pb.start();
    String logs = new String(process.getInputStream().readAllBytes());
    boolean finished = process.waitFor(180, TimeUnit.SECONDS);
    if (!finished) {
      process.destroyForcibly();
      throw new IllegalStateException("LibreOffice conversion timed out");
    }
    if (process.exitValue() != 0) {
      throw new IllegalStateException("LibreOffice conversion failed: " + logs);
    }

    String base = stripExtension(input.getFileName().toString());
    Path expected = outDir.resolve(base + "." + target);
    if (Files.exists(expected)) {
      return Files.readAllBytes(expected);
    }
    String suffix = "." + target;
    try (Stream<Path> stream = Files.list(outDir)) {
      Path found = stream
          .filter(p -> p.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(suffix))
          .max(Comparator.comparingLong(p -> p.toFile().lastModified()))
          .orElseThrow(() -> new IllegalStateException(
              "LibreOffice did not produce a ." + target + " file. Logs: " + logs
          ));
      return Files.readAllBytes(found);
    }
  }

  private static String resolveBinary() {
    String env = System.getenv("LIBREOFFICE_BIN");
    if (env != null && !env.isBlank() && canRun(env.trim())) {
      return env.trim();
    }
    for (String candidate : List.of("soffice", "libreoffice")) {
      if (canRun(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private static boolean canRun(String bin) {
    try {
      Process p = new ProcessBuilder(bin, "--version").redirectErrorStream(true).start();
      boolean finished = p.waitFor(5, TimeUnit.SECONDS);
      return finished && p.exitValue() == 0;
    } catch (Exception e) {
      return false;
    }
  }

  private static String stripExtension(String name) {
    int dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(0, dot) : name;
  }
}
