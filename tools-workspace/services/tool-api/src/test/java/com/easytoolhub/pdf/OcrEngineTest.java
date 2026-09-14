package com.easytoolhub.pdf;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.easytoolhub.pdf.config.PdfProperties;
import com.easytoolhub.pdf.engine.ocr.OcrEngine;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class OcrEngineTest {
  @Test
  void searchablePdfContainsOcrText() throws Exception {
    PdfProperties props = new PdfProperties(500, "qpdf", "gs", "", 25, 40, 200, 104_857_600L, 100.0, 2, 8_388_608L, 5, "", 150);
    OcrEngine ocr = new OcrEngine(props);
    assumeTrue(ocr.isAvailable(), "Tesseract not installed");

    byte[] scanned = createImageOnlyPdf("OCRABLE TEXT 12345");
    byte[] searchable = ocr.toSearchablePdf(scanned, "eng", 200);

    try (PDDocument doc = Loader.loadPDF(searchable)) {
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.toUpperCase().contains("OCRABLE") || text.contains("12345"),
          "Expected OCR text in searchable PDF, got: " + text);
    }
  }

  private static byte[] createImageOnlyPdf(String paintText) throws Exception {
    BufferedImage image = new BufferedImage(800, 200, BufferedImage.TYPE_INT_RGB);
    Graphics2D g = image.createGraphics();
    g.setColor(Color.WHITE);
    g.fillRect(0, 0, 800, 200);
    g.setColor(Color.BLACK);
    g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 48));
    g.drawString(paintText, 40, 120);
    g.dispose();

    try (PDDocument doc = new PDDocument();
         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      PDPage page = new PDPage(PDRectangle.LETTER);
      doc.addPage(page);
      var xImage = LosslessFactory.createFromImage(doc, image);
      try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
        cs.drawImage(xImage, 36, 500, 540, 135);
      }
      doc.save(bos);
      return bos.toByteArray();
    }
  }
}
