package com.easytoolhub.pdf.engine.pdfbox;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentCatalog;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDDocumentNameDictionary;
import org.apache.pdfbox.pdmodel.PDEmbeddedFilesNameTreeNode;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageTree;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.common.filespecification.PDComplexFileSpecification;
import org.apache.pdfbox.pdmodel.common.filespecification.PDEmbeddedFile;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionURI;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationWidget;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDCheckBox;
import org.apache.pdfbox.pdmodel.interactive.form.PDField;
import org.apache.pdfbox.pdmodel.interactive.form.PDTextField;
import org.apache.pdfbox.pdmodel.interactive.digitalsignature.PDSignature;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.apache.pdfbox.util.Matrix;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class PdfBoxEngine {

  public PDDocument load(MultipartFile file, String password) throws IOException {
    byte[] bytes = file.getBytes();
    if (password != null && !password.isBlank()) {
      return Loader.loadPDF(bytes, password);
    }
    return Loader.loadPDF(bytes);
  }

  public PDDocument load(byte[] bytes, String password) throws IOException {
    if (password != null && !password.isBlank()) {
      return Loader.loadPDF(bytes, password);
    }
    return Loader.loadPDF(bytes);
  }

  public byte[] save(PDDocument doc) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    doc.save(out);
    return out.toByteArray();
  }

  public byte[] encrypt(
      MultipartFile file,
      String userPassword,
      String ownerPassword,
      boolean allowPrint,
      boolean allowModify
  ) throws IOException {
    try (PDDocument doc = load(file, null)) {
      AccessPermission ap = new AccessPermission();
      ap.setCanPrint(allowPrint);
      ap.setCanModify(allowModify);
      ap.setCanExtractContent(false);
      ap.setCanModifyAnnotations(allowModify);

      String owner = (ownerPassword == null || ownerPassword.isBlank()) ? userPassword : ownerPassword;
      StandardProtectionPolicy spp = new StandardProtectionPolicy(owner, userPassword, ap);
      spp.setEncryptionKeyLength(256);
      spp.setPermissions(ap);
      doc.protect(spp);
      return save(doc);
    }
  }

  public byte[] decrypt(MultipartFile file, String password) throws IOException {
    try (PDDocument doc = load(file, password)) {
      doc.setAllSecurityToBeRemoved(true);
      return save(doc);
    }
  }

  public byte[] merge(List<MultipartFile> files) throws IOException {
    try (PDDocument target = new PDDocument()) {
      for (MultipartFile file : files) {
        try (PDDocument src = load(file, null)) {
          for (PDPage page : src.getPages()) {
            target.importPage(page);
          }
        }
      }
      return save(target);
    }
  }

  public byte[] extractPages(MultipartFile file, List<Integer> oneBasedPages) throws IOException {
    try (PDDocument src = load(file, null); PDDocument target = new PDDocument()) {
      for (Integer pageNo : oneBasedPages) {
        int idx = pageNo - 1;
        if (idx < 0 || idx >= src.getNumberOfPages()) {
          throw new IllegalArgumentException("Page out of range: " + pageNo);
        }
        target.importPage(src.getPage(idx));
      }
      return save(target);
    }
  }

  public byte[] deletePages(MultipartFile file, List<Integer> oneBasedPages) throws IOException {
    try (PDDocument doc = load(file, null)) {
      List<Integer> sorted = oneBasedPages.stream().distinct().sorted((a, b) -> b - a).toList();
      if (sorted.size() >= doc.getNumberOfPages()) {
        throw new IllegalArgumentException("Cannot delete all pages");
      }
      for (Integer pageNo : sorted) {
        int idx = pageNo - 1;
        if (idx < 0 || idx >= doc.getNumberOfPages()) {
          throw new IllegalArgumentException("Page out of range: " + pageNo);
        }
        doc.removePage(idx);
      }
      return save(doc);
    }
  }

  public byte[] rotatePages(MultipartFile file, List<Integer> oneBasedPages, int degrees) throws IOException {
    if (degrees % 90 != 0) {
      throw new IllegalArgumentException("Rotation must be a multiple of 90");
    }
    try (PDDocument doc = load(file, null)) {
      List<Integer> targets = (oneBasedPages == null || oneBasedPages.isEmpty())
          ? range(1, doc.getNumberOfPages())
          : oneBasedPages;
      for (Integer pageNo : targets) {
        int idx = pageNo - 1;
        PDPage page = doc.getPage(idx);
        page.setRotation((page.getRotation() + degrees) % 360);
      }
      return save(doc);
    }
  }

  public byte[] reorderPages(MultipartFile file, List<Integer> oneBasedOrder) throws IOException {
    try (PDDocument src = load(file, null); PDDocument target = new PDDocument()) {
      if (oneBasedOrder.size() != src.getNumberOfPages()) {
        throw new IllegalArgumentException("Order must include every page exactly once");
      }
      for (Integer pageNo : oneBasedOrder) {
        target.importPage(src.getPage(pageNo - 1));
      }
      return save(target);
    }
  }

  public byte[] addWatermark(MultipartFile file, String text, float opacity) throws IOException {
    try (PDDocument doc = load(file, null)) {
      PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
      PDExtendedGraphicsState gs = new PDExtendedGraphicsState();
      gs.setNonStrokingAlphaConstant(Math.max(0.05f, Math.min(opacity, 1f)));

      for (PDPage page : doc.getPages()) {
        PDRectangle box = page.getMediaBox();
        try (PDPageContentStream cs = new PDPageContentStream(
            doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
          cs.setGraphicsStateParameters(gs);
          cs.beginText();
          cs.setFont(font, 48);
          cs.setNonStrokingColor(0.6f, 0.6f, 0.6f);
          cs.setTextMatrix(Matrix.getRotateInstance(Math.toRadians(45), box.getWidth() / 4, box.getHeight() / 4));
          cs.showText(text);
          cs.endText();
        }
      }
      return save(doc);
    }
  }

  public byte[] addPageNumbers(MultipartFile file, int startAt) throws IOException {
    try (PDDocument doc = load(file, null)) {
      PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
      int n = startAt;
      for (PDPage page : doc.getPages()) {
        PDRectangle box = page.getMediaBox();
        try (PDPageContentStream cs = new PDPageContentStream(
            doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
          cs.beginText();
          cs.setFont(font, 10);
          cs.newLineAtOffset(box.getWidth() / 2 - 10, 24);
          cs.showText(String.valueOf(n++));
          cs.endText();
        }
      }
      return save(doc);
    }
  }

  public byte[] setMetadata(
      MultipartFile file,
      String title,
      String author,
      String subject,
      String keywords
  ) throws IOException {
    try (PDDocument doc = load(file, null)) {
      PDDocumentInformation info = doc.getDocumentInformation();
      if (info == null) {
        info = new PDDocumentInformation();
        doc.setDocumentInformation(info);
      }
      if (title != null) info.setTitle(title);
      if (author != null) info.setAuthor(author);
      if (subject != null) info.setSubject(subject);
      if (keywords != null) info.setKeywords(keywords);
      return save(doc);
    }
  }

  public byte[] imagesToPdf(List<MultipartFile> images) throws IOException {
    try (PDDocument doc = new PDDocument()) {
      for (MultipartFile image : images) {
        BufferedImage buffered = ImageIO.read(image.getInputStream());
        if (buffered == null) {
          throw new IllegalArgumentException("Unsupported image: " + image.getOriginalFilename());
        }
        PDPage page = new PDPage(new PDRectangle(buffered.getWidth(), buffered.getHeight()));
        doc.addPage(page);
        String name = image.getOriginalFilename() == null ? "" : image.getOriginalFilename().toLowerCase();
        PDImageXObject xobj = name.endsWith(".jpg") || name.endsWith(".jpeg")
            ? JPEGFactory.createFromImage(doc, buffered)
            : LosslessFactory.createFromImage(doc, buffered);
        try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
          cs.drawImage(xobj, 0, 0, buffered.getWidth(), buffered.getHeight());
        }
      }
      return save(doc);
    }
  }

  public String extractText(MultipartFile file) throws IOException {
    try (PDDocument doc = load(file, null)) {
      return extractText(doc);
    }
  }

  public String extractText(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      return extractText(doc);
    }
  }

  public String extractText(PDDocument doc) throws IOException {
    return new PDFTextStripper().getText(doc);
  }

  public List<String> extractTextPerPage(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      List<String> pages = new ArrayList<>();
      PDFTextStripper stripper = new PDFTextStripper();
      for (int i = 1; i <= doc.getNumberOfPages(); i++) {
        stripper.setStartPage(i);
        stripper.setEndPage(i);
        pages.add(stripper.getText(doc));
      }
      return pages;
    }
  }

  public byte[] renderPagesZip(MultipartFile file, int dpi) throws IOException {
    try (PDDocument doc = load(file, null);
         ByteArrayOutputStream bos = new ByteArrayOutputStream();
         ZipOutputStream zos = new ZipOutputStream(bos)) {
      PDFRenderer renderer = new PDFRenderer(doc);
      for (int i = 0; i < doc.getNumberOfPages(); i++) {
        BufferedImage image = renderer.renderImageWithDPI(i, dpi, ImageType.RGB);
        ZipEntry entry = new ZipEntry(String.format("page-%03d.png", i + 1));
        zos.putNextEntry(entry);
        ImageIO.write(image, "png", zos);
        zos.closeEntry();
      }
      zos.finish();
      return bos.toByteArray();
    }
  }

  public byte[] textToPdf(String text) throws IOException {
    try (PDDocument doc = new PDDocument()) {
      PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
      String[] lines = text.replace("\r\n", "\n").split("\n");
      int lineHeight = 14;
      int margin = 50;
      int yStart = (int) PDRectangle.A4.getHeight() - margin;
      int index = 0;
      while (index < lines.length) {
        PDPage page = new PDPage(PDRectangle.A4);
        doc.addPage(page);
        try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
          cs.beginText();
          cs.setFont(font, 11);
          cs.newLineAtOffset(margin, yStart);
          int y = yStart;
          while (index < lines.length && y > margin) {
            String line = sanitizeWinAnsi(lines[index++]);
            if (line.length() > 100) {
              line = line.substring(0, 100);
            }
            cs.showText(line.isEmpty() ? " " : line);
            cs.newLineAtOffset(0, -lineHeight);
            y -= lineHeight;
          }
          cs.endText();
        }
      }
      if (doc.getNumberOfPages() == 0) {
        doc.addPage(new PDPage(PDRectangle.A4));
      }
      return save(doc);
    }
  }

  public byte[] removeMetadata(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      clearMetadata(doc);
      return save(doc);
    }
  }

  public void clearMetadata(PDDocument doc) {
    PDDocumentInformation blank = new PDDocumentInformation();
    doc.setDocumentInformation(blank);
    doc.getDocumentCatalog().setMetadata(null);
  }

  public byte[] removeAnnotations(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      for (PDPage page : doc.getPages()) {
        page.setAnnotations(List.of());
      }
      return save(doc);
    }
  }

  public byte[] removeHiddenData(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      clearMetadata(doc);
      for (PDPage page : doc.getPages()) {
        page.setAnnotations(List.of());
      }
      PDDocumentCatalog catalog = doc.getDocumentCatalog();
      catalog.setOpenAction(null);
      catalog.setNames(null);
      return save(doc);
    }
  }

  public byte[] duplicatePages(byte[] bytes, List<Integer> oneBasedPages) throws IOException {
    try (PDDocument src = load(bytes, null); PDDocument target = new PDDocument()) {
      PDPageTree pages = src.getPages();
      for (int i = 0; i < pages.getCount(); i++) {
        target.importPage(pages.get(i));
        if (oneBasedPages.contains(i + 1)) {
          target.importPage(pages.get(i));
        }
      }
      return save(target);
    }
  }

  public byte[] replacePages(byte[] sourceBytes, byte[] replacementBytes, List<Integer> oneBasedPages)
      throws IOException {
    try (PDDocument src = load(sourceBytes, null);
         PDDocument replacement = load(replacementBytes, null);
         PDDocument target = new PDDocument()) {
      Set<Integer> replace = new HashSet<>(oneBasedPages);
      int repIdx = 0;
      for (int i = 0; i < src.getNumberOfPages(); i++) {
        if (replace.contains(i + 1)) {
          if (repIdx >= replacement.getNumberOfPages()) {
            throw new IllegalArgumentException("Replacement PDF does not have enough pages");
          }
          target.importPage(replacement.getPage(repIdx++));
        } else {
          target.importPage(src.getPage(i));
        }
      }
      return save(target);
    }
  }

  public byte[] cropPages(byte[] bytes, float left, float right, float top, float bottom)
      throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      for (PDPage page : doc.getPages()) {
        PDRectangle box = page.getMediaBox();
        float x = box.getLowerLeftX() + left;
        float y = box.getLowerLeftY() + bottom;
        float w = box.getWidth() - left - right;
        float h = box.getHeight() - top - bottom;
        if (w <= 1 || h <= 1) {
          throw new IllegalArgumentException("Crop margins remove the entire page");
        }
        PDRectangle cropped = new PDRectangle(x, y, w, h);
        page.setCropBox(cropped);
        page.setMediaBox(cropped);
      }
      return save(doc);
    }
  }

  public byte[] resizePages(byte[] bytes, String sizeName) throws IOException {
    PDRectangle targetBox = paperSize(sizeName);
    try (PDDocument src = load(bytes, null); PDDocument target = new PDDocument()) {
      PDFRenderer renderer = new PDFRenderer(src);
      for (int i = 0; i < src.getNumberOfPages(); i++) {
        BufferedImage image = renderer.renderImageWithDPI(i, 150, ImageType.RGB);
        PDPage page = new PDPage(targetBox);
        target.addPage(page);
        PDImageXObject xobj = LosslessFactory.createFromImage(target, image);
        try (PDPageContentStream cs = new PDPageContentStream(target, page)) {
          cs.drawImage(xobj, 0, 0, targetBox.getWidth(), targetBox.getHeight());
        }
      }
      return save(target);
    }
  }

  public byte[] headerFooter(byte[] bytes, String header, String footer) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
      String headerText = sanitizeWinAnsi(header == null ? "" : header);
      String footerText = sanitizeWinAnsi(footer == null ? "" : footer);
      for (PDPage page : doc.getPages()) {
        PDRectangle box = page.getMediaBox();
        try (PDPageContentStream cs = new PDPageContentStream(
            doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
          if (!headerText.isBlank()) {
            cs.beginText();
            cs.setFont(font, 10);
            cs.newLineAtOffset(36, box.getHeight() - 28);
            cs.showText(headerText);
            cs.endText();
          }
          if (!footerText.isBlank()) {
            cs.beginText();
            cs.setFont(font, 10);
            cs.newLineAtOffset(36, 24);
            cs.showText(footerText);
            cs.endText();
          }
        }
      }
      return save(doc);
    }
  }

  public byte[] addBookmarks(byte[] bytes, List<Map.Entry<String, Integer>> outline) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      PDDocumentOutline bookmarks = new PDDocumentOutline();
      doc.getDocumentCatalog().setDocumentOutline(bookmarks);
      for (Map.Entry<String, Integer> entry : outline) {
        int pageNo = entry.getValue();
        if (pageNo < 1 || pageNo > doc.getNumberOfPages()) {
          throw new IllegalArgumentException("Bookmark page out of range: " + pageNo);
        }
        PDOutlineItem item = new PDOutlineItem();
        item.setTitle(entry.getKey());
        item.setDestination(doc.getPage(pageNo - 1));
        bookmarks.addLast(item);
      }
      return save(doc);
    }
  }

  public byte[] insertTableOfContents(byte[] bytes, List<Map.Entry<String, Integer>> outline)
      throws IOException {
    try (PDDocument src = load(bytes, null); PDDocument target = new PDDocument()) {
      PDPage toc = new PDPage(PDRectangle.A4);
      target.addPage(toc);
      PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
      try (PDPageContentStream cs = new PDPageContentStream(target, toc)) {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 16);
        cs.newLineAtOffset(50, PDRectangle.A4.getHeight() - 60);
        cs.showText("Table of Contents");
        cs.setFont(font, 12);
        cs.newLineAtOffset(0, -28);
        for (Map.Entry<String, Integer> entry : outline) {
          String line = sanitizeWinAnsi(entry.getKey() + " .............. " + entry.getValue());
          if (line.length() > 90) {
            line = line.substring(0, 90);
          }
          cs.showText(line);
          cs.newLineAtOffset(0, -18);
        }
        cs.endText();
      }
      for (PDPage page : src.getPages()) {
        target.importPage(page);
      }
      return save(target);
    }
  }

  public byte[] createFormField(byte[] bytes, String fieldName, String label) throws IOException {
    String fieldsJson = "[{\"name\":\""
        + escapeJson(fieldName == null || fieldName.isBlank() ? "full_name" : fieldName)
        + "\",\"label\":\""
        + escapeJson(label == null ? "Full name" : label)
        + "\",\"type\":\"text\",\"page\":0,\"x\":50,\"y\":722,\"width\":250,\"height\":20}]";
    return createFormFields(bytes, fieldsJson);
  }

  /**
   * fieldsJson: array of {name,label?,type:text|checkbox,page?,x,y,width,height,required?}
   * Coordinates use PDF space (origin bottom-left).
   */
  public byte[] createFormFields(byte[] bytes, String fieldsJson) throws IOException {
    com.fasterxml.jackson.databind.JsonNode root;
    try {
      root = new com.fasterxml.jackson.databind.ObjectMapper().readTree(
          fieldsJson == null || fieldsJson.isBlank() ? "[]" : fieldsJson);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid fields JSON");
    }
    if (!root.isArray() || root.isEmpty()) {
      throw new IllegalArgumentException("Provide at least one form field");
    }
    if (root.size() > 40) {
      throw new IllegalArgumentException("Too many form fields (max 40)");
    }
    try (PDDocument doc = load(bytes, null)) {
      if (doc.getNumberOfPages() == 0) {
        throw new IllegalArgumentException("PDF has no pages");
      }
      PDAcroForm form = doc.getDocumentCatalog().getAcroForm();
      if (form == null) {
        form = new PDAcroForm(doc);
        doc.getDocumentCatalog().setAcroForm(form);
      }
      form.setNeedAppearances(true);
      for (com.fasterxml.jackson.databind.JsonNode node : root) {
        String name = node.path("name").asText("").trim();
        if (name.isBlank()) {
          throw new IllegalArgumentException("Each field needs a name");
        }
        int pageIndex = node.path("page").asInt(node.path("pageIndex").asInt(0));
        if (pageIndex < 0 || pageIndex >= doc.getNumberOfPages()) {
          throw new IllegalArgumentException("Field page out of range: " + (pageIndex + 1));
        }
        PDPage page = doc.getPage(pageIndex);
        float x = (float) node.path("x").asDouble(50);
        float y = (float) node.path("y").asDouble(700);
        float width = (float) node.path("width").asDouble(200);
        float height = (float) node.path("height").asDouble(20);
        String type = node.path("type").asText("text").toLowerCase(Locale.ROOT);
        String label = node.path("label").asText(name);

        boolean required = node.path("required").asBoolean(false);
        if ("checkbox".equals(type) || "check".equals(type)) {
          PDCheckBox box = new PDCheckBox(form);
          box.setPartialName(name);
          box.setRequired(required);
          form.getFields().add(box);
          PDAnnotationWidget widget = box.getWidgets().get(0);
          widget.setRectangle(new PDRectangle(x, y, Math.max(12, width), Math.max(12, height)));
          widget.setPage(page);
          page.getAnnotations().add(widget);
        } else {
          PDTextField field = new PDTextField(form);
          field.setPartialName(name);
          field.setRequired(required);
          form.getFields().add(field);
          PDAnnotationWidget widget = field.getWidgets().get(0);
          widget.setRectangle(new PDRectangle(x, y, Math.max(20, width), Math.max(12, height)));
          widget.setPage(page);
          page.getAnnotations().add(widget);
        }

        String caption = sanitizeWinAnsi(label);
        if (caption != null && !caption.isBlank()) {
          try (PDPageContentStream cs = new PDPageContentStream(
              doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
            cs.beginText();
            cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 10);
            cs.newLineAtOffset(x, y + height + 4);
            cs.showText(caption.length() > 80 ? caption.substring(0, 80) : caption);
            cs.endText();
          }
        }
      }
      return save(doc);
    }
  }

  public Map<String, Object> exportFormFields(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      PDAcroForm form = doc.getDocumentCatalog().getAcroForm();
      List<Map<String, Object>> fields = new ArrayList<>();
      if (form != null) {
        for (PDField field : form.getFields()) {
          Map<String, Object> item = new LinkedHashMap<>();
          item.put("name", field.getFullyQualifiedName());
          item.put("type", field.getFieldType());
          item.put("value", field.getValueAsString());
          item.put("readOnly", field.isReadOnly());
          item.put("required", field.isRequired());
          fields.add(item);
        }
      }
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("fieldCount", fields.size());
      result.put("fields", fields);
      return result;
    }
  }

  /** Validate required AcroForm fields; report missing/blank required values. */
  public Map<String, Object> validateFormRequired(byte[] bytes) throws IOException {
    Map<String, Object> exported = exportFormFields(bytes);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> fields = (List<Map<String, Object>>) exported.get("fields");
    List<Map<String, Object>> missing = new ArrayList<>();
    List<Map<String, Object>> required = new ArrayList<>();
    if (fields != null) {
      for (Map<String, Object> field : fields) {
        boolean isRequired = Boolean.TRUE.equals(field.get("required"));
        if (!isRequired) {
          continue;
        }
        required.add(field);
        String value = field.get("value") == null ? "" : String.valueOf(field.get("value")).trim();
        if (value.isEmpty() || "Off".equalsIgnoreCase(value)) {
          Map<String, Object> miss = new LinkedHashMap<>();
          miss.put("name", field.get("name"));
          miss.put("type", field.get("type"));
          miss.put("value", field.get("value"));
          missing.add(miss);
        }
      }
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("valid", missing.isEmpty());
    result.put("requiredCount", required.size());
    result.put("missingCount", missing.size());
    result.put("missing", missing);
    result.put("required", required);
    result.put("fieldCount", fields == null ? 0 : fields.size());
    return result;
  }

  public byte[] exportXfdf(byte[] bytes) throws IOException {
    Map<String, Object> exported = exportFormFields(bytes);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> fields = (List<Map<String, Object>>) exported.get("fields");
    StringBuilder sb = new StringBuilder();
    sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    sb.append("<xfdf xmlns=\"http://ns.adobe.com/xfdf/\" xml:space=\"preserve\">\n");
    sb.append("  <fields>\n");
    if (fields != null) {
      for (Map<String, Object> field : fields) {
        String name = String.valueOf(field.getOrDefault("name", ""));
        String value = String.valueOf(field.getOrDefault("value", ""));
        sb.append("    <field name=\"").append(xmlEscape(name)).append("\">\n");
        sb.append("      <value>").append(xmlEscape(value)).append("</value>\n");
        sb.append("    </field>\n");
      }
    }
    sb.append("  </fields>\n</xfdf>\n");
    return sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
  }

  public byte[] importXfdf(byte[] bytes, String xfdfOrJson) throws IOException {
    Map<String, String> values = parseFormValues(xfdfOrJson);
    return fillFormFields(bytes, values);
  }

  public static Map<String, String> parseFormValues(String xfdfOrJson) {
    if (xfdfOrJson == null || xfdfOrJson.isBlank()) {
      throw new IllegalArgumentException("XFDF or JSON field values are required");
    }
    String raw = xfdfOrJson.trim();
    Map<String, String> values = new LinkedHashMap<>();
    if (raw.startsWith("{") || raw.startsWith("[")) {
      try {
        var root = new com.fasterxml.jackson.databind.ObjectMapper().readTree(raw);
        if (root.isObject()) {
          var fields = root.path("fields");
          if (fields.isArray()) {
            for (var n : fields) {
              String name = n.path("name").asText("");
              if (!name.isBlank()) {
                values.put(name, n.path("value").asText(""));
              }
            }
          } else {
            root.fields().forEachRemaining(e -> {
              if (!"fields".equals(e.getKey())) {
                values.put(e.getKey(), e.getValue().asText(""));
              }
            });
          }
        } else if (root.isArray()) {
          for (var n : root) {
            String name = n.path("name").asText("");
            if (!name.isBlank()) {
              values.put(name, n.path("value").asText(""));
            }
          }
        }
      } catch (Exception e) {
        throw new IllegalArgumentException("Invalid form JSON");
      }
    } else {
      // Minimal XFDF: <field name="x"><value>y</value></field>
      java.util.regex.Matcher m = java.util.regex.Pattern
          .compile("<field\\s+name=\"([^\"]+)\"[^>]*>\\s*<value>(.*?)</value>", java.util.regex.Pattern.DOTALL)
          .matcher(raw);
      while (m.find()) {
        values.put(xmlUnescape(m.group(1)), xmlUnescape(m.group(2).trim()));
      }
    }
    if (values.isEmpty()) {
      throw new IllegalArgumentException("No form field values found");
    }
    return values;
  }

  public int pageCount(byte[] bytes, String password) throws IOException {
    try (PDDocument doc = load(bytes, password)) {
      return doc.getNumberOfPages();
    }
  }

  public byte[] renderPagePng(byte[] bytes, String password, int pageIndex, int dpi) throws IOException {
    try (PDDocument doc = load(bytes, password); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      if (pageIndex < 0 || pageIndex >= doc.getNumberOfPages()) {
        throw new IllegalArgumentException("Page out of range");
      }
      int safeDpi = Math.max(36, Math.min(200, dpi <= 0 ? 120 : dpi));
      PDFRenderer renderer = new PDFRenderer(doc);
      BufferedImage image = renderer.renderImageWithDPI(pageIndex, safeDpi, ImageType.RGB);
      ImageIO.write(image, "png", bos);
      return bos.toByteArray();
    }
  }

  private static String escapeJson(String s) {
    if (s == null) return "";
    return s.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private static String xmlEscape(String s) {
    if (s == null) return "";
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
  }

  private static String xmlUnescape(String s) {
    if (s == null) return "";
    return s.replace("&quot;", "\"").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&");
  }

  public byte[] stampSignature(byte[] bytes, String signerName) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      if (doc.getNumberOfPages() == 0) {
        throw new IllegalArgumentException("PDF has no pages");
      }
      PDPage page = doc.getPage(doc.getNumberOfPages() - 1);
      PDRectangle box = page.getMediaBox();
      String text = sanitizeWinAnsi("Signed by: " + (signerName == null ? "Signed" : signerName));
      try (PDPageContentStream cs = new PDPageContentStream(
          doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
        cs.setNonStrokingColor(Color.DARK_GRAY);
        cs.addRect(box.getWidth() - 220, 36, 180, 40);
        cs.stroke();
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE), 10);
        cs.newLineAtOffset(box.getWidth() - 210, 52);
        cs.showText(text.length() > 40 ? text.substring(0, 40) : text);
        cs.endText();
      }
      return save(doc);
    }
  }

  public Map<String, Object> verifySignatures(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      List<Map<String, Object>> signatures = new ArrayList<>();
      for (PDSignature sig : doc.getSignatureDictionaries()) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("name", sig.getName());
        item.put("reason", sig.getReason());
        item.put("location", sig.getLocation());
        item.put("signDate", sig.getSignDate() == null ? null : sig.getSignDate().getTime().toString());
        item.put("filter", sig.getFilter());
        item.put("subFilter", sig.getSubFilter());
        signatures.add(item);
      }
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("signed", !signatures.isEmpty());
      result.put("count", signatures.size());
      result.put("signatures", signatures);
      result.put("note", "Presence of signature dictionaries only; cryptographic validation not performed.");
      return result;
    }
  }

  public List<Map<String, Object>> inspectFonts(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      Map<String, Map<String, Object>> fonts = new LinkedHashMap<>();
      for (int i = 0; i < doc.getNumberOfPages(); i++) {
        collectFonts(doc.getPage(i).getResources(), i + 1, fonts, new HashSet<>());
      }
      return new ArrayList<>(fonts.values());
    }
  }

  public byte[] extractImagesZip(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null);
         ByteArrayOutputStream bos = new ByteArrayOutputStream();
         ZipOutputStream zos = new ZipOutputStream(bos)) {
      int imageIndex = 1;
      for (int i = 0; i < doc.getNumberOfPages(); i++) {
        imageIndex = writeImages(doc.getPage(i).getResources(), zos, i + 1, imageIndex, new HashSet<>());
      }
      if (imageIndex == 1) {
        ZipEntry empty = new ZipEntry("README.txt");
        zos.putNextEntry(empty);
        zos.write("No embedded images found.".getBytes());
        zos.closeEntry();
      }
      zos.finish();
      return bos.toByteArray();
    }
  }

  public List<Map<String, Object>> extractLinks(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      List<Map<String, Object>> links = new ArrayList<>();
      for (int i = 0; i < doc.getNumberOfPages(); i++) {
        for (PDAnnotation ann : doc.getPage(i).getAnnotations()) {
          if (ann instanceof PDAnnotationLink link && link.getAction() instanceof PDActionURI uri) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("page", i + 1);
            item.put("uri", uri.getURI());
            links.add(item);
          }
        }
      }
      return links;
    }
  }

  public byte[] extractAttachmentsZip(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null);
         ByteArrayOutputStream bos = new ByteArrayOutputStream();
         ZipOutputStream zos = new ZipOutputStream(bos)) {
      PDDocumentNameDictionary names = doc.getDocumentCatalog().getNames();
      int count = 0;
      if (names != null && names.getEmbeddedFiles() != null) {
        PDEmbeddedFilesNameTreeNode efTree = names.getEmbeddedFiles();
        Map<String, PDComplexFileSpecification> files = efTree.getNames();
        if (files != null) {
          for (Map.Entry<String, PDComplexFileSpecification> entry : files.entrySet()) {
            PDEmbeddedFile embedded = entry.getValue().getEmbeddedFile();
            if (embedded == null) {
              continue;
            }
            String name = entry.getKey() == null ? "attachment-" + (count + 1) : entry.getKey();
            zos.putNextEntry(new ZipEntry(name));
            zos.write(embedded.toByteArray());
            zos.closeEntry();
            count++;
          }
        }
      }
      if (count == 0) {
        zos.putNextEntry(new ZipEntry("README.txt"));
        zos.write("No embedded attachments found.".getBytes());
        zos.closeEntry();
      }
      zos.finish();
      return bos.toByteArray();
    }
  }

  public byte[] renderAsImagesPdf(byte[] bytes, int dpi, ImageType imageType) throws IOException {
    try (PDDocument src = load(bytes, null); PDDocument target = new PDDocument()) {
      PDFRenderer renderer = new PDFRenderer(src);
      for (int i = 0; i < src.getNumberOfPages(); i++) {
        BufferedImage image = renderer.renderImageWithDPI(i, dpi, imageType);
        PDPage page = new PDPage(new PDRectangle(image.getWidth(), image.getHeight()));
        target.addPage(page);
        PDImageXObject xobj = LosslessFactory.createFromImage(target, image);
        try (PDPageContentStream cs = new PDPageContentStream(target, page)) {
          cs.drawImage(xobj, 0, 0, image.getWidth(), image.getHeight());
        }
      }
      return save(target);
    }
  }

  public byte[] repair(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null); PDDocument target = new PDDocument()) {
      for (PDPage page : doc.getPages()) {
        target.importPage(page);
      }
      PDDocumentInformation info = doc.getDocumentInformation();
      if (info != null) {
        target.setDocumentInformation(info);
      }
      return save(target);
    }
  }

  public Map<String, Object> validate(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("valid", true);
      result.put("pages", doc.getNumberOfPages());
      result.put("encrypted", doc.isEncrypted());
      result.put("version", doc.getVersion());
      PDDocumentInformation info = doc.getDocumentInformation();
      result.put("title", info == null ? null : info.getTitle());
      result.put("author", info == null ? null : info.getAuthor());
      return result;
    }
  }

  public Map<String, Object> accessibilityCheck(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      PDDocumentCatalog catalog = doc.getDocumentCatalog();
      PDDocumentInformation info = doc.getDocumentInformation();
      List<String> issues = new ArrayList<>();
      boolean hasTitle = info != null && info.getTitle() != null && !info.getTitle().isBlank();
      boolean hasLang = catalog.getLanguage() != null && !catalog.getLanguage().isBlank();
      boolean tagged = catalog.getStructureTreeRoot() != null;
      if (!hasTitle) issues.add("Missing document title");
      if (!hasLang) issues.add("Missing document language");
      if (!tagged) issues.add("Document is not tagged");
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("hasTitle", hasTitle);
      result.put("hasLanguage", hasLang);
      result.put("tagged", tagged);
      result.put("pages", doc.getNumberOfPages());
      result.put("issues", issues);
      result.put("score", Math.max(0, 100 - issues.size() * 25));
      return result;
    }
  }

  public byte[] accessibilityTag(byte[] bytes, String title, String language) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      PDDocumentInformation info = doc.getDocumentInformation();
      if (info == null) {
        info = new PDDocumentInformation();
        doc.setDocumentInformation(info);
      }
      if (title != null && !title.isBlank()) {
        info.setTitle(title);
      } else if (info.getTitle() == null || info.getTitle().isBlank()) {
        info.setTitle("Untitled document");
      }
      if (language != null && !language.isBlank()) {
        doc.getDocumentCatalog().setLanguage(language);
      }
      return save(doc);
    }
  }

  public byte[] fixReadingOrder(byte[] bytes) throws IOException {
    try (PDDocument src = load(bytes, null); PDDocument target = new PDDocument()) {
      for (PDPage page : src.getPages()) {
        target.importPage(page);
      }
      return save(target);
    }
  }

  public List<Map<String, Object>> altTextSuggestions(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      List<Map<String, Object>> suggestions = new ArrayList<>();
      for (int i = 0; i < doc.getNumberOfPages(); i++) {
        int images = countImages(doc.getPage(i).getResources(), new HashSet<>());
        if (images > 0) {
          Map<String, Object> item = new LinkedHashMap<>();
          item.put("page", i + 1);
          item.put("imageCount", images);
          item.put("suggestedAltText", "Image on page " + (i + 1) + " — describe the visual content.");
          suggestions.add(item);
        }
      }
      return suggestions;
    }
  }

  /**
   * OSS image redaction: rasterize each page, paint opaque black boxes, emit image-only PDF.
   * Underlying text/vectors are destroyed (honest "image redaction").
   * Regions JSON: [{pageIndex,x,y,width,height}] in PDF bottom-left space (same as annotate).
   * Optional {@code query} also redacts all case-insensitive text matches.
   */
  public byte[] redactAsImages(byte[] bytes, String regionsJson, String query, int dpi)
      throws IOException {
    int safeDpi = dpi <= 0 ? 150 : Math.min(300, dpi);
    List<RedactBox> boxes = parseRedactRegions(regionsJson);
    if (query != null && !query.isBlank()) {
      boxes.addAll(findTextRedactBoxes(bytes, query.trim()));
    }
    if (boxes.isEmpty()) {
      throw new IllegalArgumentException("Provide a text query and/or regions JSON to redact");
    }

    try (PDDocument src = load(bytes, null); PDDocument target = new PDDocument()) {
      PDFRenderer renderer = new PDFRenderer(src);
      Map<Integer, List<RedactBox>> byPage = new LinkedHashMap<>();
      for (RedactBox box : boxes) {
        byPage.computeIfAbsent(box.pageIndex, k -> new ArrayList<>()).add(box);
      }

      for (int i = 0; i < src.getNumberOfPages(); i++) {
        PDPage srcPage = src.getPage(i);
        PDRectangle media = srcPage.getMediaBox();
        BufferedImage image = renderer.renderImageWithDPI(i, safeDpi, ImageType.RGB);
        List<RedactBox> pageBoxes = byPage.getOrDefault(i, List.of());
        if (!pageBoxes.isEmpty()) {
          Graphics2D g = image.createGraphics();
          try {
            g.setColor(Color.BLACK);
            float scaleX = image.getWidth() / media.getWidth();
            float scaleY = image.getHeight() / media.getHeight();
            for (RedactBox box : pageBoxes) {
              int x = Math.round(box.x * scaleX);
              int h = Math.max(1, Math.round(box.height * scaleY));
              int w = Math.max(1, Math.round(box.width * scaleX));
              // PDF origin bottom-left → image origin top-left
              int y = Math.round(image.getHeight() - (box.y + box.height) * scaleY);
              // pad slightly so glyphs aren't clipped
              int pad = Math.max(1, Math.round(safeDpi / 72f));
              g.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
            }
          } finally {
            g.dispose();
          }
        }

        PDPage page = new PDPage(new PDRectangle(media.getWidth(), media.getHeight()));
        target.addPage(page);
        PDImageXObject xobj = JPEGFactory.createFromImage(target, image, 0.85f);
        try (PDPageContentStream cs = new PDPageContentStream(target, page)) {
          cs.drawImage(xobj, 0, 0, media.getWidth(), media.getHeight());
        }
      }

      // Strip leftover metadata from the redacted output.
      target.setDocumentInformation(new PDDocumentInformation());
      target.getDocumentCatalog().setMetadata(null);
      return save(target);
    }
  }

  private static List<RedactBox> parseRedactRegions(String regionsJson) throws IOException {
    List<RedactBox> boxes = new ArrayList<>();
    if (regionsJson == null || regionsJson.isBlank()) {
      return boxes;
    }
    com.fasterxml.jackson.databind.JsonNode root;
    try {
      root = new com.fasterxml.jackson.databind.ObjectMapper().readTree(regionsJson);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid regions JSON");
    }
    if (!root.isArray()) {
      throw new IllegalArgumentException("regions must be a JSON array");
    }
    for (com.fasterxml.jackson.databind.JsonNode node : root) {
      int pageIndex = node.path("pageIndex").asInt(node.path("page").asInt(1) - 1);
      float x = (float) node.path("x").asDouble(0);
      float y = (float) node.path("y").asDouble(0);
      float width = (float) node.path("width").asDouble(0);
      float height = (float) node.path("height").asDouble(0);
      if (width <= 0 || height <= 0) {
        continue;
      }
      if (pageIndex < 0) {
        throw new IllegalArgumentException("Region page out of range");
      }
      boxes.add(new RedactBox(pageIndex, x, y, width, height));
    }
    return boxes;
  }

  private List<RedactBox> findTextRedactBoxes(byte[] bytes, String query) throws IOException {
    String needle = query.toLowerCase(java.util.Locale.ROOT);
    List<RedactBox> boxes = new ArrayList<>();
    try (PDDocument doc = load(bytes, null)) {
      for (int pageIndex = 0; pageIndex < doc.getNumberOfPages(); pageIndex++) {
        final int page = pageIndex;
        List<TextPosition> positions = new ArrayList<>();
        StringBuilder raw = new StringBuilder();
        PDFTextStripper stripper = new PDFTextStripper() {
          @Override
          protected void writeString(String text, List<TextPosition> textPositions) {
            for (TextPosition tp : textPositions) {
              positions.add(tp);
              raw.append(tp.getUnicode() == null ? "" : tp.getUnicode());
            }
          }
        };
        stripper.setStartPage(page + 1);
        stripper.setEndPage(page + 1);
        stripper.getText(doc);

        String hay = raw.toString().toLowerCase(java.util.Locale.ROOT);
        int from = 0;
        while (from < hay.length()) {
          int at = hay.indexOf(needle, from);
          if (at < 0) {
            break;
          }
          int end = at + needle.length();
          if (at < positions.size() && end <= positions.size()) {
            float minX = Float.MAX_VALUE;
            float minY = Float.MAX_VALUE;
            float maxX = Float.MIN_VALUE;
            float maxY = Float.MIN_VALUE;
            for (int i = at; i < end; i++) {
              TextPosition tp = positions.get(i);
              float x = tp.getXDirAdj();
              float y = tp.getYDirAdj() - tp.getHeightDir();
              float w = tp.getWidthDirAdj();
              float h = tp.getHeightDir();
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x + w);
              maxY = Math.max(maxY, y + h);
            }
            if (minX < maxX && minY < maxY) {
              boxes.add(new RedactBox(page, minX, minY, maxX - minX, maxY - minY));
            }
          }
          from = at + Math.max(1, needle.length());
        }
      }
    }
    if (boxes.isEmpty()) {
      throw new IllegalArgumentException("No matches found for query: " + query);
    }
    return boxes;
  }

  private record RedactBox(int pageIndex, float x, float y, float width, float height) {}

  public Map<String, Object> findRedactedRegions(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      List<Map<String, Object>> hits = new ArrayList<>();
      PDFRenderer renderer = new PDFRenderer(doc);
      for (int i = 0; i < Math.min(doc.getNumberOfPages(), 20); i++) {
        BufferedImage image = renderer.renderImageWithDPI(i, 72, ImageType.RGB);
        int darkBlocks = countDarkBlocks(image);
        if (darkBlocks > 0) {
          Map<String, Object> item = new LinkedHashMap<>();
          item.put("page", i + 1);
          item.put("likelyRedactionBlocks", darkBlocks);
          hits.add(item);
        }
      }
      Map<String, Object> result = new LinkedHashMap<>();
      result.put("pagesChecked", Math.min(doc.getNumberOfPages(), 20));
      result.put("findings", hits);
      return result;
    }
  }

  public float compareVisualFirstPage(byte[] a, byte[] b) throws IOException {
    try (PDDocument docA = load(a, null); PDDocument docB = load(b, null)) {
      if (docA.getNumberOfPages() == 0 || docB.getNumberOfPages() == 0) {
        return 0f;
      }
      PDFRenderer ra = new PDFRenderer(docA);
      PDFRenderer rb = new PDFRenderer(docB);
      BufferedImage ia = ra.renderImageWithDPI(0, 72, ImageType.RGB);
      BufferedImage ib = rb.renderImageWithDPI(0, 72, ImageType.RGB);
      int w = Math.min(ia.getWidth(), ib.getWidth());
      int h = Math.min(ia.getHeight(), ib.getHeight());
      long diff = 0;
      long total = (long) w * h * 3;
      for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
          int ca = ia.getRGB(x, y);
          int cb = ib.getRGB(x, y);
          diff += Math.abs(((ca >> 16) & 0xff) - ((cb >> 16) & 0xff));
          diff += Math.abs(((ca >> 8) & 0xff) - ((cb >> 8) & 0xff));
          diff += Math.abs((ca & 0xff) - (cb & 0xff));
        }
      }
      return 1f - (float) diff / (float) (total * 255);
    }
  }

  public static PDRectangle paperSize(String sizeName) {
    String size = sizeName == null ? "A4" : sizeName.trim().toUpperCase();
    return switch (size) {
      case "LETTER" -> PDRectangle.LETTER;
      case "LEGAL" -> PDRectangle.LEGAL;
      case "A3" -> PDRectangle.A3;
      default -> PDRectangle.A4;
    };
  }

  public static String sanitizeWinAnsi(String text) {
    if (text == null) {
      return "";
    }
    StringBuilder sb = new StringBuilder(text.length());
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      if (c == '\t') {
        sb.append(' ');
      } else if (c >= 32 && c <= 126) {
        sb.append(c);
      } else if (c == '\n' || c == '\r') {
        sb.append(' ');
      } else {
        sb.append('?');
      }
    }
    return sb.toString();
  }

  private void collectFonts(
      PDResources resources,
      int page,
      Map<String, Map<String, Object>> fonts,
      Set<PDResources> seen
  ) throws IOException {
    if (resources == null || !seen.add(resources)) {
      return;
    }
    for (COSName name : resources.getFontNames()) {
      PDFont font = resources.getFont(name);
      if (font == null) {
        continue;
      }
      String key = font.getName() == null ? name.getName() : font.getName();
      Map<String, Object> info = fonts.computeIfAbsent(key, k -> {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", k);
        m.put("type", font.getSubType());
        m.put("embedded", font.isEmbedded());
        m.put("pages", new ArrayList<Integer>());
        return m;
      });
      @SuppressWarnings("unchecked")
      List<Integer> pages = (List<Integer>) info.get("pages");
      if (!pages.contains(page)) {
        pages.add(page);
      }
    }
    for (COSName name : resources.getXObjectNames()) {
      PDXObject xObject = resources.getXObject(name);
      if (xObject instanceof PDFormXObject form) {
        collectFonts(form.getResources(), page, fonts, seen);
      }
    }
  }

  private int writeImages(
      PDResources resources,
      ZipOutputStream zos,
      int page,
      int imageIndex,
      Set<PDResources> seen
  ) throws IOException {
    if (resources == null || !seen.add(resources)) {
      return imageIndex;
    }
    for (COSName name : resources.getXObjectNames()) {
      PDXObject xObject = resources.getXObject(name);
      if (xObject instanceof PDImageXObject image) {
        BufferedImage buffered = image.getImage();
        ZipEntry entry = new ZipEntry(String.format("page-%03d-image-%03d.png", page, imageIndex++));
        zos.putNextEntry(entry);
        ImageIO.write(buffered, "png", zos);
        zos.closeEntry();
      } else if (xObject instanceof PDFormXObject form) {
        imageIndex = writeImages(form.getResources(), zos, page, imageIndex, seen);
      }
    }
    return imageIndex;
  }

  private int countImages(PDResources resources, Set<PDResources> seen) throws IOException {
    if (resources == null || !seen.add(resources)) {
      return 0;
    }
    int count = 0;
    for (COSName name : resources.getXObjectNames()) {
      PDXObject xObject = resources.getXObject(name);
      if (xObject instanceof PDImageXObject) {
        count++;
      } else if (xObject instanceof PDFormXObject form) {
        count += countImages(form.getResources(), seen);
      }
    }
    return count;
  }

  private static int countDarkBlocks(BufferedImage image) {
    int block = 16;
    int hits = 0;
    for (int y = 0; y + block < image.getHeight(); y += block) {
      for (int x = 0; x + block < image.getWidth(); x += block) {
        long sum = 0;
        int n = 0;
        for (int yy = y; yy < y + block; yy++) {
          for (int xx = x; xx < x + block; xx++) {
            int rgb = image.getRGB(xx, yy);
            int r = (rgb >> 16) & 0xff;
            int g = (rgb >> 8) & 0xff;
            int b = rgb & 0xff;
            sum += (r + g + b) / 3;
            n++;
          }
        }
        if (n > 0 && (sum / n) < 25) {
          hits++;
        }
      }
    }
    return hits;
  }

  private static List<Integer> range(int from, int toInclusive) {
    List<Integer> list = new ArrayList<>();
    for (int i = from; i <= toInclusive; i++) {
      list.add(i);
    }
    return list;
  }

  public byte[] fillFormFields(byte[] bytes, Map<String, String> values) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      PDAcroForm form = doc.getDocumentCatalog().getAcroForm();
      if (form == null) {
        throw new IllegalArgumentException("This PDF has no fillable form fields");
      }
      form.setNeedAppearances(true);
      if (values != null) {
        for (Map.Entry<String, String> entry : values.entrySet()) {
          if (entry.getKey() == null || entry.getKey().isBlank()) continue;
          var field = form.getField(entry.getKey());
          if (field != null) {
            field.setValue(entry.getValue() == null ? "" : entry.getValue());
          }
        }
      }
      return save(doc);
    }
  }

  public byte[] flattenForm(byte[] bytes) throws IOException {
    try (PDDocument doc = load(bytes, null)) {
      PDAcroForm form = doc.getDocumentCatalog().getAcroForm();
      if (form == null) {
        throw new IllegalArgumentException("This PDF has no fillable form fields to flatten");
      }
      form.setNeedAppearances(true);
      try {
        form.refreshAppearances();
      } catch (Exception ignored) {
        /* some forms lack fonts/resources; flatten still attempts */
      }
      form.flatten();
      return save(doc);
    }
  }

  /**
   * annotationsJson: array of {type,pageIndex,x,y,width,height,text,fontSize,r,g,b,opacity}
   * Coordinates use PDF space with origin bottom-left (same as pdf-lib draw).
   */
  public byte[] applyAnnotations(byte[] bytes, String annotationsJson) throws IOException {
    com.fasterxml.jackson.databind.JsonNode root;
    try {
      root = new com.fasterxml.jackson.databind.ObjectMapper().readTree(
          annotationsJson == null ? "[]" : annotationsJson);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid annotations JSON");
    }
    if (!root.isArray() || root.isEmpty()) {
      throw new IllegalArgumentException("Provide at least one annotation");
    }
    try (PDDocument doc = load(bytes, null)) {
      for (com.fasterxml.jackson.databind.JsonNode node : root) {
        int pageIndex = node.path("pageIndex").asInt(0);
        if (pageIndex < 0 || pageIndex >= doc.getNumberOfPages()) {
          throw new IllegalArgumentException("Annotation page out of range: " + (pageIndex + 1));
        }
        PDPage page = doc.getPage(pageIndex);
        String type = node.path("type").asText("text");
        float x = (float) node.path("x").asDouble(0);
        float y = (float) node.path("y").asDouble(0);
        float width = (float) node.path("width").asDouble(120);
        float height = (float) node.path("height").asDouble(24);
        float r = (float) node.path("r").asDouble(node.path("color").path("r").asDouble(1));
        float g = (float) node.path("g").asDouble(node.path("color").path("g").asDouble(1));
        float b = (float) node.path("b").asDouble(node.path("color").path("b").asDouble(0));
        float opacity = (float) node.path("opacity").asDouble(0.35);
        try (PDPageContentStream cs = new PDPageContentStream(
            doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
          cs.setNonStrokingColor(new Color(
              Math.max(0f, Math.min(1f, r)),
              Math.max(0f, Math.min(1f, g)),
              Math.max(0f, Math.min(1f, b))));
          if ("highlight".equalsIgnoreCase(type) || "rectangle".equalsIgnoreCase(type)) {
            PDExtendedGraphicsState gs = new PDExtendedGraphicsState();
            gs.setNonStrokingAlphaConstant(Math.max(0.1f, Math.min(1f, opacity)));
            cs.setGraphicsStateParameters(gs);
            cs.addRect(x, y, width, height);
            cs.fill();
          } else if ("line".equalsIgnoreCase(type)) {
            float x2 = (float) node.path("x2").asDouble(x + width);
            float y2 = (float) node.path("y2").asDouble(y);
            cs.setStrokingColor(new Color(
                Math.max(0f, Math.min(1f, r)),
                Math.max(0f, Math.min(1f, g)),
                Math.max(0f, Math.min(1f, b))));
            cs.moveTo(x, y);
            cs.lineTo(x2, y2);
            cs.stroke();
          } else {
            String text = sanitizeWinAnsi(node.path("text").asText("Note"));
            float fontSize = (float) node.path("fontSize").asDouble(12);
            cs.beginText();
            cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), fontSize);
            cs.newLineAtOffset(x, y);
            cs.showText(text == null ? "Note" : text);
            cs.endText();
          }
        }
      }
      return save(doc);
    }
  }

  public byte[] stampImage(
      byte[] pdfBytes,
      byte[] imageBytes,
      int pageOneBased,
      float x,
      float y,
      float width,
      float height
  ) throws IOException {
    try (PDDocument doc = load(pdfBytes, null)) {
      if (pageOneBased < 1 || pageOneBased > doc.getNumberOfPages()) {
        throw new IllegalArgumentException("Invalid page number");
      }
      PDPage page = doc.getPage(pageOneBased - 1);
      org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject image;
      try {
        image = org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject.createFromByteArray(doc, imageBytes, "sig");
      } catch (IOException ex) {
        throw new IllegalArgumentException("Signature image must be PNG or JPEG");
      }
      try (PDPageContentStream cs = new PDPageContentStream(
          doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
        cs.drawImage(image, x, y, width, height);
      }
      return save(doc);
    }
  }

  /** ranges: semicolon-separated page specs (e.g. "1-3;4;5-7"). Returns ZIP of PDFs. */
  public byte[] splitToZip(byte[] bytes, List<String> rangeSpecs, String prefix) throws IOException {
    if (rangeSpecs == null || rangeSpecs.isEmpty()) {
      throw new IllegalArgumentException("Provide at least one page range");
    }
    String safePrefix = (prefix == null || prefix.isBlank()) ? "split" : prefix.replaceAll("[^a-zA-Z0-9_-]", "_");
    try (PDDocument source = load(bytes, null);
         java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
         java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(bos)) {
      int part = 1;
      for (String spec : rangeSpecs) {
        List<Integer> pages = parsePageSpec(spec, source.getNumberOfPages());
        if (pages.isEmpty()) continue;
        try (PDDocument out = new PDDocument()) {
          for (int oneBased : pages) {
            out.importPage(source.getPage(oneBased - 1));
          }
          java.io.ByteArrayOutputStream partBos = new java.io.ByteArrayOutputStream();
          out.save(partBos);
          String name = safePrefix + "-part-" + part + ".pdf";
          zip.putNextEntry(new java.util.zip.ZipEntry(name));
          zip.write(partBos.toByteArray());
          zip.closeEntry();
          part++;
        }
      }
      if (part == 1) {
        throw new IllegalArgumentException("No valid page ranges to split");
      }
      zip.finish();
      return bos.toByteArray();
    }
  }

  private static List<Integer> parsePageSpec(String spec, int pageCount) {
    List<Integer> pages = new ArrayList<>();
    if (spec == null || spec.isBlank()) return pages;
    for (String part : spec.split(",")) {
      String token = part.trim();
      if (token.isEmpty()) continue;
      if (token.contains("-")) {
        String[] ends = token.split("-", 2);
        int from = Integer.parseInt(ends[0].trim());
        int to = Integer.parseInt(ends[1].trim());
        for (int i = from; i <= to; i++) {
          if (i >= 1 && i <= pageCount) pages.add(i);
        }
      } else {
        int page = Integer.parseInt(token);
        if (page >= 1 && page <= pageCount) pages.add(page);
      }
    }
    return pages.stream().distinct().toList();
  }
}
