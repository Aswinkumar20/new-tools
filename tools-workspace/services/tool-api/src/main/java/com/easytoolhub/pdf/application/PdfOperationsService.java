package com.easytoolhub.pdf.application;

import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.pdf.config.PdfProperties;
import com.easytoolhub.pdf.engine.ghostscript.GhostscriptEngine;
import com.easytoolhub.pdf.engine.pdfbox.HtmlPdfEngine;
import com.easytoolhub.pdf.engine.pdfbox.PdfBoxEngine;
import com.easytoolhub.pdf.engine.qpdf.QpdfEngine;
import com.easytoolhub.pdf.platform.PdfIoGuard;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.io.RandomAccessRead;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.io.RandomAccessReadBufferedFile;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfOperationsService {
  private final PdfBoxEngine pdfBox;
  private final QpdfEngine qpdf;
  private final GhostscriptEngine gs;
  private final HtmlPdfEngine htmlPdf;
  private final TempWorkspace temp;
  private final PdfProperties props;

  public PdfOperationsService(
      PdfBoxEngine pdfBox,
      QpdfEngine qpdf,
      GhostscriptEngine gs,
      HtmlPdfEngine htmlPdf,
      TempWorkspace temp,
      PdfProperties props
  ) {
    this.pdfBox = pdfBox;
    this.qpdf = qpdf;
    this.gs = gs;
    this.htmlPdf = htmlPdf;
    this.temp = temp;
    this.props = props;
  }

  public byte[] encrypt(
      MultipartFile file,
      String userPassword,
      String ownerPassword,
      boolean allowPrint,
      boolean allowModify
  ) throws Exception {
    requireFile(file);
    requireText(userPassword, "userPassword");
    // Memory-only: never write the upload or passwords to disk for encryption.
    return pdfBox.encrypt(file, userPassword, ownerPassword, allowPrint, allowModify);
  }

  public byte[] decrypt(MultipartFile file, String password) throws Exception {
    requireFile(file);
    requireText(password, "password");
    // Memory-only: never write the upload or password to disk for decryption.
    return pdfBox.decrypt(file, password);
  }

  public byte[] compress(MultipartFile file, String quality) throws Exception {
    requireFile(file);
    if (!gs.isAvailable()) {
      // Memory-only fallback — no ephemeral disk write.
      try (var doc = pdfBox.load(file, null)) {
        return pdfBox.save(doc);
      }
    }
    Path job = temp.createJobDir("pdf");
    try {
      Path in = temp.saveUploadAs(job, file, "in.pdf");
      Path out = job.resolve("out.pdf");
      byte[] compressed = gs.compress(in, out, quality);
      if (qpdf.isAvailable()) {
        Path linear = job.resolve("linear.pdf");
        return qpdf.linearize(out, linear);
      }
      return compressed;
    } finally {
      temp.deleteQuietly(job);
    }
  }

  public boolean shouldUseLargeMergePath(List<MultipartFile> files) {
    if (files == null || files.isEmpty()) {
      return false;
    }
    if (files.size() >= Math.max(2, props.largeMergeMinFiles())) {
      return true;
    }
    long total = 0;
    for (MultipartFile f : files) {
      if (f != null) {
        total += Math.max(0, f.getSize());
      }
    }
    return total >= Math.max(1L, props.largeFileThresholdBytes());
  }

  public boolean shouldUseLargeSplitPath(MultipartFile file) {
    return file != null && file.getSize() >= Math.max(1L, props.largeFileThresholdBytes());
  }

  public byte[] merge(List<MultipartFile> files) throws Exception {
    if (files == null || files.size() < 2) {
      throw new IllegalArgumentException("Provide at least 2 PDF files to merge");
    }
    if (shouldUseLargeMergePath(files)) {
      return mergeWithScratch(files);
    }
    return mergeInMemory(files);
  }

  /** Always use scratch-file stream cache (Slice 7 large-file path). */
  public byte[] mergeWithScratch(List<MultipartFile> files) throws Exception {
    if (files == null || files.size() < 2) {
      throw new IllegalArgumentException("Provide at least 2 PDF files to merge");
    }
    Path job = temp.createJobDir("pdf");
    List<Path> paths = new ArrayList<>();
    try {
      int i = 0;
      for (MultipartFile file : files) {
        requireFile(file);
        PdfIoGuard.assertPdfMagic(file);
        Path in = temp.saveUploadAs(job, file, "in-" + (++i) + ".pdf");
        paths.add(in);
      }
      Path out = job.resolve("merged.pdf");
      mergePathsTo(paths, out);
      return Files.readAllBytes(out);
    } finally {
      temp.deleteQuietly(job);
    }
  }

  /**
   * Disk-native merge: opens each input path with a buffered file reader and a temp-file
   * stream cache — avoids loading every PDF into heap (scalable large-merge path).
   */
  public void mergePathsTo(List<Path> inputs, Path output) throws Exception {
    if (inputs == null || inputs.size() < 2) {
      throw new IllegalArgumentException("Provide at least 2 PDF files to merge");
    }
    if (output == null) {
      throw new IllegalArgumentException("Output path is required");
    }
    List<RandomAccessRead> sources = new ArrayList<>();
    try {
      PDFMergerUtility merger = new PDFMergerUtility();
      int totalPages = 0;
      for (Path in : inputs) {
        PdfIoGuard.assertPdfMagic(in);
        int pages = PdfIoGuard.countPages(in, props.maxPages());
        totalPages += pages;
        if (totalPages > props.maxPages()) {
          throw new IllegalArgumentException(
              "Merged PDF would exceed max pages (" + props.maxPages() + ")");
        }
        RandomAccessRead source = new RandomAccessReadBufferedFile(in);
        sources.add(source);
        merger.addSource(source);
      }
      Files.createDirectories(output.getParent());
      try (OutputStream os = Files.newOutputStream(output)) {
        merger.setDestinationStream(os);
        merger.mergeDocuments(IOUtils.createTempFileOnlyStreamCache());
      }
    } finally {
      for (RandomAccessRead source : sources) {
        try {
          source.close();
        } catch (Exception ignored) {
          // best effort
        }
      }
    }
  }

  private byte[] mergeInMemory(List<MultipartFile> files) throws Exception {
    PDFMergerUtility merger = new PDFMergerUtility();
    List<RandomAccessRead> sources = new ArrayList<>();
    try {
      int totalPages = 0;
      for (MultipartFile file : files) {
        requireFile(file);
        byte[] bytes = file.getBytes();
        PdfIoGuard.assertPdfMagic(bytes);
        totalPages += PdfIoGuard.countPages(bytes, props.maxPages());
        if (totalPages > props.maxPages()) {
          throw new IllegalArgumentException(
              "Merged PDF would exceed max pages (" + props.maxPages() + ")");
        }
        RandomAccessReadBuffer source = new RandomAccessReadBuffer(bytes);
        sources.add(source);
        merger.addSource(source);
      }
      java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
      merger.setDestinationStream(bos);
      merger.mergeDocuments(IOUtils.createMemoryOnlyStreamCache());
      return bos.toByteArray();
    } finally {
      for (RandomAccessRead source : sources) {
        try {
          source.close();
        } catch (Exception ignored) {
          // best effort
        }
      }
    }
  }

  public byte[] extract(MultipartFile file, String pages) throws Exception {
    return pdfBox.extractPages(file, parsePages(pages));
  }

  public byte[] delete(MultipartFile file, String pages) throws Exception {
    return pdfBox.deletePages(file, parsePages(pages));
  }

  public byte[] rotate(MultipartFile file, String pages, int degrees) throws Exception {
    List<Integer> pageList = (pages == null || pages.isBlank()) ? List.of() : parsePages(pages);
    return pdfBox.rotatePages(file, pageList, degrees);
  }

  public byte[] reorder(MultipartFile file, String order) throws Exception {
    return pdfBox.reorderPages(file, parsePages(order));
  }

  public byte[] watermark(MultipartFile file, String text, float opacity) throws Exception {
    requireText(text, "text");
    return pdfBox.addWatermark(file, text, opacity);
  }

  public byte[] pageNumbers(MultipartFile file, int startAt) throws Exception {
    return pdfBox.addPageNumbers(file, startAt);
  }

  public byte[] metadata(
      MultipartFile file,
      String title,
      String author,
      String subject,
      String keywords
  ) throws Exception {
    return pdfBox.setMetadata(file, title, author, subject, keywords);
  }

  public byte[] htmlToPdf(String html) throws Exception {
    requireText(html, "html");
    return htmlPdf.htmlToPdf(html);
  }

  public byte[] textToPdf(String text) throws Exception {
    requireText(text, "text");
    return pdfBox.textToPdf(text);
  }

  public byte[] imagesToPdf(List<MultipartFile> images) throws Exception {
    if (images == null || images.isEmpty()) {
      throw new IllegalArgumentException("Provide at least one image");
    }
    return pdfBox.imagesToPdf(images);
  }

  public byte[] pdfToImages(MultipartFile file, int dpi) throws Exception {
    return pdfBox.renderPagesZip(file, dpi);
  }

  public byte[] pdfToText(MultipartFile file) throws Exception {
    return pdfBox.extractText(file).getBytes(java.nio.charset.StandardCharsets.UTF_8);
  }

  public byte[] split(MultipartFile file, String ranges, String prefix) throws Exception {
    requireFile(file);
    PdfIoGuard.assertPdfMagic(file);
    List<String> specs = Arrays.stream((ranges == null ? "" : ranges).split(";"))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .toList();
    if (specs.isEmpty()) {
      throw new IllegalArgumentException("Provide at least one page range (e.g. 1-3;4-6)");
    }
    if (specs.size() > 100) {
      throw new IllegalArgumentException("Too many split ranges (max 100)");
    }
    if (shouldUseLargeSplitPath(file)) {
      return splitWithScratch(file, specs, prefix);
    }
    byte[] bytes = file.getBytes();
    PdfIoGuard.countPages(bytes, props.maxPages());
    return pdfBox.splitToZip(bytes, specs, prefix);
  }

  /** Large-file split: spill upload to disk, validate pages, then split. */
  public byte[] splitWithScratch(MultipartFile file, List<String> specs, String prefix) throws Exception {
    requireFile(file);
    Path job = temp.createJobDir("pdf");
    try {
      Path in = temp.saveUploadAs(job, file, "in.pdf");
      PdfIoGuard.countPages(in, props.maxPages());
      byte[] bytes = Files.readAllBytes(in);
      return pdfBox.splitToZip(bytes, specs, prefix);
    } finally {
      temp.deleteQuietly(job);
    }
  }

  public byte[] fillForm(MultipartFile file, String fieldsJson) throws Exception {
    requireFile(file);
    java.util.Map<String, String> values = new java.util.LinkedHashMap<>();
    if (fieldsJson != null && !fieldsJson.isBlank()) {
      var root = new com.fasterxml.jackson.databind.ObjectMapper().readTree(fieldsJson);
      root.fields().forEachRemaining(e -> values.put(e.getKey(), e.getValue().asText("")));
    }
    return pdfBox.fillFormFields(file.getBytes(), values);
  }

  public byte[] flattenForm(MultipartFile file) throws Exception {
    return pdfBox.flattenForm(file.getBytes());
  }

  public byte[] annotate(MultipartFile file, String annotationsJson) throws Exception {
    return pdfBox.applyAnnotations(file.getBytes(), annotationsJson);
  }

  public byte[] stampImage(
      MultipartFile file,
      MultipartFile image,
      int page,
      float x,
      float y,
      float width,
      float height
  ) throws Exception {
    requireFile(file);
    if (image == null || image.isEmpty()) {
      throw new IllegalArgumentException("image is required");
    }
    return pdfBox.stampImage(file.getBytes(), image.getBytes(), page, x, y, width, height);
  }

  private static void requireFile(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("PDF file is required");
    }
  }

  private static void requireText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
  }

  private static List<Integer> parsePages(String pages) {
    if (pages == null || pages.isBlank()) {
      throw new IllegalArgumentException("pages is required");
    }
    return Arrays.stream(pages.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .flatMap(part -> {
          if (part.contains("-")) {
            String[] ends = part.split("-", 2);
            int a = Integer.parseInt(ends[0].trim());
            int b = Integer.parseInt(ends[1].trim());
            if (a > b) {
              int tmp = a;
              a = b;
              b = tmp;
            }
            List<Integer> range = new ArrayList<>();
            for (int i = a; i <= b; i++) {
              range.add(i);
            }
            return range.stream();
          }
          return java.util.stream.Stream.of(Integer.parseInt(part));
        })
        .toList();
  }
}
