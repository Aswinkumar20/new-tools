package com.easytoolhub.pdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.easytoolhub.common.config.ToolApiProperties;
import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.pdf.application.PdfAdvancedOperationsService;
import com.easytoolhub.pdf.application.PdfOperationsService;
import com.easytoolhub.pdf.config.PdfProperties;
import com.easytoolhub.pdf.engine.ghostscript.GhostscriptEngine;
import com.easytoolhub.pdf.engine.libreoffice.LibreOfficeEngine;
import com.easytoolhub.pdf.engine.ocr.OcrEngine;
import com.easytoolhub.pdf.engine.pdfbox.HtmlPdfEngine;
import com.easytoolhub.pdf.engine.pdfbox.PdfBoxEngine;
import com.easytoolhub.pdf.engine.qpdf.QpdfEngine;
import com.easytoolhub.pdf.engine.signature.Pkcs12SignatureEngine;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfAdvancedOperationsServiceTest {
  private PdfAdvancedOperationsService service;
  private MockMultipartFile samplePdf;

  @BeforeEach
  void setUp() throws Exception {
    PdfBoxEngine pdfBox = new PdfBoxEngine();
    PdfProperties pdfProps = new PdfProperties(500, "qpdf", "gs", "", 25, 40, 200, 104_857_600L, 100.0, 2, 8_388_608L, 5, "", 150);
    GhostscriptEngine gs = new GhostscriptEngine(pdfProps);
    QpdfEngine qpdf = new QpdfEngine(pdfProps);
    LibreOfficeEngine libre = new LibreOfficeEngine();
    HtmlPdfEngine htmlPdf = new HtmlPdfEngine();
    TempWorkspace temp = new TempWorkspace(new ToolApiProperties("/tmp/tool-api-test", 10, "http://localhost:4200", 200, 120, "memory"));
    PdfOperationsService basic = new PdfOperationsService(pdfBox, qpdf, gs, htmlPdf, temp, pdfProps);
    OcrEngine ocr = new OcrEngine(pdfProps);
    Pkcs12SignatureEngine pkcs12 = new Pkcs12SignatureEngine();
    service = new PdfAdvancedOperationsService(
        pdfBox,
        gs,
        qpdf,
        libre,
        basic,
        ocr,
        pkcs12,
        new com.easytoolhub.pdf.engine.chromium.ChromiumPdfEngine(pdfProps),
        new com.easytoolhub.pdf.engine.docx.DocxExportEngine(),
        htmlPdf,
        new com.easytoolhub.pdf.engine.scan.ScanCleanupEngine(),
        temp,
        new ObjectMapper()
    );
    samplePdf = new MockMultipartFile(
        "file",
        "sample.pdf",
        "application/pdf",
        createSamplePdf()
    );
  }

  @Test
  void toTxtExtractsText() throws Exception {
    byte[] out = service.toTxt(samplePdf);
    String text = new String(out, StandardCharsets.UTF_8);
    assertTrue(text.contains("Hello EasyToolHub"));
    assertTrue(text.contains("Contact alice@example.com"));
  }

  @Test
  void removeMetadataClearsTitle() throws Exception {
    byte[] cleaned = service.removeMetadata(samplePdf);
    try (PDDocument doc = Loader.loadPDF(cleaned)) {
      PDDocumentInformation info = doc.getDocumentInformation();
      assertTrue(info.getTitle() == null || info.getTitle().isBlank());
      assertTrue(info.getAuthor() == null || info.getAuthor().isBlank());
    }
  }

  @Test
  void summarizeReturnsExtractiveText() throws Exception {
    byte[] out = service.summarize(samplePdf, 2);
    String summary = new String(out, StandardCharsets.UTF_8).trim();
    assertFalse(summary.isBlank());
    assertTrue(summary.length() > 10);
  }

  @Test
  void detectPiiFindsEmail() throws Exception {
    byte[] out = service.detectPii(samplePdf);
    JsonNode json = new ObjectMapper().readTree(out);
    assertTrue(json.path("hasPii").asBoolean());
    assertTrue(json.path("emails").toString().contains("alice@example.com"));
  }

  @Test
  void duplicatePagesIncreasesPageCount() throws Exception {
    try (PDDocument before = Loader.loadPDF(samplePdf.getBytes())) {
      assertEquals(1, before.getNumberOfPages());
    }
    byte[] duplicated = service.duplicatePages(samplePdf, "1");
    try (PDDocument after = Loader.loadPDF(duplicated)) {
      assertEquals(2, after.getNumberOfPages());
    }
  }

  private static byte[] createSamplePdf() throws Exception {
    try (PDDocument doc = new PDDocument(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      PDPage page = new PDPage(PDRectangle.LETTER);
      doc.addPage(page);
      PDDocumentInformation info = new PDDocumentInformation();
      info.setTitle("Sample Title");
      info.setAuthor("Sample Author");
      doc.setDocumentInformation(info);
      try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
        cs.newLineAtOffset(50, 700);
        cs.showText("Hello EasyToolHub. This document discusses invoices and contracts.");
        cs.newLineAtOffset(0, -20);
        cs.showText("Contact alice@example.com for support regarding payments.");
        cs.newLineAtOffset(0, -20);
        cs.showText("The quick summary sentence helps extractive summarization tests.");
        cs.endText();
      }
      doc.save(bos);
      return bos.toByteArray();
    }
  }
}
