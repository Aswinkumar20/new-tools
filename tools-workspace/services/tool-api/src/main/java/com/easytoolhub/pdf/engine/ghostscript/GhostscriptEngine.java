package com.easytoolhub.pdf.engine.ghostscript;

import com.easytoolhub.pdf.config.PdfProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

@Component
public class GhostscriptEngine {
  private final PdfProperties props;

  public GhostscriptEngine(PdfProperties props) {
    this.props = props;
  }

  public boolean isAvailable() {
    try {
      Process p = new ProcessBuilder(props.gsBin(), "-v").redirectErrorStream(true).start();
      boolean finished = p.waitFor(5, TimeUnit.SECONDS);
      return finished && p.exitValue() == 0;
    } catch (Exception e) {
      return false;
    }
  }

  public byte[] compress(Path input, Path output, String quality) throws IOException, InterruptedException {
    String preset = switch (quality == null ? "medium" : quality.toLowerCase()) {
      case "low" -> "/screen";
      case "high" -> "/printer";
      default -> "/ebook";
    };

    List<String> cmd = new ArrayList<>();
    cmd.add(props.gsBin());
    cmd.add("-sDEVICE=pdfwrite");
    cmd.add("-dCompatibilityLevel=1.4");
    cmd.add("-dPDFSETTINGS=" + preset);
    cmd.add("-dNOPAUSE");
    cmd.add("-dQUIET");
    cmd.add("-dBATCH");
    cmd.add("-sOutputFile=" + output.toAbsolutePath());
    cmd.add(input.toAbsolutePath().toString());
    return run(cmd, output, "Ghostscript compress failed");
  }

  public byte[] toPdfA(Path input, Path output) throws IOException, InterruptedException {
    List<String> cmd = new ArrayList<>();
    cmd.add(props.gsBin());
    cmd.add("-dPDFA=2");
    cmd.add("-dBATCH");
    cmd.add("-dNOPAUSE");
    cmd.add("-dQUIET");
    cmd.add("-sColorConversionStrategy=RGB");
    cmd.add("-sDEVICE=pdfwrite");
    cmd.add("-dPDFACompatibilityPolicy=1");
    cmd.add("-sOutputFile=" + output.toAbsolutePath());
    cmd.add(input.toAbsolutePath().toString());
    return run(cmd, output, "Ghostscript PDF/A conversion failed");
  }

  private byte[] run(List<String> cmd, Path output, String failMessage)
      throws IOException, InterruptedException {
    ProcessBuilder pb = new ProcessBuilder(cmd);
    pb.redirectErrorStream(true);
    Process process = pb.start();
    String logs = new String(process.getInputStream().readAllBytes());
    boolean finished = process.waitFor(120, TimeUnit.SECONDS);
    if (!finished) {
      process.destroyForcibly();
      throw new IllegalStateException("Ghostscript timed out");
    }
    if (process.exitValue() != 0 || !Files.exists(output)) {
      throw new IllegalStateException(failMessage + ": " + logs);
    }
    return Files.readAllBytes(output);
  }
}
