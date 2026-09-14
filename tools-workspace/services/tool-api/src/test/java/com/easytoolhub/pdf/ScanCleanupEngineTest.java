package com.easytoolhub.pdf;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.easytoolhub.pdf.engine.scan.ScanCleanupEngine;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.junit.jupiter.api.Test;

class ScanCleanupEngineTest {
  @Test
  void deskewProducesReadablePdf() throws Exception {
    byte[] skewed = createSkewedScanPdf();
    ScanCleanupEngine engine = new ScanCleanupEngine();
    byte[] out = engine.deskew(skewed, 120, 12);
    try (PDDocument doc = Loader.loadPDF(out)) {
      assertTrue(doc.getNumberOfPages() >= 1);
    }
  }

  private static byte[] createSkewedScanPdf() throws Exception {
    BufferedImage base = new BufferedImage(600, 200, BufferedImage.TYPE_BYTE_GRAY);
    Graphics2D g = base.createGraphics();
    g.setColor(Color.WHITE);
    g.fillRect(0, 0, 600, 200);
    g.setColor(Color.BLACK);
    g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 36));
    g.drawString("DESKEW SAMPLE LINE", 40, 100);
    g.dispose();

    AffineTransform at = AffineTransform.getRotateInstance(Math.toRadians(6), 300, 100);
    BufferedImage rotated = new BufferedImage(600, 200, BufferedImage.TYPE_BYTE_GRAY);
    Graphics2D g2 = rotated.createGraphics();
    g2.setColor(Color.WHITE);
    g2.fillRect(0, 0, 600, 200);
    g2.drawImage(base, at, null);
    g2.dispose();

    try (PDDocument doc = new PDDocument(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      PDPage page = new PDPage(PDRectangle.LETTER);
      doc.addPage(page);
      var img = LosslessFactory.createFromImage(doc, rotated);
      try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
        cs.drawImage(img, 36, 400, 540, 180);
      }
      doc.save(bos);
      return bos.toByteArray();
    }
  }
}
