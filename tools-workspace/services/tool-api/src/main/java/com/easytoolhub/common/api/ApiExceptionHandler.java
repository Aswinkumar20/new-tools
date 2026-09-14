package com.easytoolhub.common.api;

import java.util.NoSuchElementException;
import java.util.concurrent.RejectedExecutionException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(IllegalArgumentException.class)
  public ProblemDetail badRequest(IllegalArgumentException ex) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, safeDetail(ex.getMessage(), "Bad request"));
    pd.setTitle("Bad Request");
    return pd;
  }

  @ExceptionHandler(NoSuchElementException.class)
  public ProblemDetail notFound(NoSuchElementException ex) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, safeDetail(ex.getMessage(), "Not found"));
    pd.setTitle("Not Found");
    return pd;
  }

  @ExceptionHandler({IllegalStateException.class, RejectedExecutionException.class})
  public ProblemDetail unavailable(RuntimeException ex) {
    String msg = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase();
    boolean busy = msg.contains("too many") || msg.contains("concurrent") || ex instanceof RejectedExecutionException;
    HttpStatus status = busy ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.UNPROCESSABLE_ENTITY;
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, safeDetail(ex.getMessage(), "Processing failed"));
    pd.setTitle(busy ? "Busy" : "Processing Failed");
    return pd;
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ProblemDetail tooLarge(MaxUploadSizeExceededException ex) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.PAYLOAD_TOO_LARGE, "File exceeds upload limit");
    pd.setTitle("Payload Too Large");
    return pd;
  }

  @ExceptionHandler(Exception.class)
  public ProblemDetail generic(Exception ex) {
    Throwable root = ex;
    while (root.getCause() != null && root.getCause() != root) {
      root = root.getCause();
    }
    // Prefer safe, short client-facing detail — avoid leaking paths/stack internals.
    String detail = safeDetail(root.getMessage(), "Request processing failed");
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, detail);
    pd.setTitle("Internal Error");
    return pd;
  }

  private static String safeDetail(String message, String fallback) {
    if (message == null || message.isBlank()) {
      return fallback;
    }
    String cleaned = message.replaceAll("[\\r\\n\\t]+", " ").trim();
    // Strip absolute paths that may appear in IOException messages.
    cleaned = cleaned.replaceAll("(/[^\\s]+)+", "[path]");
    if (cleaned.length() > 240) {
      cleaned = cleaned.substring(0, 240);
    }
    return cleaned;
  }
}
