package com.easytoolhub.pdf.engine.ocr;

import com.easytoolhub.pdf.config.PdfProperties;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import net.sourceforge.tess4j.ITessAPI;
import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import net.sourceforge.tess4j.Word;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.graphics.state.RenderingMode;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Component;

/**
 * Tess4J / Tesseract OCR → searchable PDF (invisible text layer) or plain text.
 */
@Component
public class OcrEngine {
  private final PdfProperties props;
  private volatile Boolean availableCache;

  public OcrEngine(PdfProperties props) {
    this.props = props;
    ensureNativeLibraryPath();
  }

  public boolean isAvailable() {
    Boolean cached = availableCache;
    if (cached != null) return cached;
    synchronized (this) {
      if (availableCache != null) return availableCache;
      try {
        resolveTessdataPath();
        ITesseract t = createTesseract("eng");
        BufferedImage probe = new BufferedImage(8, 8, BufferedImage.TYPE_BYTE_GRAY);
        t.doOCR(probe);
        availableCache = true;
      } catch (Throwable e) {
        availableCache = false;
      }
      return availableCache;
    }
  }

  /** Help Tess4J/JNA find Homebrew/system libtesseract on macOS/Linux. */
  private static void ensureNativeLibraryPath() {
    List<String> extras = new ArrayList<>();
    extras.add("/opt/homebrew/lib");
    extras.add("/usr/local/lib");
    extras.add("/usr/lib");
    String existing = System.getProperty("jna.library.path");
    String joined = String.join(":", extras);
    if (existing == null || existing.isBlank()) {
      System.setProperty("jna.library.path", joined);
    } else if (!existing.contains("/opt/homebrew/lib")) {
      System.setProperty("jna.library.path", existing + ":" + joined);
    }
  }

  public byte[] toSearchablePdf(byte[] pdfBytes, String language, int dpi) throws Exception {
    requireAvailable();
    int renderDpi = dpi <= 0 ? 200 : Math.min(dpi, 400);
    String lang = normalizeLanguage(language);
    ITesseract tesseract = createTesseract(lang);

    try (PDDocument source = Loader.loadPDF(pdfBytes);
         PDDocument out = new PDDocument();
         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      int pageCount = source.getNumberOfPages();
      int max = Math.max(1, props.ocrMaxPages() <= 0 ? 25 : props.ocrMaxPages());
      if (pageCount > max) {
        throw new IllegalArgumentException(
            "OCR is limited to " + max + " pages per request (this PDF has " + pageCount + ")");
      }
      PDFRenderer renderer = new PDFRenderer(source);
      PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

      for (int i = 0; i < pageCount; i++) {
        BufferedImage image = renderer.renderImageWithDPI(i, renderDpi, ImageType.RGB);
        PDPage srcPage = source.getPage(i);
        PDRectangle media = srcPage.getMediaBox();
        PDPage page = new PDPage(new PDRectangle(media.getWidth(), media.getHeight()));
        out.addPage(page);

        PDImageXObject xImage = LosslessFactory.createFromImage(out, image);
        try (PDPageContentStream cs = new PDPageContentStream(out, page)) {
          cs.drawImage(xImage, 0, 0, media.getWidth(), media.getHeight());
          overlayInvisibleWords(cs, font, tesseract, image, media.getWidth(), media.getHeight());
        }
      }
      out.save(bos);
      return bos.toByteArray();
    }
  }

  public byte[] toText(byte[] pdfBytes, String language, int dpi) throws Exception {
    requireAvailable();
    int renderDpi = dpi <= 0 ? 200 : Math.min(dpi, 400);
    String lang = normalizeLanguage(language);
    ITesseract tesseract = createTesseract(lang);

    try (PDDocument source = Loader.loadPDF(pdfBytes)) {
      int pageCount = source.getNumberOfPages();
      int max = Math.max(1, props.ocrMaxPages() <= 0 ? 25 : props.ocrMaxPages());
      if (pageCount > max) {
        throw new IllegalArgumentException(
            "OCR is limited to " + max + " pages per request (this PDF has " + pageCount + ")");
      }
      PDFRenderer renderer = new PDFRenderer(source);
      StringBuilder sb = new StringBuilder();
      for (int i = 0; i < pageCount; i++) {
        BufferedImage image = renderer.renderImageWithDPI(i, renderDpi, ImageType.RGB);
        String pageText = tesseract.doOCR(image);
        if (i > 0) sb.append("\n\n--- Page ").append(i + 1).append(" ---\n\n");
        else sb.append("--- Page 1 ---\n\n");
        sb.append(pageText == null ? "" : pageText.trim());
      }
      return sb.toString().getBytes(StandardCharsets.UTF_8);
    }
  }

  private void overlayInvisibleWords(
      PDPageContentStream cs,
      PDType1Font font,
      ITesseract tesseract,
      BufferedImage image,
      float pageWidth,
      float pageHeight
  ) throws IOException, TesseractException {
    List<Word> words = tesseract.getWords(image, ITessAPI.TessPageIteratorLevel.RIL_WORD);
    if (words == null || words.isEmpty()) return;

    float scaleX = pageWidth / (float) image.getWidth();
    float scaleY = pageHeight / (float) image.getHeight();

    cs.setRenderingMode(RenderingMode.NEITHER);
    cs.setNonStrokingColor(0f, 0f, 0f);

    for (Word word : words) {
      if (word == null) continue;
      String text = sanitizeWinAnsi(word.getText());
      if (text == null || text.isBlank()) continue;
      Rectangle box = word.getBoundingBox();
      if (box == null || box.width <= 0 || box.height <= 0) continue;

      float pdfX = box.x * scaleX;
      float pdfH = Math.max(4f, box.height * scaleY);
      float pdfY = pageHeight - (box.y + box.height) * scaleY;
      float fontSize = Math.min(72f, Math.max(4f, pdfH * 0.9f));

      try {
        cs.beginText();
        cs.setFont(font, fontSize);
        cs.newLineAtOffset(pdfX, Math.max(0f, pdfY));
        cs.showText(text.trim());
        cs.endText();
      } catch (IllegalArgumentException | IOException ignored) {
        // Skip glyphs that still can't encode; keep remaining words.
        try {
          cs.endText();
        } catch (Exception ignored2) {
          /* already closed or never opened */
        }
      }
    }
  }

  private void requireAvailable() {
    if (!isAvailable()) {
      throw new IllegalStateException(
          "OCR requires Tesseract on the server (install tesseract + eng traineddata).");
    }
  }

  private ITesseract createTesseract(String language) throws IOException {
    Tesseract tesseract = new Tesseract();
    tesseract.setDatapath(resolveTessdataPath().toString());
    tesseract.setLanguage(language);
    tesseract.setPageSegMode(3); // fully automatic page segmentation
    tesseract.setOcrEngineMode(1); // LSTM only
    return tesseract;
  }

  private Path resolveTessdataPath() throws IOException {
    List<Path> candidates = new ArrayList<>();
    String configured = props.tessdataPath();
    if (configured != null && !configured.isBlank()) {
      candidates.add(Path.of(configured));
    }
    String env = System.getenv("TESSDATA_PREFIX");
    if (env != null && !env.isBlank()) {
      Path p = Path.of(env);
      candidates.add(p);
      candidates.add(p.resolve("tessdata"));
    }
    candidates.add(Path.of("/opt/homebrew/share/tessdata"));
    candidates.add(Path.of("/usr/local/share/tessdata"));
    candidates.add(Path.of("/usr/share/tesseract-ocr/5/tessdata"));
    candidates.add(Path.of("/usr/share/tesseract-ocr/4.00/tessdata"));
    candidates.add(Path.of("/usr/share/tessdata"));

    for (Path candidate : candidates) {
      if (candidate != null && Files.isRegularFile(candidate.resolve("eng.traineddata"))) {
        return candidate.toAbsolutePath().normalize();
      }
    }
    throw new IOException(
        "Could not find tessdata (eng.traineddata). Set PDF_TESSDATA_PATH or TESSDATA_PREFIX.");
  }

  private static String normalizeLanguage(String language) {
    if (language == null || language.isBlank()) return "eng";
    String cleaned = language.trim().toLowerCase(Locale.ROOT).replace(' ', '+');
    if (!cleaned.matches("[a-z]{3}(\\+[a-z]{3})*")) {
      throw new IllegalArgumentException("Invalid OCR language code (use eng, or eng+deu)");
    }
    return cleaned;
  }

  private static String sanitizeWinAnsi(String input) {
    if (input == null) return "";
    StringBuilder sb = new StringBuilder(input.length());
    for (int i = 0; i < input.length(); i++) {
      char c = input.charAt(i);
      if (c == '\n' || c == '\r' || c == '\t') {
        sb.append(' ');
      } else if (c >= 32 && c <= 126) {
        sb.append(c);
      } else if (c >= 160 && c <= 255) {
        sb.append(c);
      }
      // drop unsupported
    }
    return sb.toString().replaceAll("\\s+", " ").trim();
  }
}
