package com.easytoolhub.pdf;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.easytoolhub.pdf.platform.UrlSafety;
import org.junit.jupiter.api.Test;

class UrlSafetyTest {
  @Test
  void allowsPublicHttps() {
    assertTrue(UrlSafety.requireSafeHttpUrl("https://example.com/path").getHost().contains("example"));
  }

  @Test
  void blocksLocalhost() {
    assertThrows(IllegalArgumentException.class, () -> UrlSafety.requireSafeHttpUrl("http://localhost/admin"));
  }

  @Test
  void blocksFileScheme() {
    assertThrows(IllegalArgumentException.class, () -> UrlSafety.requireSafeHttpUrl("file:///etc/passwd"));
  }
}
