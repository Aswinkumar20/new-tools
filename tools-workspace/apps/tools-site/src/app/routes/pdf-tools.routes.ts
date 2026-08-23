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
];
