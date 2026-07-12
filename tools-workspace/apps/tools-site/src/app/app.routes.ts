import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: 'tools',
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('@tools-workspace/features-home').then(m => m.MyComponent), // This is a standalone component
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
    {
    path: 'text-utilities',
    children: [ 
      { path: '', redirectTo: 'character-counter', pathMatch: 'full' },
      {
        path: 'character-counter',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.WordsAndCharacterCounterComponent), // This is a standalone component
      },
      {
        path: 'text-case-convertor',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.TextCaseConvertorComponent), // This is a standalone component
      },
      {
        path: 'text-to-ascii',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.TextToASCIIComponent), // This is a standalone component
      },
      {
        path: 'remove-duplicate-lines',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.RemoveDuplicateLinesComponent), // This is a standalone component
      },
      {
        path: 'text-reversal-and-palindrome-checker',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.TextReversalAndPalindromeCheckerComponent), // This is a standalone component
      },
      {
        path: 'base64-encode-and-decode',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.Base64EncodeAndDecodeComponent), // This is a standalone component
      },
      {
        path: 'slug-generator',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.SlugGeneratorComponent), // This is a standalone component
      },
      {
        path: 'text-difference',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.TextDifferenceComponent), // This is a standalone component
      },
      {
        path: 'code-merge',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.CodeMergeComponent), // This is a standalone component
      },
      {
        path: 'url-encode-and-decode',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.UrlEncodeAndDecodeComponent),
      },
      {
        path: 'unicode-escape-unescape',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.UnicodeEscapeUnescapeComponent),
      },
      {
        path: 'html-tag-stripper',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.HtmlTagStripperComponent),
      },
      {
        path: 'sort-lines',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.SortLinesComponent),
      },
      {
        path: 'trim-normalize-whitespace',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.TrimNormalizeWhitespaceComponent),
      },
      {
        path: 'find-and-replace',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.FindAndReplaceComponent),
      },
      {
        path: 'line-number-tool',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.LineNumberToolComponent),
      },
      {
        path: 'split-join-text',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.SplitJoinTextComponent),
      },
      {
        path: 'regex-tester',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.RegexTesterComponent),
      },
      {
        path: 'text-similarity',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.TextSimilarityComponent),
      },
      {
        path: 'invisible-character-detector',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.InvisibleCharacterDetectorComponent),
      },
      {
        path: 'word-wrap-unwrap',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.WordWrapUnwrapComponent),
      },
      {
        path: 'extract-emails-urls',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.ExtractEmailsUrlsComponent),
      },
      {
        path: 'json-string-escape-unescape',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.JsonStringEscapeUnescapeComponent),
      },
      {
        path: 'hex-encode-decode',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.HexEncodeDecodeComponent),
      },
      {
        path: 'rot13-cipher',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.Rot13CipherComponent),
      },
      {
        path: 'binary-text-converter',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.BinaryTextConverterComponent),
      },
      {
        path: 'morse-code-converter',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.MorseCodeConverterComponent),
      },
      {
        path: 'readability-analyzer',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.ReadabilityAnalyzerComponent),
      },
      {
        path: 'keyword-density',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.KeywordDensityComponent),
      },
      {
        path: 'pako-encode-and-decode',
        loadComponent: () =>
          import('@tools-workspace/text-utilities').then(m => m.PakoEncodeAndDecodeComponent),
      },
    ],
  },
  {
    path: 'file-viewers',
    children: [
      { path: '', redirectTo: 'image-viewer', pathMatch: 'full' },
      {
        path: 'image-viewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.ImageViewerComponent),
      },
      {
        path: 'pdf-viewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.FileViewerPdfViewerComponent),
      },
      {
        path: 'word-viewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.FileViewerWordViewerComponent),
      },
      {
        path: 'powerpoint-viewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.PowerpointViewerComponent),
      },
      {
        path: 'text-file-viewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.TextFileViewerComponent),
      },
      {
        path: 'markdown-previewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.MarkdownPreviewerComponent),
      },
      {
        path: 'excel-viewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.ExcelViewerComponent),
      },
      {
        path: 'log-viewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.LogViewerComponent),
      },
      {
        path: 'audio-player',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.FileViewerAudioPlayerComponent),
      },
      {
        path: 'video-player',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.VideoPlayerComponent),
      },
      {
        path: 'font-viewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.FontViewerComponent),
      },
      {
        path: '3d-model-viewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.Model3dViewerComponent),
      },
      {
        path: 'archive-viewer',
        loadComponent: () =>
          import('@tools-workspace/file-viewers').then(m => m.ArchiveViewerComponent),
      },
    ],
  },
  {
    path: 'data-converters',
    children: [
      { path: '', redirectTo: 'json-formatter-beautifier-validator', pathMatch: 'full' },
      {
        path: 'json-formatter-beautifier-validator',
        loadComponent: () =>
          import('@tools-workspace/data-converters').then(m => m.JsonFormatterBeautifierValidatorComponent),
      },
      {
        path: 'csv-to-json-json-to-csv',
        loadComponent: () =>
          import('@tools-workspace/data-converters').then(m => m.CsvToJsonJsonToCsvComponent),
      },
      {
        path: 'yaml-to-json-json-to-yaml',
        loadComponent: () =>
          import('@tools-workspace/data-converters').then(m => m.YamlToJsonJsonToYamlComponent),
      },
      {
        path: 'html-table-to-json',
        loadComponent: () =>
          import('@tools-workspace/data-converters').then(m => m.HtmlTableToJsonComponent),
      },
      {
        path: 'markdown-to-html',
        loadComponent: () =>
          import('@tools-workspace/data-converters').then(m => m.MarkdownToHtmlComponent),
      },
      {
        path: 'json-linter-viewer',
        loadComponent: () =>
          import('@tools-workspace/data-converters').then(m => m.JsonLinterViewerComponent),
      },
      {
        path: 'excel-to-json',
        loadComponent: () =>
          import('@tools-workspace/data-converters').then(m => m.ExcelToJsonComponent),
      },
      {
        path: 'json-parser',
        loadComponent: () =>
          import('@tools-workspace/data-converters').then(m => m.JsonParserComponent),
      },
    ],
  },
  {
    path: 'math-date-utils',
    children: [
      { path: '', redirectTo: 'unit-converter', pathMatch: 'full' },
      {
        path: 'unit-converter',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.UnitConverterComponent),
      },
      {
        path: 'number-to-words',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.NumberToWordsComponent),
      },
      {
        path: 'percentage-calculator',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.PercentageCalculatorComponent),
      },
      {
        path: 'age-calculator',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.AgeCalculatorComponent),
      },
      {
        path: 'date-difference-calculator',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.DateDifferenceCalculatorComponent),
      },
      {
        path: 'simple-compound-interest-calculator',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.SimpleCompoundInterestCalculatorComponent),
      },
      {
        path: 'bmi-calculator',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.BmiCalculatorComponent),
      },
      {
        path: 'loan-emi-calculator',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.LoanEmiCalculatorComponent),
      },
      {
        path: 'tip-calculator',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.TipCalculatorComponent),
      },
      {
        path: 'currency-converter',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.CurrencyConverterComponent),
      },
      {
        path: 'fraction-calculator',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.FractionCalculatorComponent),
      },
      {
        path: 'date-to-day-of-week',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.DateToDayOfWeekComponent),
      },
      {
        path: 'zodiac-finder',
        loadComponent: () =>
          import('@tools-workspace/math-date-utils').then(m => m.ZodiacFinderComponent),
      },
    ],
  },
  {
    path: 'pdf-tools',
    children: [
      { path: '', redirectTo: 'pdf-viewer', pathMatch: 'full' },
      {
        path: 'pdf-viewer',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.PdfViewerComponent),
      },
      {
        path: 'merge-pdfs',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.MergePdfsComponent),
      },
      { path: 'merge-pdf', redirectTo: 'merge-pdfs', pathMatch: 'full' },
      {
        path: 'split-pdfs',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.SplitPdfsComponent),
      },
      { path: 'split-pdf', redirectTo: 'split-pdfs', pathMatch: 'full' },
      {
        path: 'delete-pages',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.DeletePagesComponent),
      },
      {
        path: 'rotate-pages',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.RotatePagesComponent),
      },
      {
        path: 'reorder-pages',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.ReorderPagesComponent),
      },
      {
        path: 'extract-pages',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.ExtractPagesComponent),
      },
      {
        path: 'compress-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.CompressPdfComponent),
      },
      {
        path: 'create-pdf-from-html',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.CreatePdfFromHtmlComponent),
      },
      {
        path: 'tables-charts-to-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.TablesChartsToPdfComponent),
      },
      {
        path: 'resume-invoice-generator',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.ResumeInvoiceGeneratorComponent),
      },
      {
        path: 'text-to-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.TextToPdfComponent),
      },
      {
        path: 'screenshot-to-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.ScreenshotToPdfComponent),
      },
      {
        path: 'annotate-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.AnnotatePdfComponent),
      },
      {
        path: 'highlight-text',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.HighlightTextComponent),
      },
      {
        path: 'add-signature',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.AddSignatureComponent),
      },
      {
        path: 'fill-pdf-forms',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.FillPdfFormsComponent),
      },
      {
        path: 'pdf-metadata-editor',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.PdfMetadataEditorComponent),
      },
      {
        path: 'add-watermark',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.AddWatermarkComponent),
      },
      {
        path: 'pdf-to-base64',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.PdfToBase64Component),
      },
      {
        path: 'password-protect-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.PasswordProtectPdfComponent),
      },
      {
        path: 'flatten-pdf-forms',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.FlattenPdfFormsComponent),
      },
      {
        path: 'html-to-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.HtmlToPdfComponent),
      },
      {
        path: 'tables-to-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.TablesToPdfComponent),
      },
      {
        path: 'charts-to-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.ChartsToPdfComponent),
      },
      {
        path: 'resume-generator',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.ResumeGeneratorComponent),
      },
      {
        path: 'invoice-generator',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.InvoiceGeneratorComponent),
      },
      {
        path: 'image-to-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.ImageToPdfComponent),
      },
      {
        path: 'add-page-numbers',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.AddPageNumbersComponent),
      },
      {
        path: 'barcode-to-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.BarcodeToPdfComponent),
      },
      {
        path: 'qr-code-to-pdf',
        loadComponent: () =>
          import('@tools-workspace/pdf-tools').then(m => m.QrCodeToPdfComponent),
      },
      { path: 'highlight-pdf', redirectTo: 'highlight-text', pathMatch: 'full' },
      { path: 'fill-pdf-form', redirectTo: 'fill-pdf-forms', pathMatch: 'full' },
    ],
  },
  {
    path: 'image-color-tools',
    children: [
      { path: '', redirectTo: 'image-to-base64', pathMatch: 'full' },
      {
        path: 'image-to-base64',
        loadComponent: () =>
          import('@tools-workspace/image-color-tools').then(m => m.ImageToBase64Component),
      },
      {
        path: 'image-resizer',
        loadComponent: () =>
          import('@tools-workspace/image-color-tools').then(m => m.ImageResizerComponent),
      },
      {
        path: 'image-compressor',
        loadComponent: () =>
          import('@tools-workspace/image-color-tools').then(m => m.ImageCompressorComponent),
      },
      {
        path: 'color-picker',
        loadComponent: () =>
          import('@tools-workspace/image-color-tools').then(m => m.ColorPickerComponent),
      },
      {
        path: 'hex-to-rgb',
        loadComponent: () =>
          import('@tools-workspace/image-color-tools').then(m => m.HexToRgbComponent),
      },
      {
        path: 'gradient-generator',
        loadComponent: () =>
          import('@tools-workspace/image-color-tools').then(m => m.GradientGeneratorComponent),
      },
      {
        path: 'palette-generator',
        loadComponent: () =>
          import('@tools-workspace/image-color-tools').then(m => m.PaletteGeneratorComponent),
      },
      {
        path: 'image-to-text',
        loadComponent: () =>
          import('@tools-workspace/image-color-tools').then(m => m.ImageToTextComponent),
      },
      {
        path: 'favicon-generator',
        loadComponent: () =>
          import('@tools-workspace/image-color-tools').then(m => m.FaviconGeneratorComponent),
      },
      {
        path: 'drawing-pad',
        loadComponent: () =>
          import('@tools-workspace/image-color-tools').then(m => m.DrawingPadComponent),
      },
    ],
  },
  {
    path: 'code-file-tools',
    children: [
      { path: '', redirectTo: 'html-minifier', pathMatch: 'full' },
      {
        path: 'html-minifier',
        loadComponent: () =>
          import('@tools-workspace/code-file-tools').then(m => m.HtmlMinifierComponent),
      },
      {
        path: 'css-minifier',
        loadComponent: () =>
          import('@tools-workspace/code-file-tools').then(m => m.CssMinifierComponent),
      },
      {
        path: 'javascript-minifier',
        loadComponent: () =>
          import('@tools-workspace/code-file-tools').then(m => m.JavascriptMinifierComponent),
      },
      {
        path: 'html-entity-encoder',
        loadComponent: () =>
          import('@tools-workspace/code-file-tools').then(m => m.HtmlEntityEncoderComponent),
      },
      {
        path: 'clipboard-viewer',
        loadComponent: () =>
          import('@tools-workspace/code-file-tools').then(m => m.ClipboardViewerComponent),
      },
      {
        path: 'clipboard-history',
        loadComponent: () =>
          import('@tools-workspace/code-file-tools').then(m => m.ClipboardHistoryComponent),
      },
      {
        path: 'file-metadata-viewer',
        loadComponent: () =>
          import('@tools-workspace/code-file-tools').then(m => m.FileMetadataViewerComponent),
      },
      {
        path: 'markdown-to-pdf',
        loadComponent: () =>
          import('@tools-workspace/code-file-tools').then(m => m.MarkdownToPdfComponent),
      },
      {
        path: 'html-table-exporter',
        loadComponent: () =>
          import('@tools-workspace/code-file-tools').then(m => m.HtmlTableExporterComponent),
      },
    ],
  },
  {
    path: 'dev-design-tools',
    children: [
      { path: '', redirectTo: 'css-gradient-generator', pathMatch: 'full' },
      {
        path: 'css-gradient-generator',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.CssGradientGeneratorComponent),
      },
      {
        path: 'box-shadow-generator',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.BoxShadowGeneratorComponent),
      },
      {
        path: 'border-radius-preview',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.BorderRadiusPreviewComponent),
      },
      {
        path: 'pixel-to-rem',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.PixelToRemComponent),
      },
      {
        path: 'responsive-breakpoint-tester',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.ResponsiveBreakpointTesterComponent),
      },
      {
        path: 'viewport-size-detector',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.ViewportSizeDetectorComponent),
      },
      {
        path: 'postman-lite',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.PostmanLiteComponent),
      },
      {
        path: 'cors-test-tool',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.CorsTestToolComponent),
      },
      {
        path: 'http-header-decoder',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.HttpHeaderDecoderComponent),
      },
      {
        path: 'websocket-client',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.WebSocketClientComponent),
      },
      {
        path: 'http-request-generator',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.HttpRequestGeneratorComponent),
      },
      {
        path: 'mock-json-generator',
        loadComponent: () =>
          import('@tools-workspace/dev-design-tools').then(m => m.MockJsonGeneratorComponent),
      },
    ],
  },
  {
    path: 'testing-tools',
    children: [
      { path: '', redirectTo: 'json-schema-validator', pathMatch: 'full' },
      {
        path: 'json-schema-validator',
        loadComponent: () =>
          import('@tools-workspace/testing-tools').then(m => m.JsonSchemaValidatorComponent),
      },
      {
        path: 'password-rule-validator',
        loadComponent: () =>
          import('@tools-workspace/testing-tools').then(m => m.PasswordRuleValidatorComponent),
      },
      {
        path: 'email-url-ip-checker',
        loadComponent: () =>
          import('@tools-workspace/testing-tools').then(m => m.EmailUrlIpCheckerComponent),
      },
      {
        path: 'user-agent-parser',
        loadComponent: () =>
          import('@tools-workspace/testing-tools').then(m => m.UserAgentParserComponent),
      },
      {
        path: 'credit-card-validator',
        loadComponent: () =>
          import('@tools-workspace/testing-tools').then(m => m.CreditCardValidatorComponent),
      },
      {
        path: 'jwt-decoder',
        loadComponent: () =>
          import('@tools-workspace/testing-tools').then(m => m.JwtDecoderComponent),
      },
    ],
  },
  {
    path: 'security-tools',
    children: [
      { path: '', redirectTo: 'hash-generator', pathMatch: 'full' },
      {
        path: 'hash-generator',
        loadComponent: () =>
          import('@tools-workspace/security-tools').then(m => m.HashGeneratorComponent),
      },
      {
        path: 'uuid-generator',
        loadComponent: () =>
          import('@tools-workspace/security-tools').then(m => m.UuidGeneratorComponent),
      },
      {
        path: 'password-strength-checker',
        loadComponent: () =>
          import('@tools-workspace/security-tools').then(m => m.PasswordStrengthCheckerComponent),
      },
      {
        path: 'random-password-generator',
        loadComponent: () =>
          import('@tools-workspace/security-tools').then(m => m.RandomPasswordGeneratorComponent),
      },
      {
        path: 'text-encrypt-decrypt',
        loadComponent: () =>
          import('@tools-workspace/security-tools').then(m => m.TextEncryptDecryptComponent),
      },
      {
        path: 'secure-clipboard',
        loadComponent: () =>
          import('@tools-workspace/security-tools').then(m => m.SecureClipboardComponent),
      },
      {
        path: 'private-notes',
        loadComponent: () =>
          import('@tools-workspace/security-tools').then(m => m.PrivateNotesComponent),
      },
    ],
  },
  {
    path: 'media-tools',
    children: [
      { path: '', redirectTo: 'voice-recorder', pathMatch: 'full' },
      {
        path: 'voice-recorder',
        loadComponent: () =>
          import('@tools-workspace/media-tools').then(m => m.VoiceRecorderComponent),
      },
      {
        path: 'audio-player',
        loadComponent: () =>
          import('@tools-workspace/media-tools').then(m => m.AudioPlayerComponent),
      },
      {
        path: 'audio-trimmer',
        loadComponent: () =>
          import('@tools-workspace/media-tools').then(m => m.AudioTrimmerComponent),
      },
      {
        path: 'video-to-gif',
        loadComponent: () =>
          import('@tools-workspace/media-tools').then(m => m.VideoToGifComponent),
      },
      {
        path: 'webcam-snapshot',
        loadComponent: () =>
          import('@tools-workspace/media-tools').then(m => m.WebcamSnapshotComponent),
      },
    ],
  },
  {
    path: 'browser-utils',
    children: [
      { path: '', redirectTo: 'screen-resolution-info', pathMatch: 'full' },
      {
        path: 'screen-resolution-info',
        loadComponent: () =>
          import('@tools-workspace/browser-utils').then(m => m.ScreenResolutionInfoComponent),
      },
      {
        path: 'battery-status-viewer',
        loadComponent: () =>
          import('@tools-workspace/browser-utils').then(m => m.BatteryStatusViewerComponent),
      },
      {
        path: 'device-orientation-logger',
        loadComponent: () =>
          import('@tools-workspace/browser-utils').then(m => m.DeviceOrientationLoggerComponent),
      },
      {
        path: 'storage-viewer',
        loadComponent: () =>
          import('@tools-workspace/browser-utils').then(m => m.StorageViewerComponent),
      },
      {
        path: 'cookie-editor',
        loadComponent: () =>
          import('@tools-workspace/browser-utils').then(m => m.CookieEditorComponent),
      },
      {
        path: 'network-speed-test',
        loadComponent: () =>
          import('@tools-workspace/browser-utils').then(m => m.NetworkSpeedTestComponent),
      },
    ],
  },
  {
    path: 'fun-tools',
    children: [
      { path: '', redirectTo: 'qr-code-generator', pathMatch: 'full' },
      {
        path: 'qr-code-generator',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.QrCodeGeneratorComponent),
      },
      {
        path: 'barcode-generator',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.BarcodeGeneratorComponent),
      },
      {
        path: 'stopwatch-timer',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.StopwatchTimerComponent),
      },
      {
        path: 'random-number-generator',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.RandomNumberGeneratorComponent),
      },
      {
        path: 'coin-toss-dice-roller',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.CoinTossDiceRollerComponent),
      },
      {
        path: 'lorem-ipsum-generator',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.LoremIpsumGeneratorComponent),
      },
      {
        path: 'timezone-converter',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.TimezoneConverterComponent),
      },
      {
        path: 'typing-speed-test',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.TypingSpeedTestComponent),
      },
      {
        path: 'pomodoro-timer',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.PomodoroTimerComponent),
      },
      {
        path: 'flashcard-quiz-generator',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.FlashcardQuizGeneratorComponent),
      },
      {
        path: 'motivational-quote-generator',
        loadComponent: () =>
          import('@tools-workspace/fun-tools').then(m => m.MotivationalQuoteGeneratorComponent),
      },
    ],
  },
  { path: '', redirectTo: 'tools', pathMatch: 'full' },
  { path: '**', redirectTo: 'tools' },
];
