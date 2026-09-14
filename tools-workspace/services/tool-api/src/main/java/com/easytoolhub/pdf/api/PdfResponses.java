package com.easytoolhub.pdf.api;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

final class PdfResponses {
  private PdfResponses() {}

  static ResponseEntity<ByteArrayResource> pdf(byte[] bytes, String filename) {
    return bytes(bytes, filename, MediaType.APPLICATION_PDF);
  }

  static ResponseEntity<ByteArrayResource> zip(byte[] bytes, String filename) {
    return bytes(bytes, filename, MediaType.parseMediaType("application/zip"));
  }

  static ResponseEntity<ByteArrayResource> text(byte[] bytes, String filename) {
    return bytes(bytes, filename, MediaType.TEXT_PLAIN);
  }

  static ResponseEntity<ByteArrayResource> json(byte[] bytes, String filename) {
    return bytes(bytes, filename, MediaType.APPLICATION_JSON);
  }

  static ResponseEntity<ByteArrayResource> html(byte[] bytes, String filename) {
    return bytes(bytes, filename, MediaType.TEXT_HTML);
  }

  static ResponseEntity<ByteArrayResource> markdown(byte[] bytes, String filename) {
    return bytes(bytes, filename, MediaType.parseMediaType("text/markdown"));
  }

  static ResponseEntity<ByteArrayResource> csv(byte[] bytes, String filename) {
    return bytes(bytes, filename, MediaType.parseMediaType("text/csv"));
  }

  static ResponseEntity<ByteArrayResource> epub(byte[] bytes, String filename) {
    return bytes(bytes, filename, MediaType.parseMediaType("application/epub+zip"));
  }

  static ResponseEntity<ByteArrayResource> docx(byte[] bytes, String filename) {
    return bytes(
        bytes,
        filename,
        MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    );
  }

  static ResponseEntity<ByteArrayResource> xfdf(byte[] bytes, String filename) {
    return bytes(bytes, filename, MediaType.parseMediaType("application/vnd.adobe.xfdf"));
  }

  static ResponseEntity<ByteArrayResource> bytes(byte[] bytes, String filename, MediaType type) {
    ByteArrayResource body = new ByteArrayResource(bytes);
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .contentType(type)
        .contentLength(bytes.length)
        .body(body);
  }
}
