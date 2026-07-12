# EasyToolHub (ToolsWorkspace)



**EasyToolHub** is a free, browser-based all-in-one digital toolkit deployed at [easytoolhub.com](https://easytoolhub.com). It provides 130+ client-side utilities for text manipulation, file viewing, data conversion, PDF editing, image processing, security, media, and more — all running in the browser with no install required.

This repository is an [Nx](https://nx.dev) monorepo containing one Angular web application and 14 feature libraries organized by tool category.

---



## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Build & Compile](#build--compile)
- [Testing](#testing)
- [Architecture](#architecture)
- [Tool Implementation Status](#tool-implementation-status)
- [Pending Implementation](#pending-implementation)
- [Tools Catalog (Developer Reference)](#tools-catalog-developer-reference)
- [Shared Tool Patterns](#shared-tool-patterns)
- [Adding a New Tool](#adding-a-new-tool)
- [Deployment](#deployment)
- [Additional Documentation](#additional-documentation)
- [Useful Nx Commands](#useful-nx-commands)

---



## Features

- **150 tools** catalogued across 13 categories (107 fully implemented & routed, 43 pending — see [Tool Implementation Status](#tool-implementation-status))
- **Client-side processing** — data stays in the browser
- **Lazy-loaded routes** — each tool loads on demand for fast initial page load
- **SEO optimized** — per-route metadata, sitemap generation, structured data
- **Google Analytics 4** — page views, tool usage, scroll, and error tracking
- **Internationalization** — English, Spanish, German, French (`apps/tools-site/src/assets/i18n/`)
- **SSR support** — optional server-side rendering via Express
- **Multi-platform deploy** — Vercel, Netlify, Apache, Nginx, Cloudflare Pages, VPS

---



## Tech Stack


| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| Monorepo   | Nx 21.6                            |
| Framework  | Angular 20 (standalone components) |
| Language   | TypeScript 5.9                     |
| Styling    | SCSS                               |
| SSR        | `@angular/ssr` + Express           |
| Unit tests | Jest + jest-preset-angular         |
| E2E tests  | Playwright                         |
| Linting    | ESLint 9 (flat config)             |


**Key runtime libraries:** Monaco Editor (`ngx-monaco-editor-v2`), pdf-lib, tesseract.js (OCR), signature_pad, pako (compression), rxjs

**CDN-loaded at runtime (not bundled):** pdf.js, SheetJS (XLSX), mammoth (DOCX), marked + DOMPurify, JSZip, Chart.js, qrcode, JsBarcode, jspdf

**Installed but not yet used in tool components:** `@codemirror/`*, `figlet`, `ngx-doc-viewer`, `ngx-universal-file-viewer`

---



## Prerequisites

- **Node.js** 18.x or 20.x (LTS recommended)
- **npm** 9+ (comes with Node.js)

Verify your environment:

```sh
node -v
npm -v
```

---



## Project Structure

```
tools-workspace/
├── apps/
│   ├── tools-site/              # Main Angular web application
│   │   ├── src/
│   │   │   ├── app/             # App shell, routes, SEO, analytics
│   │   │   ├── assets/i18n/     # Translation files (en, es, de, fr)
│   │   │   ├── main.ts          # Browser bootstrap
│   │   │   ├── main.server.ts   # SSR bootstrap
│   │   │   └── server.ts        # Express SSR server
│   │   ├── public/              # Static files (sitemap, robots.txt, deploy configs)
│   │   └── scripts/             # Sitemap generator
│   └── tools-site-e2e/          # Playwright end-to-end tests
│
├── libs/                        # Feature libraries (one per tool category)
│   ├── features-home/           # Home page, navigation, footer, toasts, shared services
│   ├── text-utilities/          # Text & encoding tools (30 tools — 9 routed, 21 awaiting routes)
│   ├── file-viewers/            # File preview tools (13 tools)
│   ├── data-converters/         # JSON/CSV/YAML converters (8 tools)
│   ├── math-date-utils/         # Calculators & date tools (13 tools)
│   ├── pdf-tools/               # PDF manipulation (22 tools — 4 implemented, 18 stubs)
│   ├── image-color-tools/       # Image & color tools (10 tools)
│   ├── code-file-tools/         # Code minifiers & file tools (9 tools)
│   ├── dev-design-tools/        # CSS generators, HTTP tools (11 tools)
│   ├── testing-tools/           # Validators, JWT decoder (6 tools)
│   ├── security-tools/          # Hash, UUID, encryption (7 tools)
│   ├── media-tools/             # Audio/video/webcam (5 tools — 1 implemented, 4 stubs)
│   ├── browser-utils/           # Browser diagnostics (6 tools)
│   └── fun-tools/               # QR codes, timers, productivity (11 tools)
│
├── dist/                        # Build output (generated, not committed)
├── nx.json                      # Nx workspace configuration
├── tsconfig.base.json           # TypeScript path aliases (@tools-workspace/*)
├── package.json                 # Workspace dependencies
└── eslint.config.mjs            # ESLint configuration
```



### Path Aliases

Libraries are imported using TypeScript path aliases defined in `tsconfig.base.json`:

```typescript
import { Navigation, ToastService } from '@tools-workspace/features-home';
import { WordsAndCharacterCounterComponent } from '@tools-workspace/text-utilities';
```

---



## Getting Started



### 1. Clone and install dependencies

```sh
git clone <repository-url>
cd tools-workspace
npm install
```



### 2. Start the development server

```sh
npx nx serve tools-site
```

Open [http://localhost:4200](http://localhost:4200) in your browser. The app hot-reloads when you change source files.

---



## Development



### Dev server

```sh
# Default development build (faster compile, source maps)
npx nx serve tools-site

# Serve with production build settings
npx nx serve tools-site --configuration=production
```



### SSR development server

```sh
npx nx serve-ssr tools-site
```

Runs both the browser and Express server bundles with live reload.

### Lint

```sh
# Lint the main app
npx nx lint tools-site

# Lint a specific library
npx nx lint text-utilities
```



### Dependency graph

Visualize how projects depend on each other:

```sh
npx nx graph
```

---



## Build & Compile

All build commands run from the **workspace root** (`tools-workspace/`).

### Production build (recommended for deployment)

```sh
npx nx build tools-site --configuration=production
```

This command:

1. Runs `generate-sitemap` to create `sitemap.xml` from application routes
2. Compiles the Angular app with optimizations (tree-shaking, minification, output hashing)
3. Copies static assets (Monaco Editor, sitemap, robots.txt)

**Output directory:**

```
dist/apps/tools-site/    ← Deploy this folder (static SPA)
```

Wait until the terminal shows `Successfully ran target build` (~2 minutes after sitemap generation).

### Development build (faster, for local testing)

```sh
npx nx build tools-site
# or explicitly:
npx nx build tools-site --configuration=development
```

Development builds skip optimization for faster compile times. The default configuration is `development`.

### Serve the built app locally

After building, preview the production output:

```sh
npx nx serve-static tools-site
```

Opens [http://localhost:4200](http://localhost:4200) serving files from `dist/apps/tools-site/`.

### SSR server build

Build the Express server bundle for server-side rendering:

```sh
# Build browser + server
npx nx build tools-site --configuration=production
npx nx server tools-site --configuration=production
```

**Output:**

```
dist/apps/tools-site/server/     ← Express server bundle
```

Run the SSR server:

```sh
node dist/apps/tools-site/server/server.mjs
```

The server listens on port `4000` by default (override with the `PORT` environment variable).

### Prerender

Pre-render static HTML for specific routes:

```sh
npx nx prerender tools-site --configuration=production
```



### Build a single library

```sh
npx nx build text-utilities
npx nx build features-home
```

Libraries are typically consumed by the app via path aliases and do not need a separate build for deployment.

### Generate sitemap only

```sh
npx nx run tools-site:generate-sitemap
```

Regenerates `apps/tools-site/public/sitemap.xml` from routes defined in `app.routes.ts`.

### Build output summary


| Target            | Command                                              | Output                               |
| ----------------- | ---------------------------------------------------- | ------------------------------------ |
| SPA (production)  | `npx nx build tools-site --configuration=production` | `dist/apps/tools-site/`              |
| SPA (development) | `npx nx build tools-site`                            | `dist/apps/tools-site/`              |
| SSR server        | `npx nx server tools-site`                           | `dist/apps/tools-site/server/`       |
| Sitemap           | `npx nx run tools-site:generate-sitemap`             | `apps/tools-site/public/sitemap.xml` |




### Compilation notes

- Production builds can take several minutes due to the large codebase and Monaco Editor assets (~50 MB copied to output).
- The default build configuration is `development` for faster local builds. Always pass `--configuration=production` before deploying.
- See `COMPILATION_OPTIMIZATION.md` for performance tuning tips.

---



## Testing



### Unit tests (Jest)

```sh
# Test the main app
npx nx test tools-site

# Test a specific library
npx nx test text-utilities
npx nx test pdf-tools

# Run all tests
npx nx run-many -t test
```



### End-to-end tests (Playwright)

```sh
npx nx e2e tools-site-e2e
```

Playwright starts the dev server automatically. Override the base URL with the `BASE_URL` environment variable if needed.

---



## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  apps/tools-site (App Shell)                            │
│  Routing · SEO · Google Analytics · Theme · Hydration   │
└──────────────────────────┬──────────────────────────────┘
                           │ lazy loadComponent()
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  features-home      text-utilities     pdf-tools  … (12 more)
  (home + shared UI)
         ▲
         │ imports Navigation, ToastService, AssetService
         └────────────── all tool libraries ──────────────
```



### Key files


| File                                                           | Purpose                                      |
| -------------------------------------------------------------- | -------------------------------------------- |
| `apps/tools-site/src/main.ts`                                  | Browser entry point                          |
| `apps/tools-site/src/app/app.ts`                               | Root shell (footer, toasts, GA, SEO)         |
| `apps/tools-site/src/app/app.routes.ts`                        | Central route table (~132 lazy-loaded tools) |
| `apps/tools-site/src/app/config/route-seo.config.ts`           | Per-route SEO metadata                       |
| `apps/tools-site/src/app/services/google-analytics.service.ts` | GA4 tracking                                 |
| `libs/features-home/src/lib/component/myComponent/`            | Home page tool catalog                       |
| `libs/features-home/src/lib/component/navigation/`             | Shared navigation bar                        |
| `libs/<category>/src/lib/component/<tool>/`                    | Individual tool components                   |




### Tool component pattern

Each tool is a **standalone Angular component**:

1. Lives in `libs/<category>/src/lib/component/<tool-name>/`
2. Imports `Navigation` and `ToastService` from `@tools-workspace/features-home`
3. Exported from the library's `src/index.ts`
4. Registered in `apps/tools-site/src/app/app.routes.ts` with `loadComponent`
5. Listed in `toolCategories` inside `my-component.ts` for the home page catalog

---



## Tool Implementation Status

As of the latest codebase audit:


| Metric                                                      | Count   |
| ----------------------------------------------------------- | ------- |
| Tools in homepage catalog                                   | 150     |
| Lazy-loaded routes in `app.routes.ts`                       | 129     |
| **Implemented & routed** (working logic)                    | **107** |
| **Routed stubs** (UI shell, no processing)                  | **23**  |
| **Implemented but not routed** (component exists, no route) | **21**  |


**Status legend**


| Status          | Meaning                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| **Implemented** | Real client-side logic; users can complete the tool workflow                       |
| **Stub**        | Route + component exist; shows planned features / upload UI but no processing      |
| **Not routed**  | Component is built and exported from its library, but missing from `app.routes.ts` |


**Route prefixes**


| Library             | Prefix               | Tools in catalog |
| ------------------- | -------------------- | ---------------- |
| `text-utilities`    | `/text-utilities`    | 30               |
| `file-viewers`      | `/file-viewers`      | 13               |
| `data-converters`   | `/data-converters`   | 8                |
| `math-date-utils`   | `/math-date-utils`   | 13               |
| `pdf-tools`         | `/pdf-tools`         | 22               |
| `image-color-tools` | `/image-color-tools` | 10               |
| `code-file-tools`   | `/code-file-tools`   | 9                |
| `dev-design-tools`  | `/dev-design-tools`  | 11               |
| `testing-tools`     | `/testing-tools`     | 6                |
| `security-tools`    | `/security-tools`    | 7                |
| `media-tools`       | `/media-tools`       | 5                |
| `browser-utils`     | `/browser-utils`     | 6                |
| `fun-tools`         | `/fun-tools`         | 11               |


---



## Pending Implementation



### 1. Routed stubs — need full logic (23 tools)

These appear in navigation and routes but only render a **planned-features shell** (`readonly title`, `features`, `helpItems` arrays; no file processing).

#### PDF Tools (18) — `libs/pdf-tools/src/lib/component/`


| Tool                       | Route                                 | Suggested libraries              |
| -------------------------- | ------------------------------------- | -------------------------------- |
| Delete PDF Pages           | `/pdf-tools/delete-pages`             | `pdf-lib`, pdf.js                |
| Rotate PDF Pages           | `/pdf-tools/rotate-pages`             | `pdf-lib`                        |
| Reorder PDF Pages          | `/pdf-tools/reorder-pages`            | `pdf-lib`                        |
| Extract PDF Pages          | `/pdf-tools/extract-pages`            | `pdf-lib`                        |
| Compress PDF               | `/pdf-tools/compress-pdf`             | `pdf-lib`                        |
| Create PDF from HTML       | `/pdf-tools/create-pdf-from-html`     | jspdf (CDN) or `pdf-lib`         |
| Tables & Charts to PDF     | `/pdf-tools/tables-charts-to-pdf`     | jspdf + Chart.js                 |
| Resume & Invoice Generator | `/pdf-tools/resume-invoice-generator` | jspdf or `pdf-lib`               |
| Text to PDF                | `/pdf-tools/text-to-pdf`              | jspdf or `pdf-lib`               |
| Screenshot to PDF          | `/pdf-tools/screenshot-to-pdf`        | `pdf-lib`                        |
| Annotate PDF               | `/pdf-tools/annotate-pdf`             | `pdf-lib`, pdf.js canvas overlay |
| Highlight Text             | `/pdf-tools/highlight-text`           | `pdf-lib`                        |
| Fill PDF Forms             | `/pdf-tools/fill-pdf-forms`           | `pdf-lib`                        |
| PDF Metadata Editor        | `/pdf-tools/pdf-metadata-editor`      | `pdf-lib`                        |
| Add Watermark              | `/pdf-tools/add-watermark`            | `pdf-lib`                        |
| PDF to Base64              | `/pdf-tools/pdf-to-base64`            | Native `FileReader`              |
| Password Protect PDF       | `/pdf-tools/password-protect-pdf`     | `pdf-lib` (encryption)           |
| Flatten PDF Forms          | `/pdf-tools/flatten-pdf-forms`        | `pdf-lib`                        |


**Reference implementations** (copy patterns from): `merge-pdfs`, `split-pdfs`, `add-signature`, `pdf-viewer`.

#### Media Tools (4) — `libs/media-tools/sdeplorc/lib/component/`


| Tool                   | Route                          | Suggested approach                                                             |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Audio Player           | `/media-tools/audio-player`    | Web Audio API + canvas waveform (see implemented `/file-viewers/audio-player`) |
| Audio Trimmer          | `/media-tools/audio-trimmer`   | Web Audio API / OfflineAudioContext                                            |
| Video to GIF Converter | `/media-tools/video-to-gif`    | Canvas frame capture + gif encoder library                                     |
| Webcam Snapshot        | `/media-tools/webcam-snapshot` | `getUserMedia` + canvas export                                                 |




#### File Viewers (1)


| Tool            | Route                           | Suggested approach                     |
| --------------- | ------------------------------- | -------------------------------------- |
| 3D Model Viewer | `/file-viewers/3d-model-viewer` | three.js or model-viewer web component |




### 2. Implemented but not routed — need `app.routes.ts` entries (21 tools)

Components exist under `libs/text-utilities/`, are listed in `TEXT_UTILITIES_CATALOG`, and appear on the homepage — but **have no lazy route**. Wire each path in `app.routes.ts` and add SEO in `route-seo.config.ts`.


| #   | Tool                          | Catalog path                                  | Component folder              |
| --- | ----------------------------- | --------------------------------------------- | ----------------------------- |
| 1   | URL Encode & Decode           | `text-utilities/url-encode-and-decode`        | `urlEncodeAndDecode/`         |
| 2   | Unicode Escape & Unescape     | `text-utilities/unicode-escape-unescape`      | `unicodeEscapeUnescape/`      |
| 3   | HTML Tag Stripper             | `text-utilities/html-tag-stripper`            | `htmlTagStripper/`            |
| 4   | Sort Lines                    | `text-utilities/sort-lines`                   | `sortLines/`                  |
| 5   | Trim & Normalize Whitespace   | `text-utilities/trim-normalize-whitespace`    | `trimNormalizeWhitespace/`    |
| 6   | Find & Replace                | `text-utilities/find-and-replace`             | `findAndReplace/`             |
| 7   | Line Number Tool              | `text-utilities/line-number-tool`             | `lineNumberTool/`             |
| 8   | Split & Join Text             | `text-utilities/split-join-text`              | `splitJoinText/`              |
| 9   | Regex Tester                  | `text-utilities/regex-tester`                 | `regexTester/`                |
| 10  | Text Similarity Checker       | `text-utilities/text-similarity`              | `textSimilarity/`             |
| 11  | Invisible Character Detector  | `text-utilities/invisible-character-detector` | `invisibleCharacterDetector/` |
| 12  | Word Wrap & Unwrap            | `text-utilities/word-wrap-unwrap`             | `wordWrapUnwrap/`             |
| 13  | Extract Emails & URLs         | `text-utilities/extract-emails-urls`          | `extractEmailsUrls/`          |
| 14  | JSON String Escape & Unescape | `text-utilities/json-string-escape-unescape`  | `jsonStringEscapeUnescape/`   |
| 15  | HEX Encode & Decode           | `text-utilities/hex-encode-decode`            | `hexEncodeDecode/`            |
| 16  | ROT13 & Caesar Cipher         | `text-utilities/rot13-cipher`                 | `rot13Cipher/`                |
| 17  | Binary Text Converter         | `text-utilities/binary-text-converter`        | `binaryTextConverter/`        |
| 18  | Morse Code Converter          | `text-utilities/morse-code-converter`         | `morseCodeConverter/`         |
| 19  | Readability Analyzer          | `text-utilities/readability-analyzer`         | `readabilityAnalyzer/`        |
| 20  | Keyword Density Checker       | `text-utilities/keyword-density`              | `keywordDensity/`             |
| 21  | Pako Compress & Decompress    | `text-utilities/pako-encode-and-decode`       | `pakoEncodeAndDecode/`        |


**Quick fix:** add lazy `loadComponent` entries under the `text-utilities` children in `app.routes.ts`, then run `npx nx run tools-site:generate-sitemap`.

---



## Tools Catalog (Developer Reference)

Each tool is a standalone Angular component at `libs/<category>/src/lib/component/<tool-name>/`. All routes are lazy-loaded from `apps/tools-site/src/app/app.routes.ts`.

**Common UI imports:** `Navigation`, `AssetService`, `ToastService`, `TooltipDirective` from `@tools-workspace/features-home`.

### Text & Utilities (`libs/text-utilities`)

**Shared pattern:** Most tools use dual-pane **textarea** editors with a toolbar (Upload, Copy, Undo, Redo, Clear, Download TXT). Many extend or mirror `TextToolBase` (`libs/text-utilities/src/lib/shared/text-tool-base.ts`) for undo/redo, file upload (10 MB max), drag-and-drop, and keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y).


| Tool                              | Route                                                  | Status      | Editor          | Libraries               | Purpose & usage                                                                                                                 |
| --------------------------------- | ------------------------------------------------------ | ----------- | --------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Word & Character Counter          | `/text-utilities/character-counter`                    | Implemented | textarea        | jspdf (CDN, PDF export) | Paste or upload text; live stats (chars, words, sentences, reading time). Tabs for word frequency, readability. Export TXT/PDF. |
| Text Case Converter               | `/text-utilities/text-case-convertor`                  | Implemented | textarea        | —                       | Paste text; pick case mode (upper, lower, title, camel, snake, etc.); copy result.                                              |
| Text to ASCII Converter           | `/text-utilities/text-to-ascii`                        | Implemented | textarea        | —                       | Convert characters to decimal/hex ASCII codes and back.                                                                         |
| Remove Duplicate Lines            | `/text-utilities/remove-duplicate-lines`               | Implemented | textarea        | —                       | Paste lines; remove exact or case-insensitive duplicates; preserve order option.                                                |
| Reverse Text & Palindrome Checker | `/text-utilities/text-reversal-and-palindrome-checker` | Implemented | textarea        | —                       | Reverse string or check palindrome (ignoring spaces/punctuation).                                                               |
| Base64 Encode & Decode            | `/text-utilities/base64-encode-and-decode`             | Implemented | textarea        | —                       | Toggle encode/decode; supports text files via upload.                                                                           |
| Slug Generator                    | `/text-utilities/slug-generator`                       | Implemented | textarea        | —                       | Type a title; get URL-safe slug with separator and lowercase options.                                                           |
| Text Difference Checker           | `/text-utilities/text-difference`                      | Implemented | **Monaco diff** | `ngx-monaco-editor-v2`  | Paste original and modified text; side-by-side diff with syntax highlighting.                                                   |
| Code Merge                        | `/text-utilities/code-merge`                           | Implemented | dual textarea   | —                       | Paste two code blocks; merge with conflict markers or choose left/right.                                                        |
| URL Encode & Decode               | —                                                      | Not routed  | textarea        | —                       | Percent-encode/decode URLs and query strings.                                                                                   |
| Unicode Escape & Unescape         | —                                                      | Not routed  | textarea        | —                       | `\uXXXX` escape sequences for debugging.                                                                                        |
| HTML Tag Stripper                 | —                                                      | Not routed  | textarea        | —                       | Strip HTML tags to plain text.                                                                                                  |
| Sort Lines                        | —                                                      | Not routed  | textarea        | —                       | Sort A–Z, by length, or numerically.                                                                                            |
| Trim & Normalize Whitespace       | —                                                      | Not routed  | textarea        | —                       | Trim lines, collapse spaces, remove blank lines.                                                                                |
| Find & Replace                    | —                                                      | Not routed  | textarea        | —                       | Plain or regex find/replace with flags.                                                                                         |
| Line Number Tool                  | —                                                      | Not routed  | textarea        | —                       | Add or strip line numbers.                                                                                                      |
| Split & Join Text                 | —                                                      | Not routed  | textarea        | —                       | Split by delimiter or join with separator.                                                                                      |
| Regex Tester                      | —                                                      | Not routed  | textarea        | —                       | Test regex against sample text; highlight matches.                                                                              |
| Text Similarity Checker           | —                                                      | Not routed  | textarea        | —                       | Levenshtein distance and similarity %.                                                                                          |
| Invisible Character Detector      | —                                                      | Not routed  | textarea        | —                       | Reveal zero-width and hidden Unicode chars.                                                                                     |
| Word Wrap & Unwrap                | —                                                      | Not routed  | textarea        | —                       | Wrap at column width or unwrap hard breaks.                                                                                     |
| Extract Emails & URLs             | —                                                      | Not routed  | textarea        | —                       | Pull emails and links from blob text.                                                                                           |
| JSON String Escape & Unescape     | —                                                      | Not routed  | textarea        | —                       | Escape strings for JSON embedding.                                                                                              |
| HEX Encode & Decode               | —                                                      | Not routed  | textarea        | —                       | Text ↔ hexadecimal.                                                                                                             |
| ROT13 & Caesar Cipher             | —                                                      | Not routed  | textarea        | —                       | ROT13 or custom Caesar shift.                                                                                                   |
| Binary Text Converter             | —                                                      | Not routed  | textarea        | —                       | Text ↔ binary strings.                                                                                                          |
| Morse Code Converter              | —                                                      | Not routed  | textarea        | —                       | Text ↔ Morse code.                                                                                                              |
| Readability Analyzer              | —                                                      | Not routed  | textarea        | —                       | Flesch Reading Ease and grade level.                                                                                            |
| Keyword Density Checker           | —                                                      | Not routed  | textarea        | —                       | Word frequency and SEO density.                                                                                                 |
| Pako Compress & Decompress        | —                                                      | Not routed  | textarea        | `pako`                  | zlib / deflate / gzip compress and decompress.                                                                                  |


**Catalog source of truth:** `libs/features-home/src/lib/config/text-utilities-catalog.ts`

### File Viewers (`libs/file-viewers`)

**Shared pattern:** Upload or drag-and-drop a file; preview in-browser. No server upload — `FileReader` / object URLs only.


| Tool                       | Route                              | Status      | Editor / viewer      | Libraries                | Purpose & usage                                                            |
| -------------------------- | ---------------------------------- | ----------- | -------------------- | ------------------------ | -------------------------------------------------------------------------- |
| Image Viewer               | `/file-viewers/image-viewer`       | Implemented | canvas + zoom        | —                        | Upload images (PNG, JPEG, GIF, BMP, SVG, WEBP); zoom, pan, browse gallery. |
| PDF Viewer                 | `/file-viewers/pdf-viewer`         | Implemented | pdf.js canvas        | pdf.js (CDN)             | Upload PDF; paginate, zoom, search text, dark theme.                       |
| Word Document Viewer       | `/file-viewers/word-viewer`        | Implemented | rendered HTML        | mammoth (CDN)            | Upload DOC/DOCX; convert to HTML for preview.                              |
| PowerPoint Viewer          | `/file-viewers/powerpoint-viewer`  | Implemented | slide render         | JSZip (CDN)              | Upload PPT/PPTX; browse slides.                                            |
| Text File Viewer           | `/file-viewers/text-file-viewer`   | Implemented | textarea + highlight | —                        | View TXT, LOG, MD, JSON, XML, YAML with syntax coloring.                   |
| Markdown Previewer         | `/file-viewers/markdown-previewer` | Implemented | split source/preview | marked + DOMPurify (CDN) | Upload or paste MD; live rendered preview.                                 |
| Excel Viewer               | `/file-viewers/excel-viewer`       | Implemented | data grid            | SheetJS/XLSX (CDN)       | Upload XLS/XLSX/CSV; interactive table.                                    |
| Log File Viewer & Analyzer | `/file-viewers/log-viewer`         | Implemented | log table + chart    | Chart.js (CDN), `rxjs`   | Upload logs; filter, search, level stats chart.                            |
| Audio Player               | `/file-viewers/audio-player`       | Implemented | waveform canvas      | —                        | Play MP3/WAV/OGG/FLAC with waveform scrubber.                              |
| Video Player               | `/file-viewers/video-player`       | Implemented | `<video>`            | —                        | Play MP4/WEBM/OGV with native controls.                                    |
| Font File Previewer        | `/file-viewers/font-viewer`        | Implemented | font preview panel   | —                        | Upload TTF/OTF/WOFF; preview sample text.                                  |
| 3D Model Viewer            | `/file-viewers/3d-model-viewer`    | **Stub**    | none                 | —                        | Planned: GLTF, OBJ, STL, FBX interactive viewer.                           |
| Archive Viewer             | `/file-viewers/archive-viewer`     | Implemented | file tree            | JSZip (CDN)              | Open ZIP/TAR/GZ; browse and preview contents.                              |




### JSON / Data Converters (`libs/data-converters`)

**Shared pattern:** Dual textarea or upload → JSON output. Toolbar: validate, format, copy, clear.


| Tool                       | Route                                                  | Status      | Editor          | Libraries          | Purpose & usage                                 |
| -------------------------- | ------------------------------------------------------ | ----------- | --------------- | ------------------ | ----------------------------------------------- |
| JSON Formatter & Validator | `/data-converters/json-formatter-beautifier-validator` | Implemented | textarea        | —                  | Paste JSON; beautify, minify, validate syntax.  |
| CSV ↔ JSON Converter       | `/data-converters/csv-to-json-json-to-csv`             | Implemented | dual textarea   | —                  | Convert CSV ↔ JSON with header row option.      |
| YAML ↔ JSON Converter      | `/data-converters/yaml-to-json-json-to-yaml`           | Implemented | dual textarea   | custom YAML parser | Bidirectional YAML/JSON with indentation.       |
| HTML Table to JSON         | `/data-converters/html-table-to-json`                  | Implemented | textarea        | —                  | Paste `<table>` HTML; export JSON array.        |
| Markdown to HTML           | `/data-converters/markdown-to-html`                    | Implemented | dual textarea   | custom MD parser   | Convert MD source to HTML output.               |
| JSON Linter & Viewer       | `/data-converters/json-linter-viewer`                  | Implemented | textarea + tree | —                  | Lint JSON; collapsible tree explorer.           |
| Excel to JSON              | `/data-converters/excel-to-json`                       | Implemented | file upload     | SheetJS (CDN)      | Upload spreadsheet; download JSON.              |
| JSON Parser                | `/data-converters/json-parser`                         | Implemented | textarea        | —                  | Parse JSON; inspect resulting object structure. |




### Number & Date Tools (`libs/math-date-utils`)

**Shared pattern:** Form inputs + Calculate button (`ctl__` layout). Results panel with copy. Uses `rxjs` for reactive form state.


| Tool                       | Route                                                  | Status      | Editor      | Libraries | Purpose & usage                                   |
| -------------------------- | ------------------------------------------------------ | ----------- | ----------- | --------- | ------------------------------------------------- |
| Unit Converter             | `/math-date-utils/unit-converter`                      | Implemented | forms       | `rxjs`    | Convert length, weight, temperature, volume, etc. |
| Number to Words            | `/math-date-utils/number-to-words`                     | Implemented | input       | `rxjs`    | Spell numbers in English (cheques, invoices).     |
| Percentage Calculator      | `/math-date-utils/percentage-calculator`               | Implemented | forms       | `rxjs`    | % of, increase, decrease, difference.             |
| Age Calculator             | `/math-date-utils/age-calculator`                      | Implemented | date inputs | `rxjs`    | Exact age from birth date.                        |
| Date Difference Calculator | `/math-date-utils/date-difference-calculator`          | Implemented | date inputs | `rxjs`    | Days/months/years between two dates.              |
| Interest Calculator        | `/math-date-utils/simple-compound-interest-calculator` | Implemented | forms       | `rxjs`    | Simple vs compound interest projections.          |
| BMI Calculator             | `/math-date-utils/bmi-calculator`                      | Implemented | forms       | `rxjs`    | BMI from height/weight (metric/imperial).         |
| Loan EMI Calculator        | `/math-date-utils/loan-emi-calculator`                 | Implemented | forms       | `rxjs`    | Monthly EMI and amortization table.               |
| Tip Calculator             | `/math-date-utils/tip-calculator`                      | Implemented | forms       | `rxjs`    | Split bill with tip and party size.               |
| Currency Converter         | `/math-date-utils/currency-converter`                  | Implemented | forms       | `rxjs`    | Convert currencies (mid-market rates).            |
| Fraction Calculator        | `/math-date-utils/fraction-calculator`                 | Implemented | forms       | `rxjs`    | Add/subtract/multiply/simplify fractions.         |
| Date to Day of Week        | `/math-date-utils/date-to-day-of-week`                 | Implemented | date input  | `rxjs`    | Weekday name for any date.                        |
| Zodiac Finder              | `/math-date-utils/zodiac-finder`                       | Implemented | date input  | `rxjs`    | Sun sign from birth date.                         |




### PDF Tools (`libs/pdf-tools`)

**Shared pattern (implemented):** Upload PDF via drag-and-drop; pdf.js renders page previews; `pdf-lib` manipulates bytes client-side.


| Tool                       | Route                                 | Status      | Editor                 | Libraries                          | Purpose & usage                                    |
| -------------------------- | ------------------------------------- | ----------- | ---------------------- | ---------------------------------- | -------------------------------------------------- |
| PDF Viewer                 | `/pdf-tools/pdf-viewer`               | Implemented | pdf.js canvas          | pdf.js (CDN)                       | Full PDF reader with search and zoom.              |
| Merge PDFs                 | `/pdf-tools/merge-pdfs`               | Implemented | canvas preview         | `pdf-lib`, pdf.js                  | Upload multiple PDFs; reorder; merge and download. |
| Split PDFs                 | `/pdf-tools/split-pdfs`               | Implemented | canvas preview         | `pdf-lib`, pdf.js, JSZip           | Split by page range or individual pages.           |
| Add Signature              | `/pdf-tools/add-signature`            | Implemented | canvas + signature pad | `pdf-lib`, `signature_pad`, pdf.js | Draw or upload signature; place on PDF pages.      |
| Delete PDF Pages           | `/pdf-tools/delete-pages`             | **Stub**    | —                      | —                                  | *Planned*                                          |
| Rotate PDF Pages           | `/pdf-tools/rotate-pages`             | **Stub**    | —                      | —                                  | *Planned*                                          |
| Reorder PDF Pages          | `/pdf-tools/reorder-pages`            | **Stub**    | —                      | —                                  | *Planned*                                          |
| Extract PDF Pages          | `/pdf-tools/extract-pages`            | **Stub**    | —                      | —                                  | *Planned*                                          |
| Compress PDF               | `/pdf-tools/compress-pdf`             | **Stub**    | —                      | —                                  | *Planned*                                          |
| Create PDF from HTML       | `/pdf-tools/create-pdf-from-html`     | **Stub**    | —                      | —                                  | *Planned*                                          |
| Tables & Charts to PDF     | `/pdf-tools/tables-charts-to-pdf`     | **Stub**    | —                      | —                                  | *Planned*                                          |
| Resume & Invoice Generator | `/pdf-tools/resume-invoice-generator` | **Stub**    | —                      | —                                  | *Planned*                                          |
| Text to PDF                | `/pdf-tools/text-to-pdf`              | **Stub**    | —                      | —                                  | *Planned*                                          |
| Screenshot to PDF          | `/pdf-tools/screenshot-to-pdf`        | **Stub**    | —                      | —                                  | *Planned*                                          |
| Annotate PDF               | `/pdf-tools/annotate-pdf`             | **Stub**    | —                      | —                                  | *Planned*                                          |
| Highlight Text             | `/pdf-tools/highlight-text`           | **Stub**    | —                      | —                                  | *Planned*                                          |
| Fill PDF Forms             | `/pdf-tools/fill-pdf-forms`           | **Stub**    | —                      | —                                  | *Planned*                                          |
| PDF Metadata Editor        | `/pdf-tools/pdf-metadata-editor`      | **Stub**    | —                      | —                                  | *Planned*                                          |
| Add Watermark              | `/pdf-tools/add-watermark`            | **Stub**    | —                      | —                                  | *Planned*                                          |
| PDF to Base64              | `/pdf-tools/pdf-to-base64`            | **Stub**    | —                      | —                                  | *Planned*                                          |
| Password Protect PDF       | `/pdf-tools/password-protect-pdf`     | **Stub**    | —                      | —                                  | *Planned*                                          |
| Flatten PDF Forms          | `/pdf-tools/flatten-pdf-forms`        | **Stub**    | —                      | —                                  | *Planned*                                          |




### Image & Color Tools (`libs/image-color-tools`)


| Tool                 | Route                                   | Status      | Editor            | Libraries      | Purpose & usage                                   |
| -------------------- | --------------------------------------- | ----------- | ----------------- | -------------- | ------------------------------------------------- |
| Image to Base64      | `/image-color-tools/image-to-base64`    | Implemented | file upload       | —              | Upload image; get Base64 data URI.                |
| Image Resizer        | `/image-color-tools/image-resizer`      | Implemented | canvas            | —              | Resize by pixels or %; download result.           |
| Image Compressor     | `/image-color-tools/image-compressor`   | Implemented | canvas            | —              | JPEG/WebP quality slider; before/after size.      |
| Color Picker         | `/image-color-tools/color-picker`       | Implemented | canvas + swatches | `rxjs`         | Pick from image, palette, or upload; hex/RGB/HSL. |
| HEX to RGB Converter | `/image-color-tools/hex-to-rgb`         | Implemented | forms             | `rxjs`         | Convert hex ↔ RGB ↔ HSL.                          |
| Gradient Generator   | `/image-color-tools/gradient-generator` | Implemented | custom UI         | `rxjs`         | Build CSS linear/radial gradients; copy CSS.      |
| Palette Generator    | `/image-color-tools/palette-generator`  | Implemented | custom UI         | —              | Generate palettes from image or base color.       |
| Image to Text (OCR)  | `/image-color-tools/image-to-text`      | Implemented | file upload       | `tesseract.js` | On-device OCR; extract editable text.             |
| Favicon Generator    | `/image-color-tools/favicon-generator`  | Implemented | canvas            | `rxjs`         | Generate multi-size favicon set + manifest.       |
| Drawing Pad          | `/image-color-tools/drawing-pad`        | Implemented | canvas            | —              | Freehand draw; export PNG.                        |




### File & Code Tools (`libs/code-file-tools`)


| Tool                 | Route                                   | Status      | Editor     | Libraries     | Purpose & usage                              |
| -------------------- | --------------------------------------- | ----------- | ---------- | ------------- | -------------------------------------------- |
| HTML Minifier        | `/code-file-tools/html-minifier`        | Implemented | textarea   | —             | Minify HTML; strip comments/whitespace.      |
| CSS Minifier         | `/code-file-tools/css-minifier`         | Implemented | textarea   | —             | Compress CSS for production.                 |
| JavaScript Minifier  | `/code-file-tools/javascript-minifier`  | Implemented | textarea   | —             | Minify JS (basic whitespace removal).        |
| HTML Entity Encoder  | `/code-file-tools/html-entity-encoder`  | Implemented | textarea   | —             | Encode/decode `&`, `<`, etc.                 |
| Clipboard Viewer     | `/code-file-tools/clipboard-viewer`     | Implemented | textarea   | Clipboard API | Read current clipboard text/formats.         |
| Clipboard History    | `/code-file-tools/clipboard-history`    | Implemented | list UI    | —             | Store and recall clipboard snippets locally. |
| File Metadata Viewer | `/code-file-tools/file-metadata-viewer` | Implemented | info panel | —             | EXIF and file system metadata from uploads.  |
| Markdown to PDF      | `/code-file-tools/markdown-to-pdf`      | Implemented | textarea   | jspdf (CDN)   | Paste MD; export styled PDF.                 |
| HTML Table Exporter  | `/code-file-tools/html-table-exporter`  | Implemented | textarea   | —             | Paste HTML table; export CSV/JSON.           |




### Design & Web Dev Tools (`libs/dev-design-tools`)


| Tool                         | Route                                            | Status      | Editor              | Libraries       | Purpose & usage                        |
| ---------------------------- | ------------------------------------------------ | ----------- | ------------------- | --------------- | -------------------------------------- |
| CSS Gradient Generator       | `/dev-design-tools/css-gradient-generator`       | Implemented | custom UI           | `rxjs`          | Visual gradient builder; copy CSS.     |
| Box Shadow Generator         | `/dev-design-tools/box-shadow-generator`         | Implemented | custom UI           | `rxjs`          | Multi-layer box-shadow CSS generator.  |
| Border Radius Preview        | `/dev-design-tools/border-radius-preview`        | Implemented | custom UI           | `rxjs`          | Complex `border-radius` live preview.  |
| Pixel to REM Converter       | `/dev-design-tools/pixel-to-rem`                 | Implemented | forms               | `rxjs`          | px → rem/em at custom root font size.  |
| Responsive Breakpoint Tester | `/dev-design-tools/responsive-breakpoint-tester` | Implemented | iframe preview      | `rxjs`          | Side-by-side breakpoint previews.      |
| Viewport Size Detector       | `/dev-design-tools/viewport-size-detector`       | Implemented | readout panel       | `rxjs`          | Live viewport, DPR, orientation info.  |
| Postman Lite                 | `/dev-design-tools/postman-lite`                 | Implemented | textarea (body)     | `rxjs`, `fetch` | Send HTTP requests; inspect responses. |
| CORS Test Tool               | `/dev-design-tools/cors-test-tool`               | Implemented | forms               | `rxjs`, `fetch` | Probe CORS headers on any URL.         |
| HTTP Header Decoder          | `/dev-design-tools/http-header-decoder`          | Implemented | textarea            | `rxjs`          | Parse raw HTTP headers into fields.    |
| WebSocket Client             | `/dev-design-tools/websocket-client`             | Implemented | textarea (messages) | WebSocket API   | Connect, send, log WS messages.        |
| HTTP Request Generator       | `/dev-design-tools/http-request-generator`       | Implemented | forms               | `rxjs`          | Generate fetch/cURL code snippets.     |
| Mock JSON Generator          | `/dev-design-tools/mock-json-generator`          | Implemented | forms + output      | `rxjs`          | Template-based fake JSON data.         |




### Validation & Testing Tools (`libs/testing-tools`)


| Tool                    | Route                                    | Status      | Editor        | Libraries        | Purpose & usage                        |
| ----------------------- | ---------------------------------------- | ----------- | ------------- | ---------------- | -------------------------------------- |
| JSON Schema Validator   | `/testing-tools/json-schema-validator`   | Implemented | dual textarea | custom validator | Validate JSON instance against schema. |
| Password Rule Validator | `/testing-tools/password-rule-validator` | Implemented | input         | —                | Check password against custom rules.   |
| Email, URL & IP Checker | `/testing-tools/email-url-ip-checker`    | Implemented | textarea      | —                | Validate email, URL, IPv4/IPv6 format. |
| User-Agent Parser       | `/testing-tools/user-agent-parser`       | Implemented | textarea      | custom parser    | Decode UA string to browser/OS/device. |
| Credit Card Validator   | `/testing-tools/credit-card-validator`   | Implemented | input         | Luhn algorithm   | Validate card number and detect brand. |
| JWT Decoder             | `/testing-tools/jwt-decoder`             | Implemented | textarea      | base64 decode    | Decode JWT header/payload (no verify). |




### Security & Crypto Tools (`libs/security-tools`)

All tools use **Web Crypto API** or `crypto.getRandomValues` — no server-side crypto.


| Tool                      | Route                                       | Status      | Editor       | Libraries                  | Purpose & usage                              |
| ------------------------- | ------------------------------------------- | ----------- | ------------ | -------------------------- | -------------------------------------------- |
| Hash Generator            | `/security-tools/hash-generator`            | Implemented | textarea     | Web Crypto (SHA-256, etc.) | Hash text or files.                          |
| UUID Generator            | `/security-tools/uuid-generator`            | Implemented | output panel | `crypto.randomUUID`        | Generate v4 UUIDs in bulk.                   |
| Password Strength Checker | `/security-tools/password-strength-checker` | Implemented | input        | custom scoring             | Score strength with improvement tips.        |
| Random Password Generator | `/security-tools/random-password-generator` | Implemented | output panel | `crypto.getRandomValues`   | Configurable secure passwords.               |
| Text Encrypt & Decrypt    | `/security-tools/text-encrypt-decrypt`      | Implemented | textarea     | Web Crypto AES-GCM         | Encrypt/decrypt with passphrase.             |
| Secure Clipboard          | `/security-tools/secure-clipboard`          | Implemented | textarea     | Web Crypto                 | Encrypted local clipboard storage.           |
| Private Notes             | `/security-tools/private-notes`             | Implemented | textarea     | Web Crypto                 | Self-destructing encrypted notes in browser. |




### Media & Audio Tools (`libs/media-tools`)


| Tool                   | Route                          | Status      | Editor      | Libraries         | Purpose & usage                                             |
| ---------------------- | ------------------------------ | ----------- | ----------- | ----------------- | ----------------------------------------------------------- |
| Voice Recorder         | `/media-tools/voice-recorder`  | Implemented | waveform UI | MediaRecorder API | Record mic audio; download WAV/WebM.                        |
| Audio Player           | `/media-tools/audio-player`    | **Stub**    | —           | —                 | *Planned* — see `/file-viewers/audio-player` for reference. |
| Audio Trimmer          | `/media-tools/audio-trimmer`   | **Stub**    | —           | —                 | *Planned*                                                   |
| Video to GIF Converter | `/media-tools/video-to-gif`    | **Stub**    | —           | —                 | *Planned*                                                   |
| Webcam Snapshot        | `/media-tools/webcam-snapshot` | **Stub**    | —           | —                 | *Planned*                                                   |




### System / Browser Utilities (`libs/browser-utils`)


| Tool                      | Route                                      | Status      | Editor        | Libraries             | Purpose & usage                                 |
| ------------------------- | ------------------------------------------ | ----------- | ------------- | --------------------- | ----------------------------------------------- |
| Screen Resolution Info    | `/browser-utils/screen-resolution-info`    | Implemented | readout       | —                     | Viewport, screen, DPR, media queries.           |
| Battery Status Viewer     | `/browser-utils/battery-status-viewer`     | Implemented | readout       | Battery Status API    | Level, charging state, time estimates.          |
| Device Orientation Logger | `/browser-utils/device-orientation-logger` | Implemented | log panel     | DeviceOrientation API | Live accelerometer/gyro data.                   |
| Storage Viewer            | `/browser-utils/storage-viewer`            | Implemented | tree view     | —                     | Browse localStorage, sessionStorage, IndexedDB. |
| Cookie Editor             | `/browser-utils/cookie-editor`             | Implemented | table + forms | `document.cookie`     | View/edit/delete cookies per domain.            |
| Network Speed Test        | `/browser-utils/network-speed-test`        | Implemented | forms         | `fetch` timing        | Estimate download latency/throughput.           |




### Fun & Productivity Tools (`libs/fun-tools`)


| Tool                         | Route                                     | Status      | Editor          | Libraries                | Purpose & usage                           |
| ---------------------------- | ----------------------------------------- | ----------- | --------------- | ------------------------ | ----------------------------------------- |
| QR Code Generator            | `/fun-tools/qr-code-generator`            | Implemented | forms           | qrcode (CDN), `rxjs`     | Generate QR for URL, text, Wi-Fi, etc.    |
| Barcode Generator            | `/fun-tools/barcode-generator`            | Implemented | forms           | JsBarcode (CDN), `rxjs`  | EAN, UPC, Code128 barcodes.               |
| Stopwatch & Timer            | `/fun-tools/stopwatch-timer`              | Implemented | custom UI       | —                        | Countdown and stopwatch with laps.        |
| Random Number Generator      | `/fun-tools/random-number-generator`      | Implemented | forms           | `crypto.getRandomValues` | Random ints in a range; bulk lists.       |
| Coin Toss & Dice Roller      | `/fun-tools/coin-toss-dice-roller`        | Implemented | custom UI       | —                        | Virtual coin flip and dice with stats.    |
| Lorem Ipsum Generator        | `/fun-tools/lorem-ipsum-generator`        | Implemented | output textarea | —                        | Paragraphs, sentences, or words of lorem. |
| Timezone Converter           | `/fun-tools/timezone-converter`           | Implemented | forms           | `Intl` API               | Compare times across time zones.          |
| Typing Speed Test            | `/fun-tools/typing-speed-test`            | Implemented | custom input    | —                        | WPM, accuracy, live heatmap.              |
| Pomodoro Timer               | `/fun-tools/pomodoro-timer`               | Implemented | custom UI       | —                        | Focus/break intervals with stats.         |
| Flashcard Quiz Generator     | `/fun-tools/flashcard-quiz-generator`     | Implemented | forms + cards   | —                        | Build decks; run quiz mode.               |
| Motivational Quote Generator | `/fun-tools/motivational-quote-generator` | Implemented | custom UI       | —                        | Random quotes; shareable cards.           |


---



## Shared Tool Patterns

Understanding these patterns speeds up development and debugging.

### 1. Text tool layout (`ttool__` / `b64__` BEM classes)

- **Input pane:** `<textarea>` with toolbar buttons bound to `assetService.getAssetPath('icons/*.svg')`.
- **Output pane:** Read-only textarea or stats panel.
- **File upload:** Hidden `<input type="file">`; drag-and-drop on editor; max 10 MB.
- **History:** Undo/redo stacks debounced on input (see `TextToolBase`).
- **Toasts:** `ToastService.success()` / `.error()` for copy/download feedback.



### 2. Calculator / form tools (`ctl__` classes)

Used in `math-date-utils`, some `testing-tools`. Reactive forms with Calculate button and results card.

### 3. PDF tools

1. Load pdf.js from CDN (`loadPdfJs()` helper in `pdf-viewer.ts`).
2. Render page thumbnails to `<canvas>`.
3. Use `pdf-lib` `PDFDocument.load()` → manipulate → `save()` → download blob.
4. Signatures: `signature_pad` on overlay canvas, embed with `pdf-lib`.



### 4. File viewers

- **CDN script injection:** Dynamic `<script>` tags for mammoth, SheetJS, marked, etc.
- **Sanitization:** DOMPurify before injecting HTML from Markdown/Word conversion.
- **Memory:** Revoke object URLs on `ngOnDestroy`.



### 5. Monaco Editor

Only **Text Difference Checker** uses Monaco today via `ngx-monaco-editor-v2`. Monaco assets are copied at build time from `node_modules/monaco-editor` → `assets/monaco-editor` (see `app.config.ts` `provideMonacoEditor`).

### 6. Asset paths

Use `AssetService.getAssetPath('icons/copy.svg')` — never hardcode `/assets/...` in components. Icons live in `apps/tools-site/assets/`.

### 7. SEO & analytics per tool


| Step                  | File                                                 |
| --------------------- | ---------------------------------------------------- |
| Route                 | `apps/tools-site/src/app/app.routes.ts`              |
| SEO title/description | `apps/tools-site/src/app/config/route-seo.config.ts` |
| Homepage catalog      | `my-component.ts` or `text-utilities-catalog.ts`     |
| Sitemap               | `npx nx run tools-site:generate-sitemap`             |




### 8. Auditing SVG assets

```sh
node scripts/audit-svg-refs.mjs      # list missing icon references
node scripts/restore-missing-svgs.mjs # restore category icons from features-home
```

---



## Adding a New Tool



### 1. Create the component

Add a new standalone component under the appropriate library:

```
libs/<category>/src/lib/component/my-new-tool/
├── my-new-tool.ts
├── my-new-tool.html
├── my-new-tool.scss
└── my-new-tool.spec.ts
```



### 2. Export from the library

Add to `libs/<category>/src/index.ts`:

```typescript
export * from './lib/component/my-new-tool/my-new-tool';
```



### 3. Register the route

Add a lazy route in `apps/tools-site/src/app/app.routes.ts`:

```typescript
{
  path: 'my-new-tool',
  loadComponent: () =>
    import('@tools-workspace/<category>').then(m => m.MyNewToolComponent),
},
```



### 4. Add to the home page catalog

Add an entry in `toolCategories` inside `libs/features-home/src/lib/component/myComponent/my-component.ts`.

### 5. Add SEO metadata

Add route metadata in `apps/tools-site/src/app/config/route-seo.config.ts`.

### 6. Regenerate sitemap

```sh
npx nx run tools-site:generate-sitemap
```



### Generate a new library (optional)

```sh
npx nx g @nx/angular:library my-new-category --directory=libs/my-new-category
```

Then add the path alias to `tsconfig.base.json`.

---



## Deployment



### Step 1: Build for production

From the workspace root (`tools-workspace/`):

```sh
npx nx build tools-site --configuration=production
```

This generates the deployable static files in `dist/apps/tools-site/` (includes `index.html`, JS/CSS bundles, `assets/`, `sitemap.xml`, `robots.txt`, and `.htaccess`).

Wait until the terminal shows `Successfully ran target build` (~2 minutes after sitemap generation).

### Step 2: Deploy to Hostinger (VPS)

Upload the build output to the server web root. From the workspace root on **Windows (PowerShell)**:

```powershell
scp -r .\dist\apps\tools-site\* root@72.60.220.37:/var/www/easytoolhub.com/html/
```

On **macOS / Linux**:

```sh
scp -r dist/apps/tools-site/* root@72.60.220.37:/var/www/easytoolhub.com/html/
```

You will be prompted for the server password (or use SSH keys if configured). Ensure `.htaccess` from the build is uploaded for SPA routing and SVG MIME types.

### Other platforms


| Platform         | Build command                                        | Publish directory                                                  |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Hostinger VPS    | `npx nx build tools-site --configuration=production` | Upload `dist/apps/tools-site/*` → `/var/www/easytoolhub.com/html/` |
| Vercel           | `npx nx build tools-site --configuration=production` | `dist/apps/tools-site`                                             |
| Netlify          | `npx nx build tools-site --configuration=production` | `dist/apps/tools-site`                                             |
| Cloudflare Pages | `npx nx build tools-site --configuration=production` | `dist/apps/tools-site`                                             |


Deploy configs are in `apps/tools-site/public/`:

- `vercel.json` — Vercel rewrites and cache headers
- `_headers` — Netlify headers
- `.htaccess` — Apache SPA routing and MIME types

See `apps/tools-site/DEPLOYMENT_CHECKLIST.md` for a full pre/post-deployment checklist.

### Post-deployment verification

How to avoid it next time
Run this after every deploy:

chown -R www-data:www-data /var/www/easytoolhub.com/html
chmod -R 755 /var/www/easytoolhub.com/html
Or add it to a small deploy script on your machine so you don’t forget.

- [ ] Home page loads at `/tools/home`
- [ ] Individual tools load (e.g. `/text-utilities/character-counter`)
- [ ] `/sitemap.xml` and `/robots.txt` are accessible
- [ ] `/favicon.svg`, `/logo.svg`, `/og-image.svg` return 200
- [ ] Google Analytics events fire (check browser DevTools → Network)

---



## Additional Documentation

Guides inside `apps/tools-site/`:


| File                          | Topic                            |
| ----------------------------- | -------------------------------- |
| `DEPLOYMENT_CHECKLIST.md`     | Pre/post deployment verification |
| `SEO_GUIDE.md`                | SEO setup and best practices     |
| `SEO_QUICK_START.md`          | Quick SEO reference              |
| `GA_TRACKING_GUIDE.md`        | Google Analytics implementation  |
| `GA_QUICK_REFERENCE.md`       | GA event reference               |
| `AUTO_TRACKING_GUIDE.md`      | Automatic GA tracking            |
| `COMPILATION_OPTIMIZATION.md` | Build performance tips           |


---



## Useful Nx Commands

```sh
# List all targets for a project
npx nx show project tools-site

# Run a specific target
npx nx run tools-site:generate-sitemap

# Run a command across all projects
npx nx run-many -t lint
npx nx run-many -t test

# See affected projects after changes
npx nx affected -t test

# Visualize project dependency graph
npx nx graph

# Generate a new Angular app
npx nx g @nx/angular:app demo

# Generate a new Angular library
npx nx g @nx/angular:lib mylib

# Connect to Nx Cloud (remote caching, CI)
npx nx connect
```

---



## License

MIT