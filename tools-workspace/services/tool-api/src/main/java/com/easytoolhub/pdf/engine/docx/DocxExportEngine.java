package com.easytoolhub.pdf.engine.docx;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.stereotype.Component;

/** Best-effort DOCX builder from plain text (LibreOffice preferred when available). */
@Component
public class DocxExportEngine {

  public byte[] textToDocx(String text) throws IOException {
    String body = text == null ? "" : text;
    try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      String[] paragraphs = body.replace("\r\n", "\n").split("\n");
      for (String line : paragraphs) {
        XWPFParagraph p = doc.createParagraph();
        XWPFRun run = p.createRun();
        run.setFontFamily("Calibri");
        run.setFontSize(11);
        run.setText(line.isEmpty() ? " " : line);
      }
      if (paragraphs.length == 0) {
        doc.createParagraph().createRun().setText(" ");
      }
      doc.write(bos);
      return bos.toByteArray();
    }
  }

  public byte[] utf8(String text) {
    return (text == null ? "" : text).getBytes(StandardCharsets.UTF_8);
  }
}
