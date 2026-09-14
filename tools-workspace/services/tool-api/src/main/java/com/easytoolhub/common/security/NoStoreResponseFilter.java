package com.easytoolhub.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Prevent browsers/proxies from caching uploaded or generated document payloads. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class NoStoreResponseFilter extends OncePerRequestFilter {
  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    if (request.getRequestURI() != null && request.getRequestURI().startsWith("/api/")) {
      response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      response.setHeader("Pragma", "no-cache");
      response.setHeader("Expires", "0");
    }
    filterChain.doFilter(request, response);
  }
}
