import { Routes } from '@angular/router';

export const PDF_TOOLS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'pdf-viewer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-viewer/pdf-viewer').then(m => m.PdfViewerComponent),
  },
  {
    path: 'merge-pdfs',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/merge-pdfs/merge-pdfs').then(m => m.MergePdfsComponent),
  },
  {
    path: 'split-pdfs',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/split-pdfs/split-pdfs').then(m => m.SplitPdfsComponent),
  },
  {
    path: 'delete-pages',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/delete-pages/delete-pages').then(m => m.DeletePagesComponent),
  },
  {
    path: 'rotate-pages',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/rotate-pages/rotate-pages').then(m => m.RotatePagesComponent),
  },
  {
    path: 'reorder-pages',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/reorder-pages/reorder-pages').then(m => m.ReorderPagesComponent),
  },
  {
    path: 'extract-pages',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/extract-pages/extract-pages').then(m => m.ExtractPagesComponent),
  },
  {
    path: 'compress-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/compress-pdf/compress-pdf').then(m => m.CompressPdfComponent),
  },
  {
    path: 'create-pdf-from-html',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/create-pdf-from-html/create-pdf-from-html').then(m => m.CreatePdfFromHtmlComponent),
  },
  {
    path: 'tables-charts-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/tables-charts-to-pdf/tables-charts-to-pdf').then(m => m.TablesChartsToPdfComponent),
  },
  {
    path: 'resume-invoice-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/resume-invoice-generator/resume-invoice-generator').then(m => m.ResumeInvoiceGeneratorComponent),
  },
  {
    path: 'text-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/text-to-pdf/text-to-pdf').then(m => m.TextToPdfComponent),
  },
  {
    path: 'screenshot-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/screenshot-to-pdf/screenshot-to-pdf').then(m => m.ScreenshotToPdfComponent),
  },
  {
    path: 'annotate-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/annotate-pdf/annotate-pdf').then(m => m.AnnotatePdfComponent),
  },
  {
    path: 'highlight-text',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/highlight-text/highlight-text').then(m => m.HighlightTextComponent),
  },
  {
    path: 'add-signature',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/add-signature/add-signature').then(m => m.AddSignatureComponent),
  },
  {
    path: 'fill-pdf-forms',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/fill-pdf-forms/fill-pdf-forms').then(m => m.FillPdfFormsComponent),
  },
  {
    path: 'pdf-metadata-editor',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-metadata-editor/pdf-metadata-editor').then(m => m.PdfMetadataEditorComponent),
  },
  {
    path: 'add-watermark',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/add-watermark/add-watermark').then(m => m.AddWatermarkComponent),
  },
  {
    path: 'pdf-to-base64',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-to-base64/pdf-to-base64').then(m => m.PdfToBase64Component),
  },
  {
    path: 'password-protect-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/password-protect-pdf/password-protect-pdf').then(m => m.PasswordProtectPdfComponent),
  },
  {
    path: 'flatten-pdf-forms',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/flatten-pdf-forms/flatten-pdf-forms').then(m => m.FlattenPdfFormsComponent),
  },
  {
    path: 'html-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/html-to-pdf/html-to-pdf').then(m => m.HtmlToPdfComponent),
  },
  {
    path: 'tables-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/tables-to-pdf/tables-to-pdf').then(m => m.TablesToPdfComponent),
  },
  {
    path: 'charts-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/charts-to-pdf/charts-to-pdf').then(m => m.ChartsToPdfComponent),
  },
  {
    path: 'resume-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/resume-generator/resume-generator').then(m => m.ResumeGeneratorComponent),
  },
  {
    path: 'invoice-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/invoice-generator/invoice-generator').then(m => m.InvoiceGeneratorComponent),
  },
  {
    path: 'image-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/image-to-pdf/image-to-pdf').then(m => m.ImageToPdfComponent),
  },
  {
    path: 'add-page-numbers',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/add-page-numbers/add-page-numbers').then(m => m.AddPageNumbersComponent),
  },
  {
    path: 'barcode-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/barcode-to-pdf/barcode-to-pdf').then(m => m.BarcodeToPdfComponent),
  },
  {
    path: 'qr-code-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/qr-code-to-pdf/qr-code-to-pdf').then(m => m.QrCodeToPdfComponent),
  },

  // —— AUTO: advanced PDF tools (generated) ——
  {
    path: 'pdf-to-txt',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-to-txt/pdf-to-txt').then(m => m.PdfToTxtComponent),
  },
  {
    path: 'pdf-to-html',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-to-html/pdf-to-html').then(m => m.PdfToHtmlComponent),
  },
  {
    path: 'pdf-to-markdown',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-to-markdown/pdf-to-markdown').then(m => m.PdfToMarkdownComponent),
  },
  {
    path: 'pdf-to-csv',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-to-csv/pdf-to-csv').then(m => m.PdfToCsvComponent),
  },
  {
    path: 'pdf-to-json',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-to-json/pdf-to-json').then(m => m.PdfToJsonComponent),
  },
  {
    path: 'pdf-to-epub',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-to-epub/pdf-to-epub').then(m => m.PdfToEpubComponent),
  },
  {
    path: 'pdf-to-pdfa',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-to-pdfa/pdf-to-pdfa').then(m => m.PdfToPdfaComponent),
  },
  {
    path: 'pdf-to-images',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-to-images/pdf-to-images').then(m => m.PdfToImagesComponent),
  },
  {
    path: 'ocr-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/ocr-pdf/ocr-pdf').then(m => m.OcrPdfComponent),
  },
  {
    path: 'pdf-deskew',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-deskew/pdf-deskew').then(m => m.PdfDeskewComponent),
  },
  {
    path: 'images-to-searchable-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/images-to-searchable-pdf/images-to-searchable-pdf').then(m => m.ImagesToSearchablePdfComponent),
  },
  {
    path: 'pdf-to-docx',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-to-docx/pdf-to-docx').then(m => m.PdfToDocxComponent),
  },
  {
    path: 'url-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/url-to-pdf/url-to-pdf').then(m => m.UrlToPdfComponent),
  },
  {
    path: 'markdown-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/markdown-to-pdf/markdown-to-pdf').then(m => m.MarkdownToPdfComponent),
  },
  {
    path: 'word-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/word-to-pdf/word-to-pdf').then(m => m.WordToPdfComponent),
  },
  {
    path: 'excel-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/excel-to-pdf/excel-to-pdf').then(m => m.ExcelToPdfComponent),
  },
  {
    path: 'powerpoint-to-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/powerpoint-to-pdf/powerpoint-to-pdf').then(m => m.PowerpointToPdfComponent),
  },
  {
    path: 'pdf-page-duplicator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-page-duplicator/pdf-page-duplicator').then(m => m.PdfPageDuplicatorComponent),
  },
  {
    path: 'pdf-page-replacer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-page-replacer/pdf-page-replacer').then(m => m.PdfPageReplacerComponent),
  },
  {
    path: 'pdf-page-cropper',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-page-cropper/pdf-page-cropper').then(m => m.PdfPageCropperComponent),
  },
  {
    path: 'pdf-page-resizer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-page-resizer/pdf-page-resizer').then(m => m.PdfPageResizerComponent),
  },
  {
    path: 'pdf-header-footer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-header-footer/pdf-header-footer').then(m => m.PdfHeaderFooterComponent),
  },
  {
    path: 'pdf-bookmark-creator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-bookmark-creator/pdf-bookmark-creator').then(m => m.PdfBookmarkCreatorComponent),
  },
  {
    path: 'pdf-table-of-contents',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-table-of-contents/pdf-table-of-contents').then(m => m.PdfTableOfContentsComponent),
  },
  {
    path: 'pdf-form-creator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-form-creator/pdf-form-creator').then(m => m.PdfFormCreatorComponent),
  },
  {
    path: 'pdf-form-export',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-form-export/pdf-form-export').then(m => m.PdfFormExportComponent),
  },
  {
    path: 'pdf-form-import',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-form-import/pdf-form-import').then(m => m.PdfFormImportComponent),
  },
  {
    path: 'pdf-form-validate',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-form-validate/pdf-form-validate').then(m => m.PdfFormValidateComponent),
  },
  {
    path: 'unlock-pdf',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/unlock-pdf/unlock-pdf').then(m => m.UnlockPdfComponent),
  },
  {
    path: 'pdf-password-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-password-generator/pdf-password-generator').then(m => m.PdfPasswordGeneratorComponent),
  },
  {
    path: 'pdf-permission-manager',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-permission-manager/pdf-permission-manager').then(m => m.PdfPermissionManagerComponent),
  },
  {
    path: 'pdf-annotation-remover',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-annotation-remover/pdf-annotation-remover').then(m => m.PdfAnnotationRemoverComponent),
  },
  {
    path: 'pdf-metadata-remover',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-metadata-remover/pdf-metadata-remover').then(m => m.PdfMetadataRemoverComponent),
  },
  {
    path: 'pdf-hidden-data-remover',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-hidden-data-remover/pdf-hidden-data-remover').then(m => m.PdfHiddenDataRemoverComponent),
  },
  {
    path: 'pdf-signature-verification',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-signature-verification/pdf-signature-verification').then(m => m.PdfSignatureVerificationComponent),
  },
  {
    path: 'pdf-digital-signature',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-digital-signature/pdf-digital-signature').then(m => m.PdfDigitalSignatureComponent),
  },
  {
    path: 'pdf-signature-stamp',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-signature-stamp/pdf-signature-stamp').then(m => m.PdfSignatureStampComponent),
  },
  {
    path: 'pdf-font-inspector',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-font-inspector/pdf-font-inspector').then(m => m.PdfFontInspectorComponent),
  },
  {
    path: 'pdf-image-extractor',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-image-extractor/pdf-image-extractor').then(m => m.PdfImageExtractorComponent),
  },
  {
    path: 'pdf-link-extractor',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-link-extractor/pdf-link-extractor').then(m => m.PdfLinkExtractorComponent),
  },
  {
    path: 'pdf-attachment-extractor',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-attachment-extractor/pdf-attachment-extractor').then(m => m.PdfAttachmentExtractorComponent),
  },
  {
    path: 'pdf-grayscale-converter',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-grayscale-converter/pdf-grayscale-converter').then(m => m.PdfGrayscaleConverterComponent),
  },
  {
    path: 'pdf-color-converter',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-color-converter/pdf-color-converter').then(m => m.PdfColorConverterComponent),
  },
  {
    path: 'pdf-dpi-converter',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-dpi-converter/pdf-dpi-converter').then(m => m.PdfDpiConverterComponent),
  },
  {
    path: 'pdf-print-optimizer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-print-optimizer/pdf-print-optimizer').then(m => m.PdfPrintOptimizerComponent),
  },
  {
    path: 'pdf-web-optimizer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-web-optimizer/pdf-web-optimizer').then(m => m.PdfWebOptimizerComponent),
  },
  {
    path: 'pdf-accessibility-checker',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-accessibility-checker/pdf-accessibility-checker').then(m => m.PdfAccessibilityCheckerComponent),
  },
  {
    path: 'pdf-validator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-validator/pdf-validator').then(m => m.PdfValidatorComponent),
  },
  {
    path: 'pdf-repair',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-repair/pdf-repair').then(m => m.PdfRepairComponent),
  },
  {
    path: 'pdf-duplicate-finder',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-duplicate-finder/pdf-duplicate-finder').then(m => m.PdfDuplicateFinderComponent),
  },
  {
    path: 'pdf-search',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-search/pdf-search').then(m => m.PdfSearchComponent),
  },
  {
    path: 'pdf-batch-processing',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-batch-processing/pdf-batch-processing').then(m => m.PdfBatchProcessingComponent),
  },
  {
    path: 'pdf-file-renamer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-file-renamer/pdf-file-renamer').then(m => m.PdfFileRenamerComponent),
  },
  {
    path: 'pdf-organizer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-organizer/pdf-organizer').then(m => m.PdfOrganizerComponent),
  },
  {
    path: 'pdf-version-comparison',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-version-comparison/pdf-version-comparison').then(m => m.PdfVersionComparisonComponent),
  },
  {
    path: 'pdf-visual-comparison',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-visual-comparison/pdf-visual-comparison').then(m => m.PdfVisualComparisonComponent),
  },
  {
    path: 'pdf-diff',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-diff/pdf-diff').then(m => m.PdfDiffComponent),
  },
  {
    path: 'pdf-keyword-finder',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-keyword-finder/pdf-keyword-finder').then(m => m.PdfKeywordFinderComponent),
  },
  {
    path: 'pdf-citation-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-citation-generator/pdf-citation-generator').then(m => m.PdfCitationGeneratorComponent),
  },
  {
    path: 'pdf-reference-extractor',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-reference-extractor/pdf-reference-extractor').then(m => m.PdfReferenceExtractorComponent),
  },
  {
    path: 'pdf-invoice-extractor',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-invoice-extractor/pdf-invoice-extractor').then(m => m.PdfInvoiceExtractorComponent),
  },
  {
    path: 'pdf-receipt-extractor',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-receipt-extractor/pdf-receipt-extractor').then(m => m.PdfReceiptExtractorComponent),
  },
  {
    path: 'pdf-resume-parser',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-resume-parser/pdf-resume-parser').then(m => m.PdfResumeParserComponent),
  },
  {
    path: 'pdf-contract-analyzer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-contract-analyzer/pdf-contract-analyzer').then(m => m.PdfContractAnalyzerComponent),
  },
  {
    path: 'pdf-document-classifier',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-document-classifier/pdf-document-classifier').then(m => m.PdfDocumentClassifierComponent),
  },
  {
    path: 'pdf-data-extractor',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-data-extractor/pdf-data-extractor').then(m => m.PdfDataExtractorComponent),
  },
  {
    path: 'pdf-entity-extractor',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-entity-extractor/pdf-entity-extractor').then(m => m.PdfEntityExtractorComponent),
  },
  {
    path: 'pdf-summarizer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-summarizer/pdf-summarizer').then(m => m.PdfSummarizerComponent),
  },
  {
    path: 'pdf-question-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-question-generator/pdf-question-generator').then(m => m.PdfQuestionGeneratorComponent),
  },
  {
    path: 'pdf-quiz-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-quiz-generator/pdf-quiz-generator').then(m => m.PdfQuizGeneratorComponent),
  },
  {
    path: 'pdf-flashcard-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-flashcard-generator/pdf-flashcard-generator').then(m => m.PdfFlashcardGeneratorComponent),
  },
  {
    path: 'pdf-notes-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-notes-generator/pdf-notes-generator').then(m => m.PdfNotesGeneratorComponent),
  },
  {
    path: 'pdf-mind-map-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-mind-map-generator/pdf-mind-map-generator').then(m => m.PdfMindMapGeneratorComponent),
  },
  {
    path: 'pdf-presentation-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-presentation-generator/pdf-presentation-generator').then(m => m.PdfPresentationGeneratorComponent),
  },
  {
    path: 'pdf-report-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-report-generator/pdf-report-generator').then(m => m.PdfReportGeneratorComponent),
  },
  {
    path: 'pdf-accessibility-tagger',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-accessibility-tagger/pdf-accessibility-tagger').then(m => m.PdfAccessibilityTaggerComponent),
  },
  {
    path: 'pdf-reading-order-fixer',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-reading-order-fixer/pdf-reading-order-fixer').then(m => m.PdfReadingOrderFixerComponent),
  },
  {
    path: 'pdf-alt-text-generator',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-alt-text-generator/pdf-alt-text-generator').then(m => m.PdfAltTextGeneratorComponent),
  },
  {
    path: 'pdf-redact',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-redact/pdf-redact').then(m => m.PdfRedactComponent),
  },
  {
    path: 'pdf-redaction-finder',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-redaction-finder/pdf-redaction-finder').then(m => m.PdfRedactionFinderComponent),
  },
  {
    path: 'pdf-sensitive-data-scanner',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-sensitive-data-scanner/pdf-sensitive-data-scanner').then(m => m.PdfSensitiveDataScannerComponent),
  },
  {
    path: 'pdf-pii-detector',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-pii-detector/pdf-pii-detector').then(m => m.PdfPiiDetectorComponent),
  },
  {
    path: 'pdf-ai-assistant',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-ai-assistant/pdf-ai-assistant').then(m => m.PdfAiAssistantComponent),
  },
  {
    path: 'multi-pdf-search',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/multi-pdf-search/multi-pdf-search').then(m => m.MultiPdfSearchComponent),
  },
  {
    path: 'multi-pdf-chat',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/multi-pdf-chat/multi-pdf-chat').then(m => m.MultiPdfChatComponent),
  },
  {
    path: 'pdf-knowledge-base',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-knowledge-base/pdf-knowledge-base').then(m => m.PdfKnowledgeBaseComponent),
  },
  {
    path: 'pdf-rag',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-rag/pdf-rag').then(m => m.PdfRagComponent),
  },
  {
    path: 'pdf-workflow-automation',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-workflow-automation/pdf-workflow-automation').then(m => m.PdfWorkflowAutomationComponent),
  },
  {
    path: 'pdf-translation-layout',
    loadComponent: () =>
      import('@tools-workspace/pdf-tools/pdf-translation-layout/pdf-translation-layout').then(m => m.PdfTranslationLayoutComponent),
  },
];
