package com.easytoolhub.pdf;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.easytoolhub.pdf.engine.pdfbox.PdfBoxEngine;
import java.io.ByteArrayOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class PdfRedactionEngineTest {
  @Test
  void imageRedactionRemovesMatchingText() throws Exception {
    byte[] pdf = samplePdf("SecretCode ALPHA-99 visible");
    PdfBoxEngine engine = new PdfBoxEngine();

    byte[] redacted = engine.redactAsImages(pdf, null, "ALPHA-99", 120);

    try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(redacted)) {
      String text = new PDFTextStripper().getText(doc);
      assertFalse(text.contains("ALPHA-99"));
      assertTrue(doc.getNumberOfPages() >= 1);
    }
  }

  @Test
  void regionRedactionWorks() throws Exception {
    byte[] pdf = samplePdf("Leave this KeepSecret here");
    // Broad box covering most of the text line area on LETTER page
    String regions = "[{\"pageIndex\":0,\"x\":70,\"y\":700,\"width\":400,\"height\":30}]";
    PdfBoxEngine engine = new PdfBoxEngine();
    byte[] redacted = engine.redactAsImages(pdf, regions, null, 100);
    try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(redacted)) {
      String text = new PDFTextStripper().getText(doc).trim();
      // Image-only page should yield little/no extractable text
      assertTrue(text.length() < 20 || !text.contains("KeepSecret"));
    }
  }

  private static byte[] samplePdf(String line) throws Exception {
    try (PDDocument doc = new PDDocument();
         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      PDPage page = new PDPage(PDRectangle.LETTER);
      doc.addPage(page);
      try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
        cs.newLineAtOffset(72, 720);
        cs.showText(line);
        cs.endText();
      }
      doc.save(bos);
      return bos.toByteArray();
    }
  }
}
