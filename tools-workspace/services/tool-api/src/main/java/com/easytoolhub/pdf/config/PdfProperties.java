package com.easytoolhub.pdf.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** PDF-domain settings only. Shared app settings live under {@code app.*}. */
@ConfigurationProperties(prefix = "pdf")
public record PdfProperties(
    int maxPages,
    String qpdfBin,
    String gsBin,
    /** Empty = auto-detect common tessdata locations / TESSDATA_PREFIX. */
    String tessdataPath,
    /** Soft cap for sync OCR jobs (scanned PDFs are expensive). */
    int ocrMaxPages,
    /** Max PDFs accepted in one batch job. */
    int batchMaxFiles,
    /** Max ZIP entries (including non-PDF) before reject. */
    int batchMaxZipEntries,
    /** Max total uncompressed bytes extracted from a batch ZIP. */
    long batchMaxUncompressedBytes,
    /** Reject ZIP entries whose compression ratio exceeds this (zip-bomb guard). */
    double batchMaxCompressionRatio,
    /** Max concurrent batch jobs on this instance. */
    int batchMaxConcurrentJobs,
    /**
     * Slice 7 — when merge/split input exceeds this many bytes, use scratch-file
     * stream cache (and Angular prefers the async job endpoints).
     */
    long largeFileThresholdBytes,
    /** Prefer large/async merge path when this many files are uploaded. */
    int largeMergeMinFiles,
    /** Chromium / Chrome binary for URL → PDF (empty = auto-detect). */
    String chromiumBin,
    /** Soft cap for preview DPI. */
    int previewMaxDpi
) {}
