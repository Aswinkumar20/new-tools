# PDF hybrid (Angular + Java tool-api)

PDF is one **domain module** inside the shared backend `services/tool-api`.
Planning guide: [java-angular-capabilities.txt](./java-angular-capabilities.txt)

## Quick start

```bash
npm run start:api    # services/tool-api on :8080
npm run start:ui     # Angular (proxies /api → :8080)
# or: npm run start:all
```

- Platform health: http://localhost:8080/api/v1/health  
- PDF health: http://localhost:8080/api/v1/pdf/health  
- OpenAPI: `contracts/pdf/openapi.yaml`  
- Try: http://localhost:4200/pdf-tools/password-protect-pdf  

## Privacy & storage (no permanent uploads)

tool-api **does not store user uploads**. Policy:

| Stage | Behavior |
| ----- | -------- |
| Request body | Multipart spill only under `APP_TEMP_DIR/multipart` (ephemeral) |
| Processing | Prefer **in-memory** PDFBox; disk job dirs only when Ghostscript / LibreOffice / qpdf linearize require files |
| After response | Job dir is **wiped** (overwrite + delete) in `finally` |
| Safety net | TTL sweeper (default **5 minutes**) removes any leftover ephemeral files |
| Browser | PDFs are **not** written to `sessionStorage` / `localStorage` |
| Responses | `Cache-Control: no-store` on `/api/**` |

There is no upload database, object store, or permanent upload directory.

## Backend scalability & limits (Stage 1)

| Guard | Behavior |
| ----- | -------- |
| Concurrent jobs | Semaphore + bounded thread pool (`pdf.batch-max-concurrent-jobs`) — rejects with 503 when busy |
| Job store | In-memory cap (`app.max-stored-jobs`), TTL sweep (`app.job-ttl-minutes`) |
| Rate limit | Per-IP write limit (`app.rate-limit-per-minute`) on `/api/**` POST/PUT/PATCH/DELETE |
| Large merge | Disk-native `RandomAccessReadBufferedFile` + temp-file stream cache (no double heap load) |
| Downloads | Job results streamed from disk (`FileSystemResource`) |
| ZIP uploads | Entry/size/ratio caps; path traversal blocked; magic peek without full read |
| PDF validation | `%PDF` magic + `pdf.max-pages` before heavy work |

## Backend layout

```
services/tool-api/…/com/easytoolhub/
  common/     shared platform (TempWorkspace, NoStore filter)
  pdf/        this domain (/api/v1/pdf/*)
```

See `services/README.md` for adding more domains.

## Hybrid tool wiring (API first, client fallback)

Enabled via `DEFAULT_PDF_BACKEND_CONFIG` in `libs/pdf-tools`:

| Tool | Endpoint |
| ---- | -------- |
| Merge / compress / delete / extract / rotate / reorder | `/merge`, `/compress`, … |
| Watermark / page numbers / metadata | `/watermark`, `/page-numbers`, `/metadata` |
| HTML→PDF / Text→PDF / Images→PDF | `/html-to-pdf`, `/text-to-pdf`, `/images-to-pdf` |
| Split PDFs | `/split` → ZIP of ranges (`1-3;4-6`) |
| Fill / flatten forms | `/fill-form`, `/flatten-form` |
| Annotate / highlight | `/annotate` |
| Add signature (draw/upload) | `/stamp-image` |
| PDF → text (workbench Extract + PDF to TXT) | `/pdf-to-text` |
| PDF → page images ZIP | `/pdf-to-images` (`/pdf-tools/pdf-to-images`) |
| OCR searchable PDF / OCR text | `/ocr` (`/pdf-tools/ocr-pdf`) — needs Tesseract |
| PKCS#12 digital sign | `/sign-pkcs12` (`/pdf-tools/pdf-digital-signature`) |
| Signature verify (CMS integrity) | `/verify-signatures` |
| Visible signature stamp (non-crypto) | `/stamp-signature` (`/pdf-tools/pdf-signature-stamp`) |
| Image redaction (OSS) | `/redact` (`/pdf-tools/pdf-redact`) — draw regions + text match; rasterize + black boxes |
| Batch ZIP / multi-PDF (async) | `/batch` + `/jobs/{id}` + `/jobs/{id}/download` (`/pdf-tools/pdf-batch-processing`) |

Password protect / unlock / permissions remain API-required.

### Large merge / split (Slice 7)

Sync `/merge` and `/split` automatically use a **scratch-file stream cache** when uploads are large.
For big jobs the UI calls:

```text
POST /api/v1/pdf/merge-async   → { jobId, … }
POST /api/v1/pdf/split-async   → { jobId, … }
GET  /api/v1/pdf/jobs/{id}
GET  /api/v1/pdf/jobs/{id}/download
```

Thresholds: `PDF_LARGE_FILE_THRESHOLD_BYTES` (default 8MB), `PDF_LARGE_MERGE_MIN_FILES` (default 5).

### Image redaction (Slice 11 + Slice 14 UI)

Honest **image redaction** (not commercial content-stream scrubbing): pages are rendered, black boxes painted for text matches and/or regions, then rebuilt as image-only PDF so the original text cannot be copied or searched.

UI (`/pdf-tools/pdf-redact`): draw rectangles on a pdf.js preview (PDF bottom-left coords), optional text query, then POST `/redact`.

```text
POST /api/v1/pdf/redact
  file + query? + regions? (JSON [{pageIndex,x,y,width,height}]) + dpi?
```

### Batch processing (Slice 10)

Upload multiple PDFs or a ZIP of PDFs, pick an operation, and poll until the result ZIP is ready.

```text
POST /api/v1/pdf/batch          → { jobId, status, total, … }
GET  /api/v1/pdf/jobs/{id}      → progress (completed/failed/progress)
GET  /api/v1/pdf/jobs/{id}/download → application/zip
```

Supported operations: `remove-metadata`, `remove-annotations`, `remove-hidden`, `rotate`, `watermark`, `page-numbers`, `flatten-form`, `repair`.

Job status is **in-memory** (Stage 1); result bytes live under ephemeral `APP_TEMP_DIR` and expire with `APP_JOB_TTL_MINUTES`. Zip-bomb guards: max entries, uncompressed size, compression ratio.

### OCR (Slice 8)

Requires **Tesseract** on the API host:

```bash
# macOS
brew install tesseract
# Debian/Ubuntu (also in services/tool-api/Dockerfile)
apt install tesseract-ocr tesseract-ocr-eng
```

Optional env: `PDF_TESSDATA_PATH`, `PDF_OCR_MAX_PAGES` (default 25).

### Lineup gaps closed (Office / PDF/A honesty / URL / preview / Redis / forms / DOCX)

| Capability | Endpoint / notes |
| ---------- | ---------------- |
| Office → PDF (async) | `POST /office-to-pdf-async` — LibreOffice in Docker; poll `/jobs/{id}` |
| PDF/A | `POST /to-pdfa` — **fails closed** without Ghostscript |
| Web optimize | `POST /web-optimize` — **fails closed** without qpdf/gs |
| URL → PDF | `POST /url-to-pdf` or `/url-to-pdf-async` — Chromium; SSRF-blocked |
| Markdown → PDF | `POST /markdown-to-pdf` |
| PDF → DOCX | `POST /to-docx` — LibreOffice preferred, text DOCX fallback |
| Preview session | `POST /preview/session` → `GET /preview/{id}/pages/{n}.png` |
| Form builder / XFDF | `POST /create-form-field` (JSON fields, optional `required`), `/export-form`, `/import-form` |
| Form validate required | `POST /validate-form` → JSON (`/pdf-tools/pdf-form-validate`) |
| Job store | `APP_JOB_STORE=memory\|redis` (Redis needs shared `APP_TEMP_DIR`) |
| Engine health | `GET /pdf/health` returns `engines` + `capabilities` |

Heuristic AI/analysis tools show an honesty banner in the advanced workbench (`capability: heuristic`).

### Slice 12 — Scan pipeline (OCR async / DOCX / deskew)

| Capability | Endpoint / notes |
| ---------- | ---------------- |
| OCR async | `POST /ocr-async` — modes `searchable` \| `text` \| `docx`; optional `deskew=true` |
| OCR sync | `POST /ocr` — same modes (kept for small jobs) |
| Deskew | `POST /deskew` — projection-variance skew estimate; rebuilds pages as images |
| Engine UX | Advanced workbench loads `/pdf/health` and warns when required engines are missing |

OCR UI tool (`/pdf-tools/ocr-pdf`) uses the async path by default.

### Slice 13 — Server preview UI + images→searchable PDF

| Capability | Endpoint / notes |
| ---------- | ---------------- |
| Viewer server preview | `/pdf-tools/pdf-viewer` uses `POST /preview/session` for files ≥ large-file threshold, and as fallback for failed/encrypted client opens |
| Images → searchable PDF | `/pdf-tools/images-to-searchable-pdf` → `POST /images-to-searchable-pdf` (images → PDF → OCR) |

### Slice 14 — Redact region picker + form validate

| Capability | Endpoint / notes |
| ---------- | ---------------- |
| Redact region picker | `/pdf-tools/pdf-redact` — draw boxes on preview; regions sent as PDF-space JSON |
| Form validate required | `POST /validate-form` — lists missing required AcroForm fields; create-field JSON accepts `required: true` |


