package com.easytoolhub.pdf.engine.scan;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Component;

/**
 * Best-effort scan deskew: estimate skew via horizontal projection variance, rotate, rebuild PDF.
 * Does not require OpenCV.
 */
@Component
public class ScanCleanupEngine {

  public byte[] deskew(byte[] pdfBytes, int dpi, double maxDegrees) throws IOException {
    int renderDpi = Math.max(72, Math.min(200, dpi <= 0 ? 150 : dpi));
    double maxAbs = Math.max(1.0, Math.min(20.0, maxDegrees <= 0 ? 10.0 : maxDegrees));

    try (PDDocument source = Loader.loadPDF(pdfBytes);
         PDDocument out = new PDDocument();
         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      if (source.getNumberOfPages() == 0) {
        throw new IllegalArgumentException("PDF has no pages");
      }
      if (source.getNumberOfPages() > 100) {
        throw new IllegalArgumentException("Deskew is limited to 100 pages per request");
      }
      PDFRenderer renderer = new PDFRenderer(source);
      for (int i = 0; i < source.getNumberOfPages(); i++) {
        BufferedImage image = renderer.renderImageWithDPI(i, renderDpi, ImageType.GRAY);
        double angle = estimateSkewDegrees(image, maxAbs);
        BufferedImage fixed = Math.abs(angle) < 0.15 ? image : rotate(image, -angle);

        PDPage srcPage = source.getPage(i);
        PDRectangle media = srcPage.getMediaBox();
        PDPage page = new PDPage(new PDRectangle(media.getWidth(), media.getHeight()));
        out.addPage(page);
        PDImageXObject xImage = LosslessFactory.createFromImage(out, fixed);
        try (PDPageContentStream cs = new PDPageContentStream(out, page)) {
          cs.drawImage(xImage, 0, 0, media.getWidth(), media.getHeight());
        }
      }
      out.save(bos);
      return bos.toByteArray();
    }
  }

  /** Positive = clockwise degrees estimated from text-line alignment. */
  static double estimateSkewDegrees(BufferedImage image, double maxAbs) {
    BufferedImage gray = toGray(image);
    double bestAngle = 0;
    double bestScore = -1;
    // Coarse then fine search
    for (double angle = -maxAbs; angle <= maxAbs + 1e-9; angle += 1.0) {
      double score = projectionScore(rotate(gray, angle));
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }
    double fineBest = bestAngle;
    for (double angle = bestAngle - 0.8; angle <= bestAngle + 0.8 + 1e-9; angle += 0.2) {
      if (angle < -maxAbs || angle > maxAbs) continue;
      double score = projectionScore(rotate(gray, angle));
      if (score > bestScore) {
        bestScore = score;
        fineBest = angle;
      }
    }
    return fineBest;
  }

  private static double projectionScore(BufferedImage image) {
    int w = image.getWidth();
    int h = image.getHeight();
    if (w < 8 || h < 8) return 0;
    // Sample every other pixel for speed
    long[] rowInk = new long[h];
    for (int y = 0; y < h; y += 1) {
      long ink = 0;
      for (int x = 0; x < w; x += 2) {
        int rgb = image.getRGB(x, y);
        int lum = ((rgb >> 16) & 0xff) + ((rgb >> 8) & 0xff) + (rgb & 0xff);
        if (lum < 360) ink++; // dark-ish
      }
      rowInk[y] = ink;
    }
    double mean = 0;
    for (long v : rowInk) mean += v;
    mean /= rowInk.length;
    double var = 0;
    for (long v : rowInk) {
      double d = v - mean;
      var += d * d;
    }
    return var / rowInk.length;
  }

  static BufferedImage rotate(BufferedImage src, double degrees) {
    if (Math.abs(degrees) < 1e-6) return src;
    double rad = Math.toRadians(degrees);
    double sin = Math.abs(Math.sin(rad));
    double cos = Math.abs(Math.cos(rad));
    int w = src.getWidth();
    int h = src.getHeight();
    int nw = (int) Math.floor(w * cos + h * sin);
    int nh = (int) Math.floor(h * cos + w * sin);
    BufferedImage dst = new BufferedImage(Math.max(1, nw), Math.max(1, nh), BufferedImage.TYPE_BYTE_GRAY);
    Graphics2D g = dst.createGraphics();
    g.setColor(Color.WHITE);
    g.fillRect(0, 0, nw, nh);
    g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
    g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    AffineTransform at = new AffineTransform();
    at.translate((nw - w) / 2.0, (nh - h) / 2.0);
    at.rotate(rad, w / 2.0, h / 2.0);
    g.drawImage(src, at, null);
    g.dispose();
    return dst;
  }

  private static BufferedImage toGray(BufferedImage src) {
    if (src.getType() == BufferedImage.TYPE_BYTE_GRAY) return src;
    BufferedImage gray = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
    Graphics2D g = gray.createGraphics();
    g.drawImage(src, 0, 0, null);
    g.dispose();
    return gray;
  }
}
