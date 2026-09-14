package com.easytoolhub.pdf.platform;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;

/** Blocks SSRF targets for URL → PDF. */
public final class UrlSafety {
  private UrlSafety() {}

  public static URI requireSafeHttpUrl(String raw) {
    if (raw == null || raw.isBlank()) {
      throw new IllegalArgumentException("URL is required");
    }
    String trimmed = raw.trim();
    URI uri;
    try {
      uri = URI.create(trimmed);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid URL");
    }
    String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
    if (!scheme.equals("http") && !scheme.equals("https")) {
      throw new IllegalArgumentException("Only http and https URLs are allowed");
    }
    String host = uri.getHost();
    if (host == null || host.isBlank()) {
      throw new IllegalArgumentException("URL host is required");
    }
    String hostLower = host.toLowerCase(Locale.ROOT);
    if (hostLower.equals("localhost")
        || hostLower.endsWith(".localhost")
        || hostLower.equals("metadata.google.internal")) {
      throw new IllegalArgumentException("URL host is not allowed");
    }
    try {
      for (InetAddress addr : InetAddress.getAllByName(host)) {
        if (isBlockedAddress(addr)) {
          throw new IllegalArgumentException("URL resolves to a private or local address");
        }
      }
    } catch (UnknownHostException e) {
      throw new IllegalArgumentException("Unable to resolve URL host");
    }
    return uri;
  }

  private static boolean isBlockedAddress(InetAddress addr) {
    return addr.isAnyLocalAddress()
        || addr.isLoopbackAddress()
        || addr.isLinkLocalAddress()
        || addr.isSiteLocalAddress()
        || addr.isMulticastAddress();
  }
}
