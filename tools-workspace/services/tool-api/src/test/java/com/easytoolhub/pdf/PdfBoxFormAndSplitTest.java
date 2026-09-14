package com.easytoolhub.pdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.easytoolhub.pdf.engine.pdfbox.PdfBoxEngine;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDTextField;
import org.junit.jupiter.api.Test;

class PdfBoxFormAndSplitTest {
  private final PdfBoxEngine engine = new PdfBoxEngine();

  @Test
  void splitToZipCreatesParts() throws Exception {
    byte[] pdf = createMultiPagePdf(4);
    byte[] zipBytes = engine.splitToZip(pdf, List.of("1-2", "3-4"), "part");
    int entries = 0;
    try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
      ZipEntry entry;
      while ((entry = zip.getNextEntry()) != null) {
        assertTrue(entry.getName().endsWith(".pdf"));
        entries++;
      }
    }
    assertEquals(2, entries);
  }

  @Test
  void fillAndFlattenForm() throws Exception {
    byte[] pdf = createFormPdf();
    Map<String, String> values = new LinkedHashMap<>();
    values.put("name", "Ada Lovelace");
    byte[] filled = engine.fillFormFields(pdf, values);
    try (PDDocument doc = Loader.loadPDF(filled)) {
      PDAcroForm form = doc.getDocumentCatalog().getAcroForm();
      assertEquals("Ada Lovelace", form.getField("name").getValueAsString());
    }
    byte[] flat = engine.flattenForm(filled);
    try (PDDocument doc = Loader.loadPDF(flat)) {
      PDAcroForm form = doc.getDocumentCatalog().getAcroForm();
      assertTrue(form == null || form.getFields() == null || form.getFields().isEmpty());
    }
  }

  @Test
  void validateRequiredFieldsReportsMissing() throws Exception {
    byte[] blank = createMultiPagePdf(1);
    String fieldsJson =
        "[{\"name\":\"full_name\",\"label\":\"Name\",\"type\":\"text\",\"required\":true,\"page\":0,\"x\":50,\"y\":700,\"width\":200,\"height\":20},"
            + "{\"name\":\"notes\",\"label\":\"Notes\",\"type\":\"text\",\"required\":false,\"page\":0,\"x\":50,\"y\":650,\"width\":200,\"height\":20}]";
    byte[] withFields = engine.createFormFields(blank, fieldsJson);
    Map<String, Object> missing = engine.validateFormRequired(withFields);
    assertEquals(false, missing.get("valid"));
    assertEquals(1, missing.get("missingCount"));
    assertEquals(1, missing.get("requiredCount"));

    Map<String, String> values = new LinkedHashMap<>();
    values.put("full_name", "Ada Lovelace");
    byte[] filled = engine.fillFormFields(withFields, values);
    Map<String, Object> ok = engine.validateFormRequired(filled);
    assertEquals(true, ok.get("valid"));
    assertEquals(0, ok.get("missingCount"));
  }

  @Test
  void annotateAddsContent() throws Exception {
    byte[] pdf = createMultiPagePdf(1);
    String json = "[{\"type\":\"highlight\",\"pageIndex\":0,\"x\":50,\"y\":700,\"width\":100,\"height\":20,\"opacity\":0.4}]";
    byte[] out = engine.applyAnnotations(pdf, json);
    assertTrue(out.length > pdf.length / 2);
  }

  private static byte[] createMultiPagePdf(int pages) throws Exception {
    try (PDDocument doc = new PDDocument();
         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      for (int i = 0; i < pages; i++) {
        PDPage page = new PDPage(PDRectangle.LETTER);
        doc.addPage(page);
        try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
          cs.beginText();
          cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
          cs.newLineAtOffset(72, 720);
          cs.showText("Page " + (i + 1));
          cs.endText();
        }
      }
      doc.save(bos);
      return bos.toByteArray();
    }
  }

  private static byte[] createFormPdf() throws Exception {
    try (PDDocument doc = new PDDocument();
         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      PDPage page = new PDPage(PDRectangle.LETTER);
      doc.addPage(page);
      PDAcroForm form = new PDAcroForm(doc);
      doc.getDocumentCatalog().setAcroForm(form);
      PDTextField field = new PDTextField(form);
      field.setPartialName("name");
      form.getFields().add(field);
      doc.save(bos);
      return bos.toByteArray();
    }
  }
}
