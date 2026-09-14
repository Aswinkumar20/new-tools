package com.easytoolhub.pdf.engine.chromium;

import com.easytoolhub.pdf.config.PdfProperties;
import com.easytoolhub.pdf.platform.UrlSafety;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

/** Headless Chromium print-to-PDF for public http(s) URLs. */
@Component
public class ChromiumPdfEngine {
  private final PdfProperties props;

  public ChromiumPdfEngine(PdfProperties props) {
    this.props = props;
  }

  public boolean isAvailable() {
    return resolveBinary() != null;
  }

  public byte[] urlToPdf(String rawUrl, Path outDir) throws IOException, InterruptedException {
    URI uri = UrlSafety.requireSafeHttpUrl(rawUrl);
    String bin = resolveBinary();
    if (bin == null) {
      throw new IllegalStateException(
          "Chromium is not installed. Install Chromium/Chrome or set CHROMIUM_BIN."
      );
    }
    Files.createDirectories(outDir);
    Path out = outDir.resolve("page.pdf");
    List<String> cmd = new ArrayList<>();
    cmd.add(bin);
    cmd.add("--headless=new");
    cmd.add("--disable-gpu");
    cmd.add("--no-sandbox");
    cmd.add("--disable-dev-shm-usage");
    cmd.add("--hide-scrollbars");
    cmd.add("--print-to-pdf-no-header");
    cmd.add("--print-to-pdf=" + out.toAbsolutePath());
    cmd.add(uri.toString());

    ProcessBuilder pb = new ProcessBuilder(cmd);
    pb.directory(outDir.toFile());
    pb.redirectErrorStream(true);
    Process process = pb.start();
    String logs = new String(process.getInputStream().readAllBytes());
    boolean finished = process.waitFor(90, TimeUnit.SECONDS);
    if (!finished) {
      process.destroyForcibly();
      throw new IllegalStateException("URL to PDF timed out");
    }
    if (!Files.exists(out) || Files.size(out) == 0) {
      throw new IllegalStateException("Chromium did not produce a PDF. " + sanitize(logs));
    }
    if (process.exitValue() != 0 && Files.size(out) == 0) {
      throw new IllegalStateException("Chromium failed: " + sanitize(logs));
    }
    return Files.readAllBytes(out);
  }

  private String resolveBinary() {
    String configured = props.chromiumBin();
    if (configured != null && !configured.isBlank() && canRun(configured.trim())) {
      return configured.trim();
    }
    for (String candidate : List.of(
        "chromium-browser", "chromium", "google-chrome", "google-chrome-stable", "chrome"
    )) {
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

  private static String sanitize(String logs) {
    if (logs == null) return "";
    String s = logs.replaceAll("(?i)(password|token|authorization)[=:].*", "$1=[redacted]");
    return s.length() > 240 ? s.substring(0, 240) : s;
  }
}
