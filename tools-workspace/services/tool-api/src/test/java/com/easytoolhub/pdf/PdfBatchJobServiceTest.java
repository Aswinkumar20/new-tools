package com.easytoolhub.pdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.easytoolhub.common.config.ToolApiProperties;
import com.easytoolhub.common.platform.InMemoryMultipartFile;
import com.easytoolhub.common.platform.TempWorkspace;
import com.easytoolhub.pdf.application.PdfBatchJobService;
import com.easytoolhub.pdf.config.PdfProperties;
import com.easytoolhub.pdf.engine.pdfbox.PdfBoxEngine;
import com.easytoolhub.pdf.job.InMemoryPdfJobStore;
import com.easytoolhub.pdf.job.PdfJobSnapshot;
import com.easytoolhub.pdf.job.PdfJobStatus;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PdfBatchJobServiceTest {
  @TempDir Path tempDir;

  private PdfBatchJobService service;

  @BeforeEach
  void setUp() throws Exception {
    ToolApiProperties app = new ToolApiProperties(tempDir.toString(), 5, "http://localhost:4200", 200, 120, "memory");
    TempWorkspace workspace = new TempWorkspace(app);
    Files.createDirectories(tempDir.resolve("multipart"));

    PdfProperties pdf = new PdfProperties(
        500, "qpdf", "gs", "", 25,
        40, 200, 104_857_600L, 100.0, 2, 8_388_608L, 5, "", 150);

    InMemoryPdfJobStore store = new InMemoryPdfJobStore(workspace, app);
    service = new PdfBatchJobService(
        new PdfBoxEngine(),
        workspace,
        store,
        pdf,
        Executors.newSingleThreadExecutor(),
        new Semaphore(2)
    );
  }

  @Test
  void batchFromMultipartPdfsCompletesAndDownloads() throws Exception {
    var f1 = InMemoryMultipartFile.pdf("one.pdf", samplePdfWithTitle("One"));
    var f2 = InMemoryMultipartFile.pdf("two.pdf", samplePdfWithTitle("Two"));

    PdfJobSnapshot submitted = service.submit(null, List.of(f1, f2), "remove-metadata", Map.of());
    assertEquals(PdfJobStatus.QUEUED, submitted.status());
    assertEquals(2, submitted.total());

    PdfJobSnapshot done = awaitDone(submitted.jobId(), 15_000);
    assertEquals(PdfJobStatus.COMPLETED, done.status());
    assertEquals(2, done.completed());
    assertTrue(done.downloadReady());

    byte[] resultZip = service.download(done.jobId());
    assertTrue(resultZip.length > 100);
    assertEquals(2, countZipEntries(resultZip));
  }

  @Test
  void batchFromZipCompletes() throws Exception {
    Map<String, byte[]> pdfs = new LinkedHashMap<>();
    pdfs.put("a.pdf", samplePdfWithTitle("Alpha"));
    pdfs.put("b.pdf", samplePdfWithTitle("Beta"));
    byte[] zipBytes = zipOfPdfs(pdfs);

    var zipFile = new InMemoryMultipartFile("file", "docs.zip", "application/zip", zipBytes);
    PdfJobSnapshot submitted = service.submit(zipFile, null, "remove-metadata", Map.of());
    PdfJobSnapshot done = awaitDone(submitted.jobId(), 15_000);
    assertEquals(PdfJobStatus.COMPLETED, done.status());
    assertEquals(2, done.completed());
  }

  @Test
  void rejectsEmptyUpload() {
    assertThrows(IllegalArgumentException.class,
        () -> service.submit(null, List.of(), "remove-metadata", Map.of()));
  }

  private PdfJobSnapshot awaitDone(String jobId, long timeoutMs) throws Exception {
    long deadline = System.currentTimeMillis() + timeoutMs;
    while (System.currentTimeMillis() < deadline) {
      PdfJobSnapshot snap = service.status(jobId);
      if (snap.status() == PdfJobStatus.COMPLETED || snap.status() == PdfJobStatus.FAILED) {
        return snap;
      }
      Thread.sleep(50);
    }
    throw new AssertionError("Job did not finish in time: " + service.status(jobId));
  }

  private static byte[] samplePdfWithTitle(String title) throws Exception {
    try (PDDocument doc = new PDDocument();
         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      doc.addPage(new PDPage(PDRectangle.LETTER));
      PDDocumentInformation info = new PDDocumentInformation();
      info.setTitle(title);
      doc.setDocumentInformation(info);
      doc.save(bos);
      return bos.toByteArray();
    }
  }

  private static byte[] zipOfPdfs(Map<String, byte[]> files) throws Exception {
    ByteArrayOutputStream bos = new ByteArrayOutputStream();
    try (ZipOutputStream zos = new ZipOutputStream(bos)) {
      for (var e : files.entrySet()) {
        zos.putNextEntry(new ZipEntry(e.getKey()));
        zos.write(e.getValue());
        zos.closeEntry();
      }
    }
    return bos.toByteArray();
  }

  private static int countZipEntries(byte[] zip) throws Exception {
    int n = 0;
    try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zip))) {
      while (zis.getNextEntry() != null) {
        n++;
      }
    }
    return n;
  }
}
