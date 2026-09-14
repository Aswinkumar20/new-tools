package com.easytoolhub.common.platform;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.Test;

class TempWorkspaceSanitizeTest {
  @Test
  void rejectsPathTraversalInClientFilenames() {
    assertEquals("secret.pdf", TempWorkspace.sanitizeFileName("../../secret.pdf"));
    assertEquals("upload.bin", TempWorkspace.sanitizeFileName(".."));
    assertEquals("upload.bin", TempWorkspace.sanitizeFileName(""));
    assertFalse(TempWorkspace.sanitizeFileName("/etc/passwd").contains("/"));
  }
}
