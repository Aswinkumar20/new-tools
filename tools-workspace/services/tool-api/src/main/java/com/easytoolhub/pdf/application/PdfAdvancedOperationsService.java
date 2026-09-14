package com.easytoolhub.pdf.application;

import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.pdf.engine.chromium.ChromiumPdfEngine;
import com.easytoolhub.pdf.engine.docx.DocxExportEngine;
import com.easytoolhub.pdf.engine.ghostscript.GhostscriptEngine;
import com.easytoolhub.pdf.engine.libreoffice.LibreOfficeEngine;
import com.easytoolhub.pdf.engine.ocr.OcrEngine;
import com.easytoolhub.pdf.engine.pdfbox.HtmlPdfEngine;
import com.easytoolhub.pdf.engine.pdfbox.PdfBoxEngine;
import com.easytoolhub.pdf.engine.qpdf.QpdfEngine;
import com.easytoolhub.pdf.engine.scan.ScanCleanupEngine;
import com.easytoolhub.pdf.engine.signature.Pkcs12SignatureEngine;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.rendering.ImageType;
import org.commonmark.node.Node;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class PdfAdvancedOperationsService {
  private static final Pattern EMAIL = Pattern.compile(
      "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", Pattern.CASE_INSENSITIVE);
  private static final Pattern PHONE = Pattern.compile(
      "(?:\\+?\\d{1,3}[\\s.-]?)?(?:\\(?\\d{3}\\)?[\\s.-]?)\\d{3}[\\s.-]?\\d{4}");
  private static final Pattern SSN = Pattern.compile("\\b\\d{3}-\\d{2}-\\d{4}\\b");
  private static final Pattern CARD = Pattern.compile("\\b(?:\\d[ -]*?){13,19}\\b");
  private static final Pattern URL = Pattern.compile(
      "https?://[\\w./?=&%#+-]+", Pattern.CASE_INSENSITIVE);
  private static final Pattern AMOUNT = Pattern.compile(
      "\\$?\\b\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?\\b|\\b\\d+\\.\\d{2}\\b");
  private static final Pattern DATE = Pattern.compile(
      "\\b(?:\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2},?\\s+\\d{4})\\b",
      Pattern.CASE_INSENSITIVE);
  private static final Pattern INVOICE_ID = Pattern.compile(
      "(?i)\\b(?:invoice|inv)[#:\\s-]*([A-Z0-9-]{4,})");
  private static final Set<String> STOPWORDS = Set.of(
      "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "was",
      "were", "be", "this", "that", "it", "as", "by", "from", "at", "we", "you", "your", "our",
      "their", "not", "can", "will", "have", "has", "had", "but", "if", "than", "then", "into"
  );

  private final PdfBoxEngine pdfBox;
  private final GhostscriptEngine gs;
  private final QpdfEngine qpdf;
  private final LibreOfficeEngine libreOffice;
  private final PdfOperationsService basicOps;
  private final OcrEngine ocr;
  private final Pkcs12SignatureEngine pkcs12;
  private final ChromiumPdfEngine chromium;
  private final DocxExportEngine docx;
  private final HtmlPdfEngine htmlPdf;
  private final ScanCleanupEngine scanCleanup;
  private final TempWorkspace temp;
  private final ObjectMapper json;

  public PdfAdvancedOperationsService(
      PdfBoxEngine pdfBox,
      GhostscriptEngine gs,
      QpdfEngine qpdf,
      LibreOfficeEngine libreOffice,
      PdfOperationsService basicOps,
      OcrEngine ocr,
      Pkcs12SignatureEngine pkcs12,
      ChromiumPdfEngine chromium,
      DocxExportEngine docx,
      HtmlPdfEngine htmlPdf,
      ScanCleanupEngine scanCleanup,
      TempWorkspace temp,
      ObjectMapper json
  ) {
    this.pdfBox = pdfBox;
    this.gs = gs;
    this.qpdf = qpdf;
    this.libreOffice = libreOffice;
    this.basicOps = basicOps;
    this.ocr = ocr;
    this.pkcs12 = pkcs12;
    this.chromium = chromium;
    this.docx = docx;
    this.htmlPdf = htmlPdf;
    this.scanCleanup = scanCleanup;
    this.temp = temp;
    this.json = json;
  }

  public byte[] ocr(MultipartFile file, String mode, String language, int dpi) throws Exception {
    return ocr(file, mode, language, dpi, false);
  }

  public byte[] ocr(MultipartFile file, String mode, String language, int dpi, boolean deskewFirst)
      throws Exception {
    byte[] bytes = requireBytes(file);
    if (deskewFirst) {
      bytes = scanCleanup.deskew(bytes, Math.min(150, dpi <= 0 ? 150 : dpi), 10);
    }
    String m = mode == null ? "searchable" : mode.trim().toLowerCase(Locale.ROOT);
    if ("text".equals(m) || "txt".equals(m)) {
      return ocr.toText(bytes, language, dpi);
    }
    if ("docx".equals(m) || "word".equals(m)) {
      byte[] textBytes = ocr.toText(bytes, language, dpi);
      return docx.textToDocx(new String(textBytes, StandardCharsets.UTF_8));
    }
    return ocr.toSearchablePdf(bytes, language, dpi);
  }

  public byte[] deskew(MultipartFile file, int dpi, double maxDegrees) throws Exception {
    return scanCleanup.deskew(requireBytes(file), dpi, maxDegrees);
  }

  public byte[] imagesToSearchablePdf(List<MultipartFile> images, String language, int dpi)
      throws Exception {
    if (images == null || images.isEmpty()) {
      throw new IllegalArgumentException("Provide at least one image");
    }
    if (images.size() > 40) {
      throw new IllegalArgumentException("Too many images (max 40)");
    }
    byte[] pdf = basicOps.imagesToPdf(images);
    return ocr.toSearchablePdf(pdf, language, dpi);
  }

  public byte[] toTxt(MultipartFile file) throws Exception {
    // Prefer shared basic path so /to-txt and /pdf-to-text stay equivalent.
    return basicOps.pdfToText(file);
  }

  public byte[] toHtml(MultipartFile file) throws Exception {
    String text = escapeHtml(pdfBox.extractText(requireBytes(file)));
    String html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><title>PDF Export</title></head><body><pre>"
        + text + "</pre></body></html>";
    return html.getBytes(StandardCharsets.UTF_8);
  }

  public byte[] toMarkdown(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file)).trim();
    String md = "# PDF Export\n\n" + text.replace("\r\n", "\n");
    return md.getBytes(StandardCharsets.UTF_8);
  }

  public byte[] toCsv(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    StringBuilder csv = new StringBuilder("line,content\n");
    int n = 1;
    for (String line : text.split("\\R")) {
      String trimmed = line.trim();
      if (trimmed.isEmpty()) {
        continue;
      }
      if (trimmed.contains("|") || trimmed.contains("\t") || trimmed.matches(".*\\s{2,}.*")) {
        String[] cols = trimmed.split("\\s{2,}|\t|\\|");
        csv.append(n++).append(',').append(csvEscape(String.join(",", cols))).append('\n');
      } else {
        csv.append(n++).append(',').append(csvEscape(trimmed)).append('\n');
      }
    }
    return csv.toString().getBytes(StandardCharsets.UTF_8);
  }

  public byte[] toJson(MultipartFile file) throws Exception {
    byte[] bytes = requireBytes(file);
    List<String> pages = pdfBox.extractTextPerPage(bytes);
    try (PDDocument doc = pdfBox.load(bytes, null)) {
      PDDocumentInformation info = doc.getDocumentInformation();
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("pages", doc.getNumberOfPages());
      payload.put("title", info == null ? null : info.getTitle());
      payload.put("author", info == null ? null : info.getAuthor());
      payload.put("pageTexts", pages);
      payload.put("fullText", String.join("\n", pages));
      return jsonBytes(payload);
    }
  }

  public byte[] toEpub(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file)).trim();
    if (text.isBlank()) {
      text = "Empty PDF";
    }
    String xhtml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head><title>PDF Export</title></head>
        <body><h1>PDF Export</h1><pre>%s</pre></body></html>
        """.formatted(escapeHtml(text));
    String container = """
        <?xml version="1.0"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>
        """;
    String opf = """
        <?xml version="1.0" encoding="UTF-8"?>
        <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>PDF Export</dc:title>
            <dc:language>en</dc:language>
            <dc:identifier id="BookId">pdf-export</dc:identifier>
          </metadata>
          <manifest>
            <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
            <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
          </manifest>
          <spine toc="ncx"><itemref idref="chapter1"/></spine>
        </package>
        """;
    String ncx = """
        <?xml version="1.0" encoding="UTF-8"?>
        <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
          <head><meta name="dtb:uid" content="pdf-export"/></head>
          <docTitle><text>PDF Export</text></docTitle>
          <navMap><navPoint id="nav1" playOrder="1"><navLabel><text>Chapter 1</text></navLabel>
          <content src="chapter1.xhtml"/></navPoint></navMap>
        </ncx>
        """;
    java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
    try (ZipOutputStream zos = new ZipOutputStream(bos)) {
      writeStored(zos, "mimetype", "application/epub+zip".getBytes(StandardCharsets.UTF_8));
      writeDeflated(zos, "META-INF/container.xml", container.getBytes(StandardCharsets.UTF_8));
      writeDeflated(zos, "OEBPS/content.opf", opf.getBytes(StandardCharsets.UTF_8));
      writeDeflated(zos, "OEBPS/toc.ncx", ncx.getBytes(StandardCharsets.UTF_8));
      writeDeflated(zos, "OEBPS/chapter1.xhtml", xhtml.getBytes(StandardCharsets.UTF_8));
    }
    return bos.toByteArray();
  }

  public byte[] toPdfA(MultipartFile file) throws Exception {
    if (!gs.isAvailable()) {
      throw new IllegalStateException(
          "PDF/A conversion requires Ghostscript. Install Ghostscript and ensure `gs` is on PATH."
      );
    }
    byte[] bytes = requireBytes(file);
    Path job = temp.createJobDir("pdf");
    try {
      Path in = temp.writeBytes(job, "in.pdf", bytes);
      Path out = job.resolve("out.pdf");
      return gs.toPdfA(in, out);
    } finally {
      temp.deleteQuietly(job);
    }
  }

  public byte[] officeToPdf(MultipartFile file) throws Exception {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("Office file is required");
    }
    if (!libreOffice.isAvailable()) {
      throw new IllegalStateException(
          "LibreOffice is not installed. Install LibreOffice and ensure `soffice` or `libreoffice` is on PATH."
      );
    }
    Path job = temp.createJobDir("pdf");
    try {
      String original = file.getOriginalFilename() == null ? "document.bin" : file.getOriginalFilename();
      String ext = "";
      int dot = original.lastIndexOf('.');
      if (dot > 0 && dot < original.length() - 1) {
        ext = original.substring(dot).replaceAll("[^a-zA-Z0-9.]", "");
      }
      if (ext.isBlank()) {
        ext = ".bin";
      }
      Path in = temp.saveUploadAs(job, file, "office-input" + ext.toLowerCase());
      return libreOffice.convertToPdf(in, job.resolve("out"));
    } finally {
      temp.deleteQuietly(job);
    }
  }

  public byte[] urlToPdf(String url) throws Exception {
    if (!chromium.isAvailable()) {
      throw new IllegalStateException(
          "URL to PDF requires Chromium. Install Chromium/Chrome or set CHROMIUM_BIN."
      );
    }
    Path job = temp.createJobDir("urlpdf");
    try {
      return chromium.urlToPdf(url, job);
    } finally {
      temp.deleteQuietly(job);
    }
  }

  public byte[] markdownToPdf(String markdown) throws Exception {
    if (markdown == null || markdown.isBlank()) {
      throw new IllegalArgumentException("Markdown content is required");
    }
    Parser parser = Parser.builder().build();
    Node document = parser.parse(markdown);
    String bodyHtml = HtmlRenderer.builder().build().render(document);
    String html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>"
        + "<style>body{font-family:DejaVu Sans,Helvetica,sans-serif;font-size:12pt;line-height:1.4;"
        + "margin:24px;color:#111} pre,code{font-family:DejaVu Sans Mono,monospace;font-size:10pt}"
        + "h1,h2,h3{margin-top:1.2em}</style></head><body>"
        + bodyHtml
        + "</body></html>";
    return htmlPdf.htmlToPdf(html);
  }

  public byte[] pdfToDocx(MultipartFile file) throws Exception {
    byte[] bytes = requireBytes(file);
    Path job = temp.createJobDir("docx");
    try {
      if (libreOffice.isAvailable()) {
        Path in = temp.writeBytes(job, "in.pdf", bytes);
        try {
          return libreOffice.convertTo(in, job.resolve("out"), "docx");
        } catch (Exception ignored) {
          // fall through to text→DOCX
        }
      }
      String text = pdfBox.extractText(bytes);
      if (text.isBlank()) {
        throw new IllegalStateException(
            "Could not convert PDF to DOCX. Install LibreOffice for best results, or use a text-based PDF."
        );
      }
      return docx.textToDocx(text);
    } finally {
      temp.deleteQuietly(job);
    }
  }

  public byte[] duplicatePages(MultipartFile file, String pages) throws Exception {
    return pdfBox.duplicatePages(requireBytes(file), parsePages(pages));
  }

  public byte[] replacePages(MultipartFile file, MultipartFile replacement, String pages) throws Exception {
    if (replacement == null || replacement.isEmpty()) {
      throw new IllegalArgumentException("replacement PDF part is required");
    }
    return pdfBox.replacePages(requireBytes(file), replacement.getBytes(), parsePages(pages));
  }

  public byte[] cropPages(MultipartFile file, float left, float right, float top, float bottom)
      throws Exception {
    return pdfBox.cropPages(requireBytes(file), left, right, top, bottom);
  }

  public byte[] resizePages(MultipartFile file, String size) throws Exception {
    return pdfBox.resizePages(requireBytes(file), size);
  }

  public byte[] headerFooter(MultipartFile file, String header, String footer) throws Exception {
    return pdfBox.headerFooter(requireBytes(file), header, footer);
  }

  public byte[] bookmarks(MultipartFile file, String outline) throws Exception {
    return pdfBox.addBookmarks(requireBytes(file), parseOutline(outline));
  }

  public byte[] tableOfContents(MultipartFile file, String outline) throws Exception {
    return pdfBox.insertTableOfContents(requireBytes(file), parseOutline(outline));
  }

  public byte[] createFormField(MultipartFile file, String fieldName, String label) throws Exception {
    return pdfBox.createFormField(requireBytes(file), fieldName, label);
  }

  public byte[] createFormFields(MultipartFile file, String fieldsJson) throws Exception {
    return pdfBox.createFormFields(requireBytes(file), fieldsJson);
  }

  public byte[] exportFormJson(MultipartFile file) throws Exception {
    return jsonBytes(pdfBox.exportFormFields(requireBytes(file)));
  }

  public byte[] exportXfdf(MultipartFile file) throws Exception {
    return pdfBox.exportXfdf(requireBytes(file));
  }

  public byte[] importFormValues(MultipartFile file, String xfdfOrJson) throws Exception {
    return pdfBox.importXfdf(requireBytes(file), xfdfOrJson);
  }

  public byte[] validateFormRequired(MultipartFile file) throws Exception {
    return jsonBytes(pdfBox.validateFormRequired(requireBytes(file)));
  }

  public byte[] removeAnnotations(MultipartFile file) throws Exception {
    return pdfBox.removeAnnotations(requireBytes(file));
  }

  public byte[] removeMetadata(MultipartFile file) throws Exception {
    return pdfBox.removeMetadata(requireBytes(file));
  }

  public byte[] removeHiddenData(MultipartFile file) throws Exception {
    return pdfBox.removeHiddenData(requireBytes(file));
  }

  public byte[] verifySignatures(MultipartFile file) throws Exception {
    return jsonBytes(pkcs12.verify(requireBytes(file)));
  }

  public byte[] stampSignature(MultipartFile file, String signerName) throws Exception {
    return pdfBox.stampSignature(requireBytes(file), signerName);
  }

  public byte[] signPkcs12(
      MultipartFile file,
      MultipartFile certificate,
      String certificatePassword,
      String reason,
      String location
  ) throws Exception {
    if (certificate == null || certificate.isEmpty()) {
      throw new IllegalArgumentException("PKCS#12 certificate (.p12/.pfx) is required");
    }
    return pkcs12.sign(
        requireBytes(file),
        certificate.getBytes(),
        certificatePassword,
        reason,
        location
    );
  }

  public byte[] inspectFonts(MultipartFile file) throws Exception {
    return jsonBytes(Map.of("fonts", pdfBox.inspectFonts(requireBytes(file))));
  }

  public byte[] extractImages(MultipartFile file) throws Exception {
    return pdfBox.extractImagesZip(requireBytes(file));
  }

  public byte[] extractLinks(MultipartFile file) throws Exception {
    return jsonBytes(Map.of("links", pdfBox.extractLinks(requireBytes(file))));
  }

  public byte[] extractAttachments(MultipartFile file) throws Exception {
    return pdfBox.extractAttachmentsZip(requireBytes(file));
  }

  public byte[] grayscale(MultipartFile file) throws Exception {
    return pdfBox.renderAsImagesPdf(requireBytes(file), 150, ImageType.GRAY);
  }

  public byte[] colorConvert(MultipartFile file, String mode) throws Exception {
    ImageType type = "gray".equalsIgnoreCase(mode) ? ImageType.GRAY : ImageType.RGB;
    return pdfBox.renderAsImagesPdf(requireBytes(file), 150, type);
  }

  public byte[] dpiConvert(MultipartFile file, int dpi) throws Exception {
    return pdfBox.renderAsImagesPdf(requireBytes(file), dpi <= 0 ? 150 : dpi, ImageType.RGB);
  }

  public byte[] webOptimize(MultipartFile file) throws Exception {
    if (!qpdf.isAvailable() && !gs.isAvailable()) {
      throw new IllegalStateException(
          "Web optimize requires qpdf and/or Ghostscript. Install them and ensure they are on PATH."
      );
    }
    byte[] bytes = requireBytes(file);
    Path job = temp.createJobDir("pdf");
    try {
      Path in = temp.writeBytes(job, "in.pdf", bytes);
      Path working = in;
      if (gs.isAvailable()) {
        byte[] compressed = gs.compress(working, job.resolve("compressed.pdf"), "medium");
        working = temp.writeBytes(job, "compressed.pdf", compressed);
        if (!qpdf.isAvailable()) {
          return compressed;
        }
      }
      if (!qpdf.isAvailable()) {
        throw new IllegalStateException("Web optimize linearize requires qpdf on PATH.");
      }
      return qpdf.linearize(working, job.resolve("out.pdf"));
    } finally {
      temp.deleteQuietly(job);
    }
  }

  public byte[] accessibilityCheck(MultipartFile file) throws Exception {
    return jsonBytes(pdfBox.accessibilityCheck(requireBytes(file)));
  }

  public byte[] validate(MultipartFile file) throws Exception {
    try {
      return jsonBytes(pdfBox.validate(requireBytes(file)));
    } catch (Exception e) {
      return jsonBytes(Map.of(
          "valid", false,
          "error", e.getMessage() == null ? "Unable to open PDF" : e.getMessage()
      ));
    }
  }

  public byte[] repair(MultipartFile file) throws Exception {
    return pdfBox.repair(requireBytes(file));
  }

  public byte[] findDuplicates(List<MultipartFile> files) throws Exception {
    requireMulti(files, 2);
    Map<String, List<String>> byHash = new LinkedHashMap<>();
    for (MultipartFile file : files) {
      byte[] bytes = requireBytes(file);
      String hash = sha256(bytes);
      byHash.computeIfAbsent(hash, k -> new ArrayList<>())
          .add(file.getOriginalFilename() == null ? "unnamed.pdf" : file.getOriginalFilename());
    }
    List<Map<String, Object>> duplicates = byHash.entrySet().stream()
        .filter(e -> e.getValue().size() > 1)
        .map(e -> Map.<String, Object>of("hash", e.getKey(), "files", e.getValue()))
        .toList();
    return jsonBytes(Map.of(
        "fileCount", files.size(),
        "uniqueHashes", byHash.size(),
        "duplicateGroups", duplicates
    ));
  }

  public byte[] search(MultipartFile file, String query) throws Exception {
    requireText(query, "query");
    String q = query.toLowerCase(Locale.ROOT);
    List<String> pages = pdfBox.extractTextPerPage(requireBytes(file));
    List<Map<String, Object>> matches = new ArrayList<>();
    for (int i = 0; i < pages.size(); i++) {
      String pageText = pages.get(i);
      if (pageText.toLowerCase(Locale.ROOT).contains(q)) {
        matches.add(Map.of(
            "page", i + 1,
            "snippet", snippet(pageText, q)
        ));
      }
    }
    return jsonBytes(Map.of("query", query, "matchCount", matches.size(), "matches", matches));
  }

  public byte[] batchRemoveMetadata(List<MultipartFile> files) throws Exception {
    requireMulti(files, 1);
    java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
    try (ZipOutputStream zos = new ZipOutputStream(bos)) {
      int i = 1;
      for (MultipartFile file : files) {
        byte[] cleaned = pdfBox.removeMetadata(requireBytes(file));
        String name = file.getOriginalFilename() == null ? "file-" + i + ".pdf" : file.getOriginalFilename();
        zos.putNextEntry(new ZipEntry(name.replaceAll("[\\\\/]+", "_")));
        zos.write(cleaned);
        zos.closeEntry();
        i++;
      }
    }
    return bos.toByteArray();
  }

  public byte[] renamePassthrough(MultipartFile file, String pattern) throws Exception {
    byte[] bytes = requireBytes(file);
    try (PDDocument doc = pdfBox.load(bytes, null)) {
      String name = file.getOriginalFilename() == null ? "document.pdf" : file.getOriginalFilename();
      String base = name.replaceAll("(?i)\\.pdf$", "");
      String outName = (pattern == null || pattern.isBlank() ? "{name}-clean-{date}.pdf" : pattern)
          .replace("{name}", base)
          .replace("{pages}", String.valueOf(doc.getNumberOfPages()))
          .replace("{date}", LocalDate.now().toString());
      if (!outName.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
        outName = outName + ".pdf";
      }
      // Filename is applied by controller via Content-Disposition; body is unchanged PDF bytes.
      return bytes;
    }
  }

  public String renamePassthroughFilename(MultipartFile file, String pattern) throws Exception {
    byte[] bytes = requireBytes(file);
    try (PDDocument doc = pdfBox.load(bytes, null)) {
      String name = file.getOriginalFilename() == null ? "document.pdf" : file.getOriginalFilename();
      String base = name.replaceAll("(?i)\\.pdf$", "");
      String outName = (pattern == null || pattern.isBlank() ? "{name}-clean-{date}.pdf" : pattern)
          .replace("{name}", base)
          .replace("{pages}", String.valueOf(doc.getNumberOfPages()))
          .replace("{date}", LocalDate.now().toString());
      if (!outName.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
        outName = outName + ".pdf";
      }
      return outName.replaceAll("[\\\\/]+", "_");
    }
  }

  public byte[] organizeMerge(List<MultipartFile> files) throws Exception {
    requireMulti(files, 2);
    List<MultipartFile> sorted = files.stream()
        .sorted(Comparator.comparing(
            f -> f.getOriginalFilename() == null ? "" : f.getOriginalFilename().toLowerCase(Locale.ROOT)))
        .toList();
    return basicOps.merge(sorted);
  }

  public byte[] compareVersions(List<MultipartFile> files) throws Exception {
    requireMulti(files, 2);
    MultipartFile a = files.get(0);
    MultipartFile b = files.get(1);
    String textA = pdfBox.extractText(requireBytes(a));
    String textB = pdfBox.extractText(requireBytes(b));
    try (PDDocument docA = pdfBox.load(requireBytes(a), null);
         PDDocument docB = pdfBox.load(requireBytes(b), null)) {
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("fileA", a.getOriginalFilename());
      result.put("fileB", b.getOriginalFilename());
      result.put("pagesA", docA.getNumberOfPages());
      result.put("pagesB", docB.getNumberOfPages());
      result.put("textHashA", sha256(textA.getBytes(StandardCharsets.UTF_8)));
      result.put("textHashB", sha256(textB.getBytes(StandardCharsets.UTF_8)));
      result.put("samePageCount", docA.getNumberOfPages() == docB.getNumberOfPages());
      result.put("sameText", textA.equals(textB));
      return jsonBytes(result);
    }
  }

  public byte[] compareVisual(List<MultipartFile> files) throws Exception {
    requireMulti(files, 2);
    float score = pdfBox.compareVisualFirstPage(requireBytes(files.get(0)), requireBytes(files.get(1)));
    return jsonBytes(Map.of(
        "similarity", Math.round(score * 1000) / 1000.0,
        "fileA", files.get(0).getOriginalFilename(),
        "fileB", files.get(1).getOriginalFilename()
    ));
  }

  public byte[] diffText(List<MultipartFile> files) throws Exception {
    requireMulti(files, 2);
    List<String> a = Arrays.asList(pdfBox.extractText(requireBytes(files.get(0))).split("\\R"));
    List<String> b = Arrays.asList(pdfBox.extractText(requireBytes(files.get(1))).split("\\R"));
    StringBuilder out = new StringBuilder();
    int max = Math.max(a.size(), b.size());
    for (int i = 0; i < max; i++) {
      String la = i < a.size() ? a.get(i) : "";
      String lb = i < b.size() ? b.get(i) : "";
      if (!la.equals(lb)) {
        out.append("- ").append(la).append('\n');
        out.append("+ ").append(lb).append('\n');
      }
    }
    if (out.isEmpty()) {
      out.append("No textual differences found.\n");
    }
    return out.toString().getBytes(StandardCharsets.UTF_8);
  }

  public byte[] keywords(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    Map<String, Long> freq = Arrays.stream(text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+"))
        .filter(w -> w.length() > 2 && !STOPWORDS.contains(w))
        .collect(Collectors.groupingBy(w -> w, LinkedHashMap::new, Collectors.counting()));
    List<Map<String, Object>> top = freq.entrySet().stream()
        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
        .limit(25)
        .map(e -> Map.<String, Object>of("term", e.getKey(), "count", e.getValue()))
        .toList();
    return jsonBytes(Map.of("keywords", top));
  }

  public byte[] citation(MultipartFile file) throws Exception {
    byte[] bytes = requireBytes(file);
    try (PDDocument doc = pdfBox.load(bytes, null)) {
      PDDocumentInformation info = doc.getDocumentInformation();
      String title = info != null && info.getTitle() != null && !info.getTitle().isBlank()
          ? info.getTitle()
          : (file.getOriginalFilename() == null ? "Untitled PDF" : file.getOriginalFilename());
      String author = info != null && info.getAuthor() != null && !info.getAuthor().isBlank()
          ? info.getAuthor()
          : "Unknown Author";
      String year = LocalDate.now().getYear() + "";
      String citation = author + ". \"" + title + ".\" PDF document, " + year + ".";
      return citation.getBytes(StandardCharsets.UTF_8);
    }
  }

  public byte[] references(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    StringBuilder refs = new StringBuilder();
    boolean inRefs = false;
    for (String line : text.split("\\R")) {
      String trimmed = line.trim();
      if (trimmed.matches("(?i)^references?$") || trimmed.matches("(?i)^bibliography$")) {
        inRefs = true;
        continue;
      }
      if (inRefs || trimmed.matches("^\\[\\d+].+") || trimmed.matches("(?i)^\\d+\\.\\s+[A-Z].{20,}")) {
        if (!trimmed.isBlank()) {
          refs.append(trimmed).append('\n');
        }
      }
    }
    if (refs.isEmpty()) {
      refs.append("No reference-like lines detected.\n");
    }
    return refs.toString().getBytes(StandardCharsets.UTF_8);
  }

  public byte[] extractInvoice(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    Map<String, Object> data = new LinkedHashMap<>();
    Matcher inv = INVOICE_ID.matcher(text);
    data.put("invoiceId", inv.find() ? inv.group(1) : null);
    data.put("dates", findAll(DATE, text));
    data.put("amounts", findAll(AMOUNT, text));
    data.put("emails", findAll(EMAIL, text));
    data.put("rawSnippet", text.length() > 500 ? text.substring(0, 500) : text);
    return jsonBytes(data);
  }

  public byte[] extractReceipt(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("amounts", findAll(AMOUNT, text));
    data.put("dates", findAll(DATE, text));
    String merchant = Arrays.stream(text.split("\\R"))
        .map(String::trim)
        .filter(s -> !s.isBlank())
        .findFirst()
        .orElse(null);
    data.put("merchantGuess", merchant);
    data.put("totalGuess", findAll(AMOUNT, text).stream().reduce((a, b) -> b).orElse(null));
    return jsonBytes(data);
  }

  public byte[] parseResume(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("emails", findAll(EMAIL, text));
    data.put("phones", findAll(PHONE, text));
    data.put("sections", Map.of(
        "experience", sectionAfter(text, "(?i)experience|employment"),
        "education", sectionAfter(text, "(?i)education"),
        "skills", sectionAfter(text, "(?i)skills")
    ));
    return jsonBytes(data);
  }

  public byte[] analyzeContract(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file)).toLowerCase(Locale.ROOT);
    List<String> flags = new ArrayList<>();
    Map<String, String> clauses = Map.of(
        "indemnity", "indemnif",
        "termination", "terminat",
        "liability", "liabilit",
        "confidentiality", "confidential",
        "governingLaw", "governing law",
        "arbitration", "arbitration",
        "nonCompete", "non-compete|noncompete"
    );
    Map<String, Boolean> found = new LinkedHashMap<>();
    for (Map.Entry<String, String> e : clauses.entrySet()) {
      boolean hit = Pattern.compile(e.getValue()).matcher(text).find();
      found.put(e.getKey(), hit);
      if (hit) {
        flags.add(e.getKey());
      }
    }
    return jsonBytes(Map.of("clauses", found, "riskFlags", flags));
  }

  public byte[] classify(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file)).toLowerCase(Locale.ROOT);
    Map<String, Integer> scores = new LinkedHashMap<>();
    scores.put("invoice", countHits(text, "invoice", "amount due", "bill to"));
    scores.put("receipt", countHits(text, "receipt", "cashier", "change due"));
    scores.put("resume", countHits(text, "experience", "education", "skills", "curriculum"));
    scores.put("contract", countHits(text, "agreement", "hereby", "party", "whereas"));
    scores.put("report", countHits(text, "summary", "findings", "conclusion", "analysis"));
    String best = scores.entrySet().stream()
        .max(Map.Entry.comparingByValue())
        .map(Map.Entry::getKey)
        .orElse("unknown");
    return jsonBytes(Map.of("label", best, "scores", scores));
  }

  public byte[] extractData(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    return jsonBytes(Map.of(
        "emails", findAll(EMAIL, text),
        "phones", findAll(PHONE, text),
        "urls", findAll(URL, text),
        "amounts", findAll(AMOUNT, text)
    ));
  }

  public byte[] extractEntities(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    List<String> orgs = Arrays.stream(text.split("\\R"))
        .map(String::trim)
        .filter(l -> l.matches(".*\\b(Inc\\.|LLC|Ltd\\.|Corp\\.|Company)\\b.*"))
        .limit(20)
        .toList();
    return jsonBytes(Map.of(
        "organizations", orgs,
        "dates", findAll(DATE, text),
        "money", findAll(AMOUNT, text),
        "emails", findAll(EMAIL, text)
    ));
  }

  public byte[] summarize(MultipartFile file, int sentences) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    return extractiveSummary(text, sentences <= 0 ? 5 : sentences).getBytes(StandardCharsets.UTF_8);
  }

  public byte[] generateQuestions(MultipartFile file) throws Exception {
    List<String> sentences = splitSentences(pdfBox.extractText(requireBytes(file)));
    StringBuilder out = new StringBuilder();
    int n = 1;
    for (String s : sentences) {
      if (s.length() < 40) {
        continue;
      }
      out.append(n++).append(". What is meant by: \"").append(trimTo(s, 120)).append("\"?\n");
      if (n > 10) {
        break;
      }
    }
    if (out.isEmpty()) {
      out.append("Not enough content to generate questions.\n");
    }
    return out.toString().getBytes(StandardCharsets.UTF_8);
  }

  public byte[] generateQuiz(MultipartFile file) throws Exception {
    List<String> sentences = splitSentences(pdfBox.extractText(requireBytes(file)));
    List<Map<String, Object>> quiz = new ArrayList<>();
    for (String s : sentences) {
      if (s.length() < 50) {
        continue;
      }
      String[] words = s.split("\\s+");
      if (words.length < 6) {
        continue;
      }
      String blank = words[Math.min(3, words.length - 1)].replaceAll("[^A-Za-z]", "");
      if (blank.length() < 4) {
        continue;
      }
      quiz.add(Map.of(
          "question", s.replaceFirst(Pattern.quote(blank), "______"),
          "answer", blank
      ));
      if (quiz.size() >= 8) {
        break;
      }
    }
    return jsonBytes(Map.of("quiz", quiz));
  }

  public byte[] generateFlashcards(MultipartFile file) throws Exception {
    List<String> sentences = splitSentences(pdfBox.extractText(requireBytes(file)));
    List<Map<String, String>> cards = new ArrayList<>();
    for (String s : sentences) {
      if (s.length() < 40) {
        continue;
      }
      cards.add(Map.of(
          "front", "Explain: " + trimTo(s, 80),
          "back", s
      ));
      if (cards.size() >= 12) {
        break;
      }
    }
    return jsonBytes(Map.of("flashcards", cards));
  }

  public byte[] generateNotes(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    String summary = extractiveSummary(text, 5);
    StringBuilder md = new StringBuilder("# Study Notes\n\n## Summary\n");
    md.append(summary).append("\n\n## Key Points\n");
    for (String s : splitSentences(text)) {
      if (s.length() > 40) {
        md.append("- ").append(trimTo(s, 160)).append('\n');
      }
      if (md.length() > 2500) {
        break;
      }
    }
    return md.toString().getBytes(StandardCharsets.UTF_8);
  }

  public byte[] generateMindmap(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    Map<String, Long> freq = Arrays.stream(text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+"))
        .filter(w -> w.length() > 3 && !STOPWORDS.contains(w))
        .collect(Collectors.groupingBy(w -> w, Collectors.counting()));
    List<String> tops = freq.entrySet().stream()
        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
        .limit(8)
        .map(Map.Entry::getKey)
        .toList();
    StringBuilder out = new StringBuilder("PDF\n");
    for (String t : tops) {
      out.append("├── ").append(t).append('\n');
    }
    return out.toString().getBytes(StandardCharsets.UTF_8);
  }

  public byte[] generatePresentation(MultipartFile file) throws Exception {
    List<String> sentences = splitSentences(pdfBox.extractText(requireBytes(file)));
    StringBuilder md = new StringBuilder("# Presentation Outline\n\n");
    int slide = 1;
    for (String s : sentences) {
      if (s.length() < 40) {
        continue;
      }
      md.append("## Slide ").append(slide++).append('\n');
      md.append("- ").append(trimTo(s, 140)).append("\n\n");
      if (slide > 10) {
        break;
      }
    }
    return md.toString().getBytes(StandardCharsets.UTF_8);
  }

  public byte[] generateReport(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    String report = "Report\n======\n\n"
        + extractiveSummary(text, 6)
        + "\n\nKey extracts:\n"
        + splitSentences(text).stream().filter(s -> s.length() > 40).limit(8)
        .map(s -> "- " + trimTo(s, 160))
        .collect(Collectors.joining("\n"));
    return pdfBox.textToPdf(report);
  }

  public byte[] accessibilityTag(MultipartFile file, String title, String language) throws Exception {
    return pdfBox.accessibilityTag(requireBytes(file), title, language);
  }

  public byte[] fixReadingOrder(MultipartFile file) throws Exception {
    return pdfBox.fixReadingOrder(requireBytes(file));
  }

  public byte[] altTextSuggestions(MultipartFile file) throws Exception {
    return jsonBytes(Map.of("suggestions", pdfBox.altTextSuggestions(requireBytes(file))));
  }

  public byte[] findRedactions(MultipartFile file) throws Exception {
    return jsonBytes(pdfBox.findRedactedRegions(requireBytes(file)));
  }

  /** Image redaction — destroys underlying text (OSS-safe approximate). */
  public byte[] redact(MultipartFile file, String query, String regions, int dpi) throws Exception {
    return pdfBox.redactAsImages(requireBytes(file), regions, query, dpi);
  }

  public byte[] scanSensitive(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    List<Map<String, String>> findings = new ArrayList<>();
    for (String marker : List.of("confidential", "secret", "api_key", "password", "private key", "bearer ")) {
      if (text.toLowerCase(Locale.ROOT).contains(marker)) {
        findings.add(Map.of("type", "marker", "value", marker));
      }
    }
    for (String email : findAll(EMAIL, text)) {
      findings.add(Map.of("type", "email", "value", email));
    }
    for (String ssn : findAll(SSN, text)) {
      findings.add(Map.of("type", "ssn", "value", ssn));
    }
    return jsonBytes(Map.of("findings", findings, "count", findings.size()));
  }

  public byte[] detectPii(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("emails", findAll(EMAIL, text));
    result.put("phones", findAll(PHONE, text));
    result.put("ssns", findAll(SSN, text));
    result.put("cardLikeNumbers", findAll(CARD, text).stream().limit(20).toList());
    result.put("hasPii",
        !findAll(EMAIL, text).isEmpty()
            || !findAll(PHONE, text).isEmpty()
            || !findAll(SSN, text).isEmpty());
    return jsonBytes(result);
  }

  public byte[] ask(MultipartFile file, String question) throws Exception {
    requireText(question, "question");
    String answer = extractiveAnswer(pdfBox.extractText(requireBytes(file)), question);
    return answer.getBytes(StandardCharsets.UTF_8);
  }

  public byte[] multiSearch(List<MultipartFile> files, String query) throws Exception {
    requireMulti(files, 1);
    requireText(query, "query");
    String q = query.toLowerCase(Locale.ROOT);
    List<Map<String, Object>> hits = new ArrayList<>();
    for (MultipartFile file : files) {
      List<String> pages = pdfBox.extractTextPerPage(requireBytes(file));
      for (int i = 0; i < pages.size(); i++) {
        if (pages.get(i).toLowerCase(Locale.ROOT).contains(q)) {
          hits.add(Map.of(
              "file", file.getOriginalFilename() == null ? "document.pdf" : file.getOriginalFilename(),
              "page", i + 1,
              "snippet", snippet(pages.get(i), q)
          ));
        }
      }
    }
    return jsonBytes(Map.of("query", query, "hits", hits));
  }

  public byte[] multiAsk(List<MultipartFile> files, String question) throws Exception {
    requireMulti(files, 1);
    requireText(question, "question");
    StringBuilder corpus = new StringBuilder();
    for (MultipartFile file : files) {
      corpus.append(pdfBox.extractText(requireBytes(file))).append('\n');
    }
    return extractiveAnswer(corpus.toString(), question).getBytes(StandardCharsets.UTF_8);
  }

  public byte[] knowledgeBase(List<MultipartFile> files) throws Exception {
    requireMulti(files, 1);
    List<Map<String, Object>> docs = new ArrayList<>();
    for (MultipartFile file : files) {
      String text = pdfBox.extractText(requireBytes(file));
      docs.add(Map.of(
          "file", file.getOriginalFilename() == null ? "document.pdf" : file.getOriginalFilename(),
          "chars", text.length(),
          "preview", trimTo(text, 240)
      ));
    }
    return jsonBytes(Map.of("documents", docs, "indexed", docs.size()));
  }

  public byte[] rag(MultipartFile file, String query) throws Exception {
    requireText(query, "query");
    List<String> sentences = splitSentences(pdfBox.extractText(requireBytes(file)));
    Set<String> qWords = tokenize(query);
    List<Map<String, Object>> passages = sentences.stream()
        .map(s -> Map.<String, Object>of("text", s, "score", overlapScore(tokenize(s), qWords)))
        .filter(m -> ((Number) m.get("score")).doubleValue() > 0)
        .sorted((a, b) -> Double.compare(
            ((Number) b.get("score")).doubleValue(),
            ((Number) a.get("score")).doubleValue()))
        .limit(5)
        .toList();
    return jsonBytes(Map.of("query", query, "passages", passages));
  }

  public byte[] workflowClean(MultipartFile file) throws Exception {
    byte[] cleaned = pdfBox.removeHiddenData(requireBytes(file));
    if (!gs.isAvailable()) {
      return cleaned;
    }
    Path job = temp.createJobDir("pdf");
    try {
      Path in = temp.writeBytes(job, "in.pdf", cleaned);
      return gs.compress(in, job.resolve("out.pdf"), "medium");
    } finally {
      temp.deleteQuietly(job);
    }
  }

  public byte[] translationSheet(MultipartFile file) throws Exception {
    String text = pdfBox.extractText(requireBytes(file));
    StringBuilder sheet = new StringBuilder("Source | Gloss\n------+------\n");
    for (String line : text.split("\\R")) {
      String trimmed = line.trim();
      if (trimmed.isBlank()) {
        continue;
      }
      sheet.append(trimTo(trimmed, 80)).append(" | ").append(simpleGloss(trimmed)).append('\n');
      if (sheet.length() > 4000) {
        break;
      }
    }
    return pdfBox.textToPdf(sheet.toString());
  }

  private byte[] jsonBytes(Object value) throws Exception {
    return json.writerWithDefaultPrettyPrinter().writeValueAsBytes(value);
  }

  private static byte[] requireBytes(MultipartFile file) throws Exception {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("PDF file is required");
    }
    byte[] bytes = file.getBytes();
    com.easytoolhub.pdf.platform.PdfIoGuard.assertPdfMagic(bytes);
    return bytes;
  }

  private static void requireMulti(List<MultipartFile> files, int min) {
    if (files == null || files.size() < min) {
      throw new IllegalArgumentException("Provide at least " + min + " PDF file(s)");
    }
  }

  private static void requireText(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " is required");
    }
  }

  static List<Integer> parsePages(String pages) {
    if (pages == null || pages.isBlank()) {
      throw new IllegalArgumentException("pages is required (e.g. 1,3,5-7)");
    }
    return Arrays.stream(pages.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .flatMap(part -> {
          if (part.contains("-")) {
            String[] ends = part.split("-", 2);
            int from = Integer.parseInt(ends[0].trim());
            int to = Integer.parseInt(ends[1].trim());
            if (from > to || from < 1) {
              throw new IllegalArgumentException("Invalid page range: " + part);
            }
            return java.util.stream.IntStream.rangeClosed(from, to).boxed();
          }
          return java.util.stream.Stream.of(Integer.parseInt(part));
        })
        .distinct()
        .toList();
  }

  private static List<Map.Entry<String, Integer>> parseOutline(String outline) {
    if (outline == null || outline.isBlank()) {
      throw new IllegalArgumentException("outline is required (title|page per line)");
    }
    List<Map.Entry<String, Integer>> items = new ArrayList<>();
    for (String line : outline.split("\\R")) {
      String trimmed = line.trim();
      if (trimmed.isEmpty()) {
        continue;
      }
      String[] parts = trimmed.split("\\|", 2);
      if (parts.length != 2) {
        throw new IllegalArgumentException("Outline line must be title|page: " + trimmed);
      }
      items.add(Map.entry(parts[0].trim(), Integer.parseInt(parts[1].trim())));
    }
    if (items.isEmpty()) {
      throw new IllegalArgumentException("outline is required (title|page per line)");
    }
    return items;
  }

  private static List<String> findAll(Pattern pattern, String text) {
    LinkedHashSet<String> values = new LinkedHashSet<>();
    Matcher m = pattern.matcher(text);
    while (m.find()) {
      values.add(m.group());
    }
    return new ArrayList<>(values);
  }

  private static String sectionAfter(String text, String headingRegex) {
    Matcher m = Pattern.compile(headingRegex).matcher(text);
    if (!m.find()) {
      return "";
    }
    int start = m.end();
    String rest = text.substring(start);
    int end = Math.min(rest.length(), 600);
    return rest.substring(0, end).trim();
  }

  private static int countHits(String text, String... terms) {
    int score = 0;
    for (String term : terms) {
      if (text.contains(term)) {
        score++;
      }
    }
    return score;
  }

  private static List<String> splitSentences(String text) {
    if (text == null || text.isBlank()) {
      return List.of();
    }
    return Arrays.stream(text.replace("\r\n", "\n").split("(?<=[.!?])\\s+|\\n+"))
        .map(String::trim)
        .filter(s -> !s.isBlank())
        .toList();
  }

  private static String extractiveSummary(String text, int sentenceCount) {
    List<String> sentences = splitSentences(text);
    if (sentences.isEmpty()) {
      return "No extractable text found.";
    }
    Map<String, Long> freq = Arrays.stream(text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+"))
        .filter(w -> w.length() > 2 && !STOPWORDS.contains(w))
        .collect(Collectors.groupingBy(w -> w, Collectors.counting()));
    return sentences.stream()
        .sorted((a, b) -> Double.compare(scoreSentence(b, freq), scoreSentence(a, freq)))
        .limit(sentenceCount)
        .collect(Collectors.joining(" "));
  }

  private static double scoreSentence(String sentence, Map<String, Long> freq) {
    return tokenize(sentence).stream().mapToDouble(w -> freq.getOrDefault(w, 0L)).sum()
        / Math.max(1, sentence.split("\\s+").length);
  }

  private static String extractiveAnswer(String text, String question) {
    List<String> sentences = splitSentences(text);
    if (sentences.isEmpty()) {
      return "No extractable text found in the PDF.";
    }
    Set<String> qWords = tokenize(question);
    return sentences.stream()
        .max(Comparator.comparingDouble(s -> overlapScore(tokenize(s), qWords)))
        .filter(s -> overlapScore(tokenize(s), qWords) > 0)
        .orElse("No closely matching passage found. Try rephrasing the question.");
  }

  private static Set<String> tokenize(String text) {
    return Arrays.stream(text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+"))
        .filter(w -> w.length() > 2 && !STOPWORDS.contains(w))
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private static double overlapScore(Set<String> a, Set<String> b) {
    if (a.isEmpty() || b.isEmpty()) {
      return 0;
    }
    long overlap = a.stream().filter(b::contains).count();
    return (double) overlap / (double) b.size();
  }

  private static String snippet(String text, String queryLower) {
    String lower = text.toLowerCase(Locale.ROOT);
    int idx = lower.indexOf(queryLower);
    if (idx < 0) {
      return trimTo(text, 160);
    }
    int start = Math.max(0, idx - 40);
    int end = Math.min(text.length(), idx + queryLower.length() + 80);
    return text.substring(start, end).replaceAll("\\s+", " ").trim();
  }

  private static String trimTo(String text, int max) {
    String t = text.replaceAll("\\s+", " ").trim();
    return t.length() <= max ? t : t.substring(0, max - 1) + "…";
  }

  private static String simpleGloss(String line) {
    return line.toLowerCase(Locale.ROOT)
        .replaceAll("[^a-z0-9\\s]", " ")
        .replaceAll("\\s+", " ")
        .trim();
  }

  private static String escapeHtml(String text) {
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  }

  private static String csvEscape(String value) {
    String v = value.replace("\"", "\"\"");
    return "\"" + v + "\"";
  }

  private static String sha256(byte[] bytes) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    return HexFormat.of().formatHex(digest.digest(bytes));
  }

  private static void writeStored(ZipOutputStream zos, String name, byte[] data) throws Exception {
    ZipEntry entry = new ZipEntry(name);
    entry.setMethod(ZipEntry.STORED);
    entry.setSize(data.length);
    entry.setCompressedSize(data.length);
    CRC32 crc = new CRC32();
    crc.update(data);
    entry.setCrc(crc.getValue());
    zos.putNextEntry(entry);
    zos.write(data);
    zos.closeEntry();
  }

  private static void writeDeflated(ZipOutputStream zos, String name, byte[] data) throws Exception {
    zos.putNextEntry(new ZipEntry(name));
    zos.write(data);
    zos.closeEntry();
  }
}
