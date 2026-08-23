# Components

Standalone Angular components (`prefix: lib`). Most tools have **no `@Input`/`@Output`**; logic lives in sibling `utils/`. Status: **OK** | **Soon** | **Thin** (PDF mode wrapper).

## App shell — `apps/tools-site/src/app/`

| Symbol | Path | Role |
| ------ | ---- | ---- |
| `App` | `app.ts` | Outlet, footer, toasts, SEO/GA, theme |
| GA directives | `directives/ga-*.ts` | Click/scroll/tool action (underused in templates) |
| `SeoService` | `services/seo.service.ts` | Meta / JSON-LD |
| `GoogleAnalyticsService` | `services/google-analytics.service.ts` | gtag wrapper |
| `AutoGATrackerService` | `services/auto-ga-tracker.service.ts` | Route → tool map |

**Deprecated leftovers:** `app.html`, `nx-welcome.ts`, outdated `app.spec.ts` (expects Nx welcome). Prefer deleting.

## features-home — `libs/features-home/src/lib/`

| Component / service | Selector / name | Notes |
| ------------------- | --------------- | ----- |
| `MyComponent` | `lib-my-component` | Home |
| `NavigationComponent` | `lib-navigation` | `@Input() reserveSpace` |
| `FooterComponent` | `lib-footer` | Mounted in `App` |
| `ToastContainer` / `Toast` | `lib-toast-container` / `lib-toast` | Toast not in public index |
| `ToastService` | root | BehaviorSubject bus |
| `AssetService` | root | Base-href-safe `/assets` |
| `LanguageService` / `TranslationService` | root | Re-exported from `index.ts` |
| `TranslatePipe` / `TranslateDirective` | `translate` / `[appTranslate]` | Re-exported from `index.ts` |
| `ComingSoonPageComponent` | `lib-coming-soon-page` | Shared placeholder; configs in `constants/coming-soon-tools.ts` |
| `TooltipDirective` | `appTooltip` | Widely used |

## Shared bases

### `TextToolBase`

`libs/text-utilities/src/lib/shared/text-tool-base.ts` — abstract directive: input/output, undo/redo, 10 MB upload, clipboard via `tuCopyText`. ~22 text tools extend it.

### PDF workbenches

| Component | Inputs | Role |
| --------- | ------ | ---- |
| `PdfWorkbenchComponent` | `mode`, `title`, `description` | Edit modes (pdf-lib) |
| `PdfJspdfWorkbenchComponent` | mode + titles | Create modes (jsPDF CDN) |

Thin route components only set those inputs.

---

## Catalog by library

### text-utilities (30) — all OK

`base64EncodeAndDecode`, `binaryTextConverter`, `codeMerge`, `extractEmailsUrls`, `findAndReplace`, `hexEncodeDecode`, `htmlTagStripper`, `invisibleCharacterDetector`, `jsonStringEscapeUnescape`, `keywordDensity`, `lineNumberTool`, `morseCodeConverter`, `pakoEncodeAndDecode`, `readabilityAnalyzer`, `regexTester`, `removeDuplicateLines`, `rot13Cipher`, `slugGenerator`, `sortLines`, `splitJoinText`, `textCaseConvertor`, `textDifferrence` (folder typo), `textReverserAndPalindromeChecker`, `textSimilarity`, `textToASCII`, `trimNormalizeWhitespace`, `unicodeEscapeUnescape`, `urlEncodeAndDecode` (no separate utils/types folders), `wordsAndCharacterCounter`, `wordWrapUnwrap`.

### file-viewers (25 live)

OK: image, pdf, word, excel, powerpoint, text, markdown, archive, font, log, audio/video, 3D, ebooks, SVG/PSD/AI/HEIC/RAW/TIFF, OpenDocument, RTF, XES.  
**Soon (shared page):** subtitle, MIDI, MusicXML, APK/IPA, ELF/PE, spectra, game/Unity/Minecraft, NFT/contract, invoice/audit, Figma/Sketch/InDesign.

### data-converters (8) — all OK

`csv-to-json-json-to-csv`, `excel-to-json`, `html-table-to-json`, `json-formatter-beautifier-validator`, `json-linter-viewer`, `json-parser`, `markdown-to-html`, `yaml-to-json-json-to-yaml`.

### math-date-utils (13) — all OK

Includes `currency-converter` (`CurrencyRateService`), `unit-converter` (history UI partial).

### pdf-tools

**OK:** `pdf-workbench`, `pdf-jspdf-workbench`, `pdf-viewer`, `pdf-fullscreen-overlay`, `merge-pdfs`, `split-pdfs`, `add-signature`.  
**Thin → edit:** delete/rotate/reorder/extract/compress/annotate/highlight/fill/flatten/metadata/watermark/base64/password-protect.  
**Thin → create:** text/html/tables/charts/resume/invoice/screenshot/barcode/qr/page-numbers/image-to-pdf (+ combo routes).

### image-color-tools (10) — all OK

`color-picker`, `drawing-pad`, `favicon-generator`, `gradient-generator`, `hex-to-rgb`, `image-compressor`, `image-resizer`, `image-to-base64`, `image-to-text`, `palette-generator`.

### code-file-tools (9) — all OK

Clipboard tools, minifiers, metadata, HTML entity/table, markdown-to-pdf.

### dev-design-tools (12) — all OK

CSS helpers + `postman-lite`, `cors-test-tool`, `websocket-client`, etc.

### testing-tools (6) / security-tools (7) / browser-utils (6) / fun-tools (11)

All OK — see `libs/<name>/src/lib/component/`.

### media-tools (5)

`voice-recorder` OK; others **Soon**.

### Newer viewer libs

| Library | Live tools |
| ------- | ---------- |
| `cad-viewers` | 29 |
| `gis-viewers` | 20 |
| `medical-viewers` | 18 |
| `science-viewers` | 20 |
| `network-viewers` | 17 |
| `process-viewers` | 15 |
| `diagram-viewers` | 29 |
| `data-explorers` | 15 |
| `ml-viewers` | 9 |

---

## Reusable helpers (duplicated per lib)

| Pattern | Count | Opportunity |
| ------- | ----- | ----------- |
| `*-clipboard.util.ts` | ~11 | Extract shared-utils |
| `*-tool-suggestion.model.ts` | ~12 | Same |
| `*-download.util.ts` | ~4 | Same |
| `*-tool-test.utils.ts` | most libs | TestBed helpers |

Path for a tool: `libs/<category>/src/lib/component/<tool>/`.
