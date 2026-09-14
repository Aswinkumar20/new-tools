package com.easytoolhub.pdf.engine.pdfbox;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.stereotype.Component;

@Component
public class HtmlPdfEngine {

  public byte[] htmlToPdf(String html) throws Exception {
    String wrapped = html == null ? "" : html.trim();
    if (!wrapped.toLowerCase().contains("<html")) {
      wrapped = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/></head><body>"
          + wrapped
          + "</body></html>";
    }
    final String content = wrapped;
    Callable<byte[]> task = () -> {
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      PdfRendererBuilder builder = new PdfRendererBuilder();
      builder.useFastMode();
      builder.withHtmlContent(content, null);
      builder.toStream(out);
      builder.run();
      return out.toByteArray();
    };

    var executor = Executors.newSingleThreadExecutor();
    try {
      Future<byte[]> future = executor.submit(task);
      return future.get(20, TimeUnit.SECONDS);
    } catch (TimeoutException te) {
      throw new IllegalStateException("HTML to PDF timed out", te);
    } finally {
      executor.shutdownNow();
    }
  }
}
