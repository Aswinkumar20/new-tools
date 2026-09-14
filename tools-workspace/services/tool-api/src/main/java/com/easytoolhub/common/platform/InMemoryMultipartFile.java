package com.easytoolhub.common.platform;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import org.springframework.web.multipart.MultipartFile;

/** Tiny MultipartFile wrapper for in-memory PDF bytes (no disk spill). */
public final class InMemoryMultipartFile implements MultipartFile {
  private final String name;
  private final String originalFilename;
  private final String contentType;
  private final byte[] bytes;

  public InMemoryMultipartFile(String name, String originalFilename, String contentType, byte[] bytes) {
    this.name = name == null ? "file" : name;
    this.originalFilename = originalFilename == null ? "document.pdf" : originalFilename;
    this.contentType = contentType == null ? "application/pdf" : contentType;
    this.bytes = bytes == null ? new byte[0] : bytes;
  }

  public static InMemoryMultipartFile pdf(String filename, byte[] bytes) {
    return new InMemoryMultipartFile("file", filename, "application/pdf", bytes);
  }

  @Override
  public String getName() {
    return name;
  }

  @Override
  public String getOriginalFilename() {
    return originalFilename;
  }

  @Override
  public String getContentType() {
    return contentType;
  }

  @Override
  public boolean isEmpty() {
    return bytes.length == 0;
  }

  @Override
  public long getSize() {
    return bytes.length;
  }

  @Override
  public byte[] getBytes() {
    return bytes;
  }

  @Override
  public InputStream getInputStream() {
    return new ByteArrayInputStream(bytes);
  }

  @Override
  public void transferTo(File dest) throws IOException {
    Files.write(dest.toPath(), bytes);
  }
}
