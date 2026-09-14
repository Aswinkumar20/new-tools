package com.easytoolhub.common.security;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Decodes sensitive form fields that the Angular client Base64-encodes
 * before upload so passwords are not sent as raw plaintext in multipart parts.
 */
public final class SensitivePayload {
  private SensitivePayload() {}

  public static String decode(String encoded) {
    if (encoded == null || encoded.isBlank()) {
      return encoded;
    }
    try {
      byte[] raw = Base64.getDecoder().decode(encoded.trim());
      return new String(raw, StandardCharsets.UTF_8);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException(
          "Sensitive field must be Base64-encoded UTF-8 (client encode / server decode)."
      );
    }
  }
}
