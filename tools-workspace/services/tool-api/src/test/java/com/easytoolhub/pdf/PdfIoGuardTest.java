package com.easytoolhub.pdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.easytoolhub.pdf.platform.PdfIoGuard;
import java.io.ByteArrayOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PdfIoGuardTest {
  @Test
  void rejectsNonPdfMagic() {
    assertThrows(IllegalArgumentException.class, () -> PdfIoGuard.assertPdfMagic(new byte[] {1, 2, 3, 4, 5}));
  }

  @Test
  void acceptsPdfAndCountsPages() throws Exception {
    byte[] pdf = samplePdf();
    PdfIoGuard.assertPdfMagic(pdf);
    assertEquals(1, PdfIoGuard.countPages(pdf, 500));
  }

  @Test
  void enforcesPageLimit() throws Exception {
    byte[] pdf = samplePdf();
    assertThrows(IllegalArgumentException.class, () -> PdfIoGuard.countPages(pdf, 0));
  }

  @Test
  void looksLikeZipWithoutReadingBody() throws Exception {
    byte[] zipHead = new byte[] {'P', 'K', 3, 4, 0, 0};
    MockMultipartFile file = new MockMultipartFile("file", "x.bin", "application/octet-stream", zipHead);
    assertTrue(PdfIoGuard.looksLikeZip(file));
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
