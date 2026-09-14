package com.easytoolhub.pdf.platform;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.web.multipart.MultipartFile;

/** Shared upload validation for scalable, fail-closed PDF handling. */
public final class PdfIoGuard {
  private PdfIoGuard() {}

  public static void requireNonEmpty(MultipartFile file, String label) {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException((label == null ? "File" : label) + " is required");
    }
  }

  public static void assertPdfMagic(byte[] bytes) {
    if (bytes == null || bytes.length < 5
        || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F') {
      throw new IllegalArgumentException("File is not a valid PDF");
    }
  }

  public static void assertPdfMagic(Path path) throws IOException {
    if (path == null || !Files.isRegularFile(path) || Files.size(path) < 5) {
      throw new IllegalArgumentException("File is not a valid PDF");
    }
    byte[] head = new byte[5];
    try (InputStream in = Files.newInputStream(path)) {
      int n = in.read(head);
      if (n < 5) {
        throw new IllegalArgumentException("File is not a valid PDF");
      }
    }
    assertPdfMagic(head);
  }

  public static void assertPdfMagic(MultipartFile file) throws IOException {
    requireNonEmpty(file, "PDF");
    try (InputStream in = file.getInputStream()) {
      byte[] head = in.readNBytes(5);
      assertPdfMagic(head);
    }
  }

  /** Peek ZIP local-file magic (PK\\x03\\x04 or PK\\x05\\x06) without loading the body. */
  public static boolean looksLikeZip(MultipartFile file) throws IOException {
    if (file == null || file.isEmpty()) {
      return false;
    }
    String name = file.getOriginalFilename();
    if (name != null && name.toLowerCase().endsWith(".zip")) {
      return true;
    }
    String ct = file.getContentType();
    if (ct != null && (ct.contains("zip") || ct.contains("compressed"))) {
      return true;
    }
    try (InputStream in = file.getInputStream()) {
      byte[] head = in.readNBytes(4);
      return head.length >= 2 && head[0] == 'P' && head[1] == 'K';
    }
  }

  public static void assertPageLimit(PDDocument doc, int maxPages) {
    if (doc == null) {
      return;
    }
    if (maxPages <= 0) {
      throw new IllegalArgumentException("Invalid max pages limit");
    }
    int pages = doc.getNumberOfPages();
    if (pages > maxPages) {
      throw new IllegalArgumentException("PDF has " + pages + " pages (max allowed " + maxPages + ")");
    }
  }

  public static int countPages(byte[] bytes, int maxPages) throws IOException {
    assertPdfMagic(bytes);
    try (PDDocument doc = Loader.loadPDF(bytes)) {
      assertPageLimit(doc, maxPages);
      return doc.getNumberOfPages();
    }
  }

  public static int countPages(Path path, int maxPages) throws IOException {
    assertPdfMagic(path);
    try (PDDocument doc = Loader.loadPDF(path.toFile(), IOUtils.createTempFileOnlyStreamCache())) {
      assertPageLimit(doc, maxPages);
      return doc.getNumberOfPages();
    }
  }
}
