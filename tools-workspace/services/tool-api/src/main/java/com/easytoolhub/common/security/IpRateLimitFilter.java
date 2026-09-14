package com.easytoolhub.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Lightweight per-IP rate limit for mutating /api/** calls.
 * In-memory Stage-1 guard — swap for Bucket4j/Redis when running multiple replicas.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class IpRateLimitFilter extends OncePerRequestFilter {
  private final int limitPerMinute;
  private final Map<String, Window> windows = new ConcurrentHashMap<>();

  public IpRateLimitFilter(@Value("${app.rate-limit-per-minute:120}") int limitPerMinute) {
    this.limitPerMinute = Math.max(10, limitPerMinute);
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getRequestURI();
    if (path == null || !path.startsWith("/api/")) {
      return true;
    }
    String method = request.getMethod();
    if ("OPTIONS".equalsIgnoreCase(method)) {
      return true;
    }
    // Allow health + job polling/download without burning write budget.
    if ("GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)) {
      return true;
    }
    return false;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    String ip = clientIp(request);
    long now = System.currentTimeMillis();
    prune(now);
    Window window = windows.computeIfAbsent(ip, k -> new Window(now));
    synchronized (window) {
      if (now - window.windowStartMs >= 60_000L) {
        window.windowStartMs = now;
        window.count.set(0);
      }
      if (window.count.incrementAndGet() > limitPerMinute) {
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.getWriter().write(
            "{\"title\":\"Too Many Requests\",\"status\":429,\"detail\":\"Rate limit exceeded — try again shortly\"}"
        );
        return;
      }
    }
    filterChain.doFilter(request, response);
  }

  private void prune(long now) {
    if (windows.size() < 2_000) {
      return;
    }
    Iterator<Map.Entry<String, Window>> it = windows.entrySet().iterator();
    while (it.hasNext()) {
      Map.Entry<String, Window> e = it.next();
      if (now - e.getValue().windowStartMs > 120_000L) {
        it.remove();
      }
    }
  }

  private static String clientIp(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      int comma = forwarded.indexOf(',');
      return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
    }
    String real = request.getHeader("X-Real-IP");
    if (real != null && !real.isBlank()) {
      return real.trim();
    }
    return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
  }

  private static final class Window {
    volatile long windowStartMs;
    final AtomicInteger count = new AtomicInteger();

    Window(long startMs) {
      this.windowStartMs = startMs;
    }
  }
}
