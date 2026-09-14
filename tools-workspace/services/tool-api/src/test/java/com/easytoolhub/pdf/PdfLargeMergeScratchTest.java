package com.easytoolhub.pdf;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.easytoolhub.common.config.ToolApiProperties;
import com.easytoolhub.common.platform.InMemoryMultipartFile;
import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.pdf.application.PdfOperationsService;
import com.easytoolhub.pdf.config.PdfProperties;
import com.easytoolhub.pdf.engine.ghostscript.GhostscriptEngine;
import com.easytoolhub.pdf.engine.pdfbox.HtmlPdfEngine;
import com.easytoolhub.pdf.engine.pdfbox.PdfBoxEngine;
import com.easytoolhub.pdf.engine.qpdf.QpdfEngine;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PdfLargeMergeScratchTest {
  @TempDir Path tempDir;
  private PdfOperationsService ops;

  @BeforeEach
  void setUp() throws Exception {
    ToolApiProperties app = new ToolApiProperties(tempDir.toString(), 5, "http://localhost:4200", 200, 120, "memory");
    TempWorkspace workspace = new TempWorkspace(app);
    Files.createDirectories(tempDir.resolve("multipart"));
    // Force scratch path via low thresholds
    PdfProperties pdf = new PdfProperties(
        500, "qpdf", "gs", "", 25,
        40, 200, 104_857_600L, 100.0, 2,
        100L, 2, "", 150);
    ops = new PdfOperationsService(
        new PdfBoxEngine(),
        new QpdfEngine(pdf),
        new GhostscriptEngine(pdf),
        new HtmlPdfEngine(),
        workspace,
        pdf
    );
  }

  @Test
  void scratchMergeProducesCombinedPdf() throws Exception {
    var a = InMemoryMultipartFile.pdf("a.pdf", samplePdf());
    var b = InMemoryMultipartFile.pdf("b.pdf", samplePdf());
    assertTrue(ops.shouldUseLargeMergePath(List.of(a, b)));

    byte[] merged = ops.mergeWithScratch(List.of(a, b));
    try (PDDocument doc = Loader.loadPDF(merged)) {
      assertTrue(doc.getNumberOfPages() >= 2);
    }
  }

  private static byte[] samplePdf() throws Exception {
    try (PDDocument doc = new PDDocument();
         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      doc.addPage(new PDPage(PDRectangle.LETTER));
      doc.save(bos);
      return bos.toByteArray();
    }
  }
}
