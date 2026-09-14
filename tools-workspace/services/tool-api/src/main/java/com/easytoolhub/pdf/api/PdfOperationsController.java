package com.easytoolhub.pdf.api;

import com.easytoolhub.common.security.SensitivePayload;
import com.easytoolhub.pdf.application.PdfLargeFileJobService;
import com.easytoolhub.pdf.application.PdfOperationsService;
import com.easytoolhub.pdf.job.PdfJobSnapshot;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/pdf")
public class PdfOperationsController {
  private final PdfOperationsService ops;
  private final PdfLargeFileJobService largeJobs;

  public PdfOperationsController(PdfOperationsService ops, PdfLargeFileJobService largeJobs) {
    this.ops = ops;
    this.largeJobs = largeJobs;
  }

  @PostMapping("/encrypt")
  public ResponseEntity<ByteArrayResource> encrypt(
      @RequestPart("file") MultipartFile file,
      @RequestParam("userPassword") String userPassword,
      @RequestParam(value = "ownerPassword", required = false) String ownerPassword,
      @RequestParam(value = "allowPrint", defaultValue = "true") boolean allowPrint,
      @RequestParam(value = "allowModify", defaultValue = "false") boolean allowModify
  ) throws Exception {
    return PdfResponses.pdf(
        ops.encrypt(
            file,
            SensitivePayload.decode(userPassword),
            ownerPassword == null || ownerPassword.isBlank()
                ? ownerPassword
                : SensitivePayload.decode(ownerPassword),
            allowPrint,
            allowModify
        ),
        "encrypted.pdf"
    );
  }

  @PostMapping("/decrypt")
  public ResponseEntity<ByteArrayResource> decrypt(
      @RequestPart("file") MultipartFile file,
      @RequestParam("password") String password
  ) throws Exception {
    return PdfResponses.pdf(
        ops.decrypt(file, SensitivePayload.decode(password)),
        "decrypted.pdf"
    );
  }

  @PostMapping("/compress")
  public ResponseEntity<ByteArrayResource> compress(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "quality", defaultValue = "medium") String quality
  ) throws Exception {
    return PdfResponses.pdf(ops.compress(file, quality), "compressed.pdf");
  }

  @PostMapping("/merge")
  public ResponseEntity<ByteArrayResource> merge(
      @RequestPart("files") List<MultipartFile> files
  ) throws Exception {
    return PdfResponses.pdf(ops.merge(files), "merged.pdf");
  }

  @PostMapping("/merge-async")
  public Map<String, Object> mergeAsync(@RequestPart("files") List<MultipartFile> files) throws Exception {
    return jobJson(largeJobs.submitMerge(files));
  }

  @PostMapping("/extract")
  public ResponseEntity<ByteArrayResource> extract(
      @RequestPart("file") MultipartFile file,
      @RequestParam("pages") String pages
  ) throws Exception {
    return PdfResponses.pdf(ops.extract(file, pages), "extracted.pdf");
  }

  @PostMapping("/delete-pages")
  public ResponseEntity<ByteArrayResource> deletePages(
      @RequestPart("file") MultipartFile file,
      @RequestParam("pages") String pages
  ) throws Exception {
    return PdfResponses.pdf(ops.delete(file, pages), "deleted-pages.pdf");
  }

  @PostMapping("/rotate")
  public ResponseEntity<ByteArrayResource> rotate(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "pages", required = false) String pages,
      @RequestParam(value = "degrees", defaultValue = "90") int degrees
  ) throws Exception {
    return PdfResponses.pdf(ops.rotate(file, pages, degrees), "rotated.pdf");
  }

  @PostMapping("/reorder")
  public ResponseEntity<ByteArrayResource> reorder(
      @RequestPart("file") MultipartFile file,
      @RequestParam("order") String order
  ) throws Exception {
    return PdfResponses.pdf(ops.reorder(file, order), "reordered.pdf");
  }

  @PostMapping("/watermark")
  public ResponseEntity<ByteArrayResource> watermark(
      @RequestPart("file") MultipartFile file,
      @RequestParam("text") String text,
      @RequestParam(value = "opacity", defaultValue = "0.25") float opacity
  ) throws Exception {
    return PdfResponses.pdf(ops.watermark(file, text, opacity), "watermarked.pdf");
  }

  @PostMapping("/page-numbers")
  public ResponseEntity<ByteArrayResource> pageNumbers(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "startAt", defaultValue = "1") int startAt
  ) throws Exception {
    return PdfResponses.pdf(ops.pageNumbers(file, startAt), "page-numbers.pdf");
  }

  @PostMapping("/metadata")
  public ResponseEntity<ByteArrayResource> metadata(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "title", required = false) String title,
      @RequestParam(value = "author", required = false) String author,
      @RequestParam(value = "subject", required = false) String subject,
      @RequestParam(value = "keywords", required = false) String keywords
  ) throws Exception {
    return PdfResponses.pdf(ops.metadata(file, title, author, subject, keywords), "metadata.pdf");
  }

  @PostMapping("/images-to-pdf")
  public ResponseEntity<ByteArrayResource> imagesToPdf(
      @RequestPart("files") List<MultipartFile> files
  ) throws Exception {
    return PdfResponses.pdf(ops.imagesToPdf(files), "images.pdf");
  }

  @PostMapping("/html-to-pdf")
  public ResponseEntity<ByteArrayResource> htmlToPdf(
      @RequestParam("html") String html
  ) throws Exception {
    return PdfResponses.pdf(ops.htmlToPdf(html), "from-html.pdf");
  }

  @PostMapping("/text-to-pdf")
  public ResponseEntity<ByteArrayResource> textToPdf(
      @RequestParam("text") String text
  ) throws Exception {
    return PdfResponses.pdf(ops.textToPdf(text), "from-text.pdf");
  }

  @PostMapping("/pdf-to-text")
  public ResponseEntity<ByteArrayResource> pdfToText(
      @RequestPart("file") MultipartFile file
  ) throws Exception {
    return PdfResponses.text(ops.pdfToText(file), "extracted.txt");
  }

  @PostMapping("/pdf-to-images")
  public ResponseEntity<ByteArrayResource> pdfToImages(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "dpi", defaultValue = "150") int dpi
  ) throws Exception {
    return PdfResponses.zip(ops.pdfToImages(file, dpi), "pages.zip");
  }

  @PostMapping("/split")
  public ResponseEntity<ByteArrayResource> split(
      @RequestPart("file") MultipartFile file,
      @RequestParam("ranges") String ranges,
      @RequestParam(value = "prefix", defaultValue = "split") String prefix
  ) throws Exception {
    return PdfResponses.zip(ops.split(file, ranges, prefix), "split.zip");
  }

  @PostMapping("/split-async")
  public Map<String, Object> splitAsync(
      @RequestPart("file") MultipartFile file,
      @RequestParam("ranges") String ranges,
      @RequestParam(value = "prefix", defaultValue = "split") String prefix
  ) throws Exception {
    return jobJson(largeJobs.submitSplit(file, ranges, prefix));
  }

  @PostMapping("/fill-form")
  public ResponseEntity<ByteArrayResource> fillForm(
      @RequestPart("file") MultipartFile file,
      @RequestParam("fields") String fields
  ) throws Exception {
    return PdfResponses.pdf(ops.fillForm(file, fields), "filled.pdf");
  }

  @PostMapping("/flatten-form")
  public ResponseEntity<ByteArrayResource> flattenForm(
      @RequestPart("file") MultipartFile file
  ) throws Exception {
    return PdfResponses.pdf(ops.flattenForm(file), "flattened.pdf");
  }

  @PostMapping("/annotate")
  public ResponseEntity<ByteArrayResource> annotate(
      @RequestPart("file") MultipartFile file,
      @RequestParam("annotations") String annotations
  ) throws Exception {
    return PdfResponses.pdf(ops.annotate(file, annotations), "annotated.pdf");
  }

  @PostMapping("/stamp-image")
  public ResponseEntity<ByteArrayResource> stampImage(
      @RequestPart("file") MultipartFile file,
      @RequestPart("image") MultipartFile image,
      @RequestParam(value = "page", defaultValue = "1") int page,
      @RequestParam("x") float x,
      @RequestParam("y") float y,
      @RequestParam("width") float width,
      @RequestParam("height") float height
  ) throws Exception {
    return PdfResponses.pdf(ops.stampImage(file, image, page, x, y, width, height), "signed.pdf");
  }

  private static Map<String, Object> jobJson(PdfJobSnapshot snap) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("jobId", snap.jobId());
    m.put("status", snap.status().name());
    m.put("operation", snap.operation());
    m.put("total", snap.total());
    m.put("completed", snap.completed());
    m.put("failed", snap.failed());
    m.put("progress", snap.progress());
    m.put("message", snap.message());
    m.put("downloadReady", snap.downloadReady());
    m.put("resultContentType", snap.resultContentType());
    m.put("resultFilename", snap.resultFilename());
    m.put("createdAt", snap.createdAt().toString());
    m.put("updatedAt", snap.updatedAt().toString());
    return m;
  }
}
