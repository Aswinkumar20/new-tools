package com.easytoolhub.pdf.api;

import com.easytoolhub.common.security.SensitivePayload;
import com.easytoolhub.pdf.application.PdfAdvancedOperationsService;
import java.util.List;
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
public class PdfAdvancedOperationsController {
  private final PdfAdvancedOperationsService ops;

  public PdfAdvancedOperationsController(PdfAdvancedOperationsService ops) {
    this.ops = ops;
  }

  @PostMapping("/to-txt")
  public ResponseEntity<ByteArrayResource> toTxt(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.text(ops.toTxt(file), "extracted.txt");
  }

  @PostMapping("/to-html")
  public ResponseEntity<ByteArrayResource> toHtml(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.html(ops.toHtml(file), "converted.html");
  }

  @PostMapping("/to-markdown")
  public ResponseEntity<ByteArrayResource> toMarkdown(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.markdown(ops.toMarkdown(file), "converted.md");
  }

  @PostMapping("/to-csv")
  public ResponseEntity<ByteArrayResource> toCsv(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.csv(ops.toCsv(file), "extracted.csv");
  }

  @PostMapping("/to-json")
  public ResponseEntity<ByteArrayResource> toJson(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.json(ops.toJson(file), "extracted.json");
  }

  @PostMapping("/to-epub")
  public ResponseEntity<ByteArrayResource> toEpub(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.epub(ops.toEpub(file), "converted.epub");
  }

  @PostMapping("/to-pdfa")
  public ResponseEntity<ByteArrayResource> toPdfA(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.pdf(ops.toPdfA(file), "pdfa.pdf");
  }

  @PostMapping("/office-to-pdf")
  public ResponseEntity<ByteArrayResource> officeToPdf(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.pdf(ops.officeToPdf(file), "converted.pdf");
  }

  @PostMapping("/url-to-pdf")
  public ResponseEntity<ByteArrayResource> urlToPdf(@RequestParam("url") String url) throws Exception {
    return PdfResponses.pdf(ops.urlToPdf(url), "page.pdf");
  }

  @PostMapping("/markdown-to-pdf")
  public ResponseEntity<ByteArrayResource> markdownToPdf(
      @RequestParam(value = "markdown", required = false) String markdown,
      @RequestPart(value = "file", required = false) MultipartFile file
  ) throws Exception {
    String md = markdown;
    if ((md == null || md.isBlank()) && file != null && !file.isEmpty()) {
      md = new String(file.getBytes(), java.nio.charset.StandardCharsets.UTF_8);
    }
    return PdfResponses.pdf(ops.markdownToPdf(md), "markdown.pdf");
  }

  @PostMapping("/to-docx")
  public ResponseEntity<ByteArrayResource> toDocx(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.docx(ops.pdfToDocx(file), "converted.docx");
  }

  @PostMapping("/duplicate-pages")
  public ResponseEntity<ByteArrayResource> duplicatePages(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "pages", defaultValue = "1") String pages
  ) throws Exception {
    return PdfResponses.pdf(ops.duplicatePages(file, pages), "duplicated-pages.pdf");
  }

  @PostMapping("/replace-pages")
  public ResponseEntity<ByteArrayResource> replacePages(
      @RequestPart("file") MultipartFile file,
      @RequestPart(value = "replacement", required = false) MultipartFile replacement,
      @RequestParam(value = "pages", defaultValue = "1") String pages
  ) throws Exception {
    return PdfResponses.pdf(ops.replacePages(file, replacement, pages), "replaced-pages.pdf");
  }

  @PostMapping("/crop-pages")
  public ResponseEntity<ByteArrayResource> cropPages(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "left", defaultValue = "36") float left,
      @RequestParam(value = "right", defaultValue = "36") float right,
      @RequestParam(value = "top", defaultValue = "36") float top,
      @RequestParam(value = "bottom", defaultValue = "36") float bottom
  ) throws Exception {
    return PdfResponses.pdf(ops.cropPages(file, left, right, top, bottom), "cropped.pdf");
  }

  @PostMapping("/resize-pages")
  public ResponseEntity<ByteArrayResource> resizePages(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "size", defaultValue = "A4") String size
  ) throws Exception {
    return PdfResponses.pdf(ops.resizePages(file, size), "resized.pdf");
  }

  @PostMapping("/header-footer")
  public ResponseEntity<ByteArrayResource> headerFooter(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "header", defaultValue = "") String header,
      @RequestParam(value = "footer", defaultValue = "") String footer
  ) throws Exception {
    return PdfResponses.pdf(ops.headerFooter(file, header, footer), "header-footer.pdf");
  }

  @PostMapping("/bookmarks")
  public ResponseEntity<ByteArrayResource> bookmarks(
      @RequestPart("file") MultipartFile file,
      @RequestParam("outline") String outline
  ) throws Exception {
    return PdfResponses.pdf(ops.bookmarks(file, outline), "bookmarks.pdf");
  }

  @PostMapping("/table-of-contents")
  public ResponseEntity<ByteArrayResource> tableOfContents(
      @RequestPart("file") MultipartFile file,
      @RequestParam("outline") String outline
  ) throws Exception {
    return PdfResponses.pdf(ops.tableOfContents(file, outline), "toc.pdf");
  }

  @PostMapping("/create-form-field")
  public ResponseEntity<ByteArrayResource> createFormField(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "fieldName", defaultValue = "full_name") String fieldName,
      @RequestParam(value = "label", defaultValue = "Full name") String label,
      @RequestParam(value = "fieldsJson", required = false) String fieldsJson
  ) throws Exception {
    if (fieldsJson != null && !fieldsJson.isBlank()) {
      return PdfResponses.pdf(ops.createFormFields(file, fieldsJson), "form-fields.pdf");
    }
    return PdfResponses.pdf(ops.createFormField(file, fieldName, label), "form-field.pdf");
  }

  @PostMapping("/export-form")
  public ResponseEntity<ByteArrayResource> exportForm(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "format", defaultValue = "json") String format
  ) throws Exception {
    if ("xfdf".equalsIgnoreCase(format)) {
      return PdfResponses.xfdf(ops.exportXfdf(file), "fields.xfdf");
    }
    return PdfResponses.json(ops.exportFormJson(file), "fields.json");
  }

  @PostMapping("/import-form")
  public ResponseEntity<ByteArrayResource> importForm(
      @RequestPart("file") MultipartFile file,
      @RequestParam("values") String values
  ) throws Exception {
    return PdfResponses.pdf(ops.importFormValues(file, values), "form-filled.pdf");
  }

  @PostMapping("/validate-form")
  public ResponseEntity<ByteArrayResource> validateForm(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.validateFormRequired(file), "form-validation.json");
  }

  @PostMapping("/remove-annotations")
  public ResponseEntity<ByteArrayResource> removeAnnotations(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.pdf(ops.removeAnnotations(file), "no-annotations.pdf");
  }

  @PostMapping("/remove-metadata")
  public ResponseEntity<ByteArrayResource> removeMetadata(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.pdf(ops.removeMetadata(file), "no-metadata.pdf");
  }

  @PostMapping("/remove-hidden-data")
  public ResponseEntity<ByteArrayResource> removeHiddenData(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.pdf(ops.removeHiddenData(file), "cleaned.pdf");
  }

  @PostMapping("/verify-signatures")
  public ResponseEntity<ByteArrayResource> verifySignatures(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.verifySignatures(file), "signatures.json");
  }

  @PostMapping("/sign-pkcs12")
  public ResponseEntity<ByteArrayResource> signPkcs12(
      @RequestPart("file") MultipartFile file,
      @RequestPart("certificate") MultipartFile certificate,
      @RequestParam(value = "certificatePassword", defaultValue = "") String certificatePassword,
      @RequestParam(value = "reason", defaultValue = "Document approval") String reason,
      @RequestParam(value = "location", defaultValue = "") String location
  ) throws Exception {
    return PdfResponses.pdf(
        ops.signPkcs12(
            file,
            certificate,
            SensitivePayload.decode(certificatePassword),
            reason,
            location),
        "signed.pdf");
  }

  @PostMapping("/stamp-signature")
  public ResponseEntity<ByteArrayResource> stampSignature(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "signerName", defaultValue = "Signed") String signerName
  ) throws Exception {
    return PdfResponses.pdf(ops.stampSignature(file, signerName), "stamped.pdf");
  }

  @PostMapping("/inspect-fonts")
  public ResponseEntity<ByteArrayResource> inspectFonts(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.inspectFonts(file), "fonts.json");
  }

  @PostMapping("/extract-images")
  public ResponseEntity<ByteArrayResource> extractImages(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.zip(ops.extractImages(file), "images.zip");
  }

  @PostMapping("/extract-links")
  public ResponseEntity<ByteArrayResource> extractLinks(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.extractLinks(file), "links.json");
  }

  @PostMapping("/extract-attachments")
  public ResponseEntity<ByteArrayResource> extractAttachments(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.zip(ops.extractAttachments(file), "attachments.zip");
  }

  @PostMapping("/grayscale")
  public ResponseEntity<ByteArrayResource> grayscale(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.pdf(ops.grayscale(file), "grayscale.pdf");
  }

  @PostMapping("/color-convert")
  public ResponseEntity<ByteArrayResource> colorConvert(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "mode", defaultValue = "rgb") String mode
  ) throws Exception {
    return PdfResponses.pdf(ops.colorConvert(file, mode), "color-converted.pdf");
  }

  @PostMapping("/dpi-convert")
  public ResponseEntity<ByteArrayResource> dpiConvert(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "dpi", defaultValue = "150") int dpi
  ) throws Exception {
    return PdfResponses.pdf(ops.dpiConvert(file, dpi), "dpi-converted.pdf");
  }

  @PostMapping("/web-optimize")
  public ResponseEntity<ByteArrayResource> webOptimize(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.pdf(ops.webOptimize(file), "web-optimized.pdf");
  }

  @PostMapping("/accessibility-check")
  public ResponseEntity<ByteArrayResource> accessibilityCheck(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.accessibilityCheck(file), "accessibility.json");
  }

  @PostMapping("/validate")
  public ResponseEntity<ByteArrayResource> validate(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.validate(file), "validate.json");
  }

  @PostMapping("/repair")
  public ResponseEntity<ByteArrayResource> repair(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.pdf(ops.repair(file), "repaired.pdf");
  }

  @PostMapping("/find-duplicates")
  public ResponseEntity<ByteArrayResource> findDuplicates(
      @RequestPart("files") List<MultipartFile> files
  ) throws Exception {
    return PdfResponses.json(ops.findDuplicates(files), "duplicates.json");
  }

  @PostMapping("/search")
  public ResponseEntity<ByteArrayResource> search(
      @RequestPart("file") MultipartFile file,
      @RequestParam("query") String query
  ) throws Exception {
    return PdfResponses.json(ops.search(file, query), "search.json");
  }

  @PostMapping("/batch-remove-metadata")
  public ResponseEntity<ByteArrayResource> batchRemoveMetadata(
      @RequestPart("files") List<MultipartFile> files
  ) throws Exception {
    return PdfResponses.zip(ops.batchRemoveMetadata(files), "batch-cleaned.zip");
  }

  @PostMapping("/rename-passthrough")
  public ResponseEntity<ByteArrayResource> renamePassthrough(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "pattern", defaultValue = "{name}-clean-{date}.pdf") String pattern
  ) throws Exception {
    return PdfResponses.pdf(ops.renamePassthrough(file, pattern), ops.renamePassthroughFilename(file, pattern));
  }

  @PostMapping("/organize-merge")
  public ResponseEntity<ByteArrayResource> organizeMerge(
      @RequestPart("files") List<MultipartFile> files
  ) throws Exception {
    return PdfResponses.pdf(ops.organizeMerge(files), "organized.pdf");
  }

  @PostMapping("/compare-versions")
  public ResponseEntity<ByteArrayResource> compareVersions(
      @RequestPart("files") List<MultipartFile> files
  ) throws Exception {
    return PdfResponses.json(ops.compareVersions(files), "compare-versions.json");
  }

  @PostMapping("/compare-visual")
  public ResponseEntity<ByteArrayResource> compareVisual(
      @RequestPart("files") List<MultipartFile> files
  ) throws Exception {
    return PdfResponses.json(ops.compareVisual(files), "compare-visual.json");
  }

  @PostMapping("/diff-text")
  public ResponseEntity<ByteArrayResource> diffText(
      @RequestPart("files") List<MultipartFile> files
  ) throws Exception {
    return PdfResponses.text(ops.diffText(files), "diff.txt");
  }

  @PostMapping("/keywords")
  public ResponseEntity<ByteArrayResource> keywords(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.json(ops.keywords(file), "keywords.json");
  }

  @PostMapping("/citation")
  public ResponseEntity<ByteArrayResource> citation(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.text(ops.citation(file), "citation.txt");
  }

  @PostMapping("/references")
  public ResponseEntity<ByteArrayResource> references(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.text(ops.references(file), "references.txt");
  }

  @PostMapping("/extract-invoice")
  public ResponseEntity<ByteArrayResource> extractInvoice(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.extractInvoice(file), "invoice.json");
  }

  @PostMapping("/extract-receipt")
  public ResponseEntity<ByteArrayResource> extractReceipt(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.extractReceipt(file), "receipt.json");
  }

  @PostMapping("/parse-resume")
  public ResponseEntity<ByteArrayResource> parseResume(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.parseResume(file), "resume.json");
  }

  @PostMapping("/analyze-contract")
  public ResponseEntity<ByteArrayResource> analyzeContract(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.analyzeContract(file), "contract.json");
  }

  @PostMapping("/classify")
  public ResponseEntity<ByteArrayResource> classify(@RequestPart("file") MultipartFile file) throws Exception {
    return PdfResponses.json(ops.classify(file), "classify.json");
  }

  @PostMapping("/extract-data")
  public ResponseEntity<ByteArrayResource> extractData(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.extractData(file), "data.json");
  }

  @PostMapping("/extract-entities")
  public ResponseEntity<ByteArrayResource> extractEntities(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.extractEntities(file), "entities.json");
  }

  @PostMapping("/summarize")
  public ResponseEntity<ByteArrayResource> summarize(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "sentences", defaultValue = "5") int sentences
  ) throws Exception {
    return PdfResponses.text(ops.summarize(file, sentences), "summary.txt");
  }

  @PostMapping("/generate-questions")
  public ResponseEntity<ByteArrayResource> generateQuestions(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.text(ops.generateQuestions(file), "questions.txt");
  }

  @PostMapping("/generate-quiz")
  public ResponseEntity<ByteArrayResource> generateQuiz(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.generateQuiz(file), "quiz.json");
  }

  @PostMapping("/generate-flashcards")
  public ResponseEntity<ByteArrayResource> generateFlashcards(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.generateFlashcards(file), "flashcards.json");
  }

  @PostMapping("/generate-notes")
  public ResponseEntity<ByteArrayResource> generateNotes(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.markdown(ops.generateNotes(file), "notes.md");
  }

  @PostMapping("/generate-mindmap")
  public ResponseEntity<ByteArrayResource> generateMindmap(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.text(ops.generateMindmap(file), "mindmap.txt");
  }

  @PostMapping("/generate-presentation")
  public ResponseEntity<ByteArrayResource> generatePresentation(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.markdown(ops.generatePresentation(file), "presentation.md");
  }

  @PostMapping("/generate-report")
  public ResponseEntity<ByteArrayResource> generateReport(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.pdf(ops.generateReport(file), "report.pdf");
  }

  @PostMapping("/accessibility-tag")
  public ResponseEntity<ByteArrayResource> accessibilityTag(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "title", required = false) String title,
      @RequestParam(value = "language", defaultValue = "en-US") String language
  ) throws Exception {
    return PdfResponses.pdf(ops.accessibilityTag(file, title, language), "tagged.pdf");
  }

  @PostMapping("/fix-reading-order")
  public ResponseEntity<ByteArrayResource> fixReadingOrder(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.pdf(ops.fixReadingOrder(file), "reading-order.pdf");
  }

  @PostMapping("/alt-text-suggestions")
  public ResponseEntity<ByteArrayResource> altTextSuggestions(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.altTextSuggestions(file), "alt-text.json");
  }

  @PostMapping("/find-redactions")
  public ResponseEntity<ByteArrayResource> findRedactions(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.findRedactions(file), "redactions.json");
  }

  @PostMapping("/redact")
  public ResponseEntity<ByteArrayResource> redact(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "query", required = false) String query,
      @RequestParam(value = "regions", required = false) String regions,
      @RequestParam(value = "dpi", defaultValue = "150") int dpi
  ) throws Exception {
    return PdfResponses.pdf(ops.redact(file, query, regions, dpi), "redacted.pdf");
  }

  @PostMapping("/scan-sensitive")
  public ResponseEntity<ByteArrayResource> scanSensitive(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.scanSensitive(file), "sensitive.json");
  }

  @PostMapping("/detect-pii")
  public ResponseEntity<ByteArrayResource> detectPii(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.json(ops.detectPii(file), "pii.json");
  }

  @PostMapping("/ask")
  public ResponseEntity<ByteArrayResource> ask(
      @RequestPart("file") MultipartFile file,
      @RequestParam("question") String question
  ) throws Exception {
    return PdfResponses.text(ops.ask(file, question), "answer.txt");
  }

  @PostMapping("/multi-search")
  public ResponseEntity<ByteArrayResource> multiSearch(
      @RequestPart("files") List<MultipartFile> files,
      @RequestParam("query") String query
  ) throws Exception {
    return PdfResponses.json(ops.multiSearch(files, query), "multi-search.json");
  }

  @PostMapping("/multi-ask")
  public ResponseEntity<ByteArrayResource> multiAsk(
      @RequestPart("files") List<MultipartFile> files,
      @RequestParam("question") String question
  ) throws Exception {
    return PdfResponses.text(ops.multiAsk(files, question), "multi-answer.txt");
  }

  @PostMapping("/knowledge-base")
  public ResponseEntity<ByteArrayResource> knowledgeBase(
      @RequestPart("files") List<MultipartFile> files
  ) throws Exception {
    return PdfResponses.json(ops.knowledgeBase(files), "knowledge-base.json");
  }

  @PostMapping("/rag")
  public ResponseEntity<ByteArrayResource> rag(
      @RequestPart("file") MultipartFile file,
      @RequestParam("query") String query
  ) throws Exception {
    return PdfResponses.json(ops.rag(file, query), "rag.json");
  }

  @PostMapping("/ocr")
  public ResponseEntity<ByteArrayResource> ocr(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "mode", defaultValue = "searchable") String mode,
      @RequestParam(value = "language", defaultValue = "eng") String language,
      @RequestParam(value = "dpi", defaultValue = "200") int dpi,
      @RequestParam(value = "deskew", defaultValue = "false") boolean deskew
  ) throws Exception {
    byte[] out = ops.ocr(file, mode, language, dpi, deskew);
    if ("text".equalsIgnoreCase(mode) || "txt".equalsIgnoreCase(mode)) {
      return PdfResponses.text(out, "ocr.txt");
    }
    if ("docx".equalsIgnoreCase(mode) || "word".equalsIgnoreCase(mode)) {
      return PdfResponses.docx(out, "ocr.docx");
    }
    return PdfResponses.pdf(out, "searchable.pdf");
  }

  @PostMapping("/deskew")
  public ResponseEntity<ByteArrayResource> deskew(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "dpi", defaultValue = "150") int dpi,
      @RequestParam(value = "maxDegrees", defaultValue = "10") double maxDegrees
  ) throws Exception {
    return PdfResponses.pdf(ops.deskew(file, dpi, maxDegrees), "deskewed.pdf");
  }

  @PostMapping("/images-to-searchable-pdf")
  public ResponseEntity<ByteArrayResource> imagesToSearchablePdf(
      @RequestPart("files") List<MultipartFile> files,
      @RequestParam(value = "language", defaultValue = "eng") String language,
      @RequestParam(value = "dpi", defaultValue = "200") int dpi
  ) throws Exception {
    return PdfResponses.pdf(ops.imagesToSearchablePdf(files, language, dpi), "searchable.pdf");
  }

  @PostMapping("/workflow-clean")
  public ResponseEntity<ByteArrayResource> workflowClean(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.pdf(ops.workflowClean(file), "workflow-clean.pdf");
  }

  @PostMapping("/translation-sheet")
  public ResponseEntity<ByteArrayResource> translationSheet(@RequestPart("file") MultipartFile file)
      throws Exception {
    return PdfResponses.pdf(ops.translationSheet(file), "translation-sheet.pdf");
  }
}
