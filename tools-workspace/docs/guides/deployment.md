# Deployment

EasyToolHub has **two deployables**:

| Artifact | Output | Role |
| -------- | ------ | ---- |
| **Static site (SSG)** | `dist/apps/tools-site/browser/` | Public UI — no Node/Express SSR runtime |
| **`tool-api` (Java)** | Spring Boot JAR or Docker image | Server PDF / Model3D ops under `/api/v1/*` |

Most tools remain client-side. Hybrid PDF tools (password, merge/split async, OCR, Office→PDF, redact, forms validate, URL→PDF, etc.) call **`/api/v1/pdf/*`**. Without `tool-api` behind that path, those tools degrade or fail closed depending on the endpoint.

Canonical API behavior and privacy: [`docs/pdf/README.md`](../pdf/README.md).

---

## 1. Static site

```bash
npm run build
# equivalent: npx nx run tools-site:build-prod
# (runs generate-sitemap → production SSG)
```

Deploy folder: **`dist/apps/tools-site/browser/`** only.

Put **Cloudflare** (or similar) in front of Apache for global TTFB: long cache on hashed JS/CSS, shorter TTL on HTML, keep `sitemap.xml` / `robots.txt` fresh. Use one HTTPS host (`easytoolhub.com`, not www + apex duplicates).

### Pre-deploy checklist (UI)

Confirm in browser dist:

- `/assets/favicon.ico`, `/assets/favicon.svg`, `/assets/logo.svg`, `/assets/og-image.svg`
- `robots.txt`, `sitemap.xml`
- Apache: `.htaccess`
- Netlify: `_headers` (copied from `public/_headers`)
- Vercel: `vercel.json` (**no** SPA catch-all rewrite to `index.html`)

Local smoke:

```bash
npm run serve:ssg
# Hit /assets/og-image.svg /assets/logo.svg → 200, Content-Type image/svg+xml
# Hit /fake-url-test → HTTP 404 (not homepage)
```

Tool route smoke (Playwright — all live tools load without JS errors):

```bash
# Terminal 1
npm start

# Terminal 2
npm run e2e:smoke
```

`package-lock.json` stays gitignored in this repo. Nx Playwright targets use custom cache inputs in `nx.json` / `apps/tools-site-e2e/project.json` so e2e does not require a committed lockfile.

Fix root-owned npm cache (if `npm install` fails):

```bash
sudo chown -R "$(whoami)" ~/.npm node_modules
npm install
npx playwright install chromium
```

### Platforms (static)

| Platform | Notes |
| -------- | ----- |
| Apache | Copy `.htaccess`; enable `mod_mime`, `mod_headers`, `mod_rewrite`, `AllowOverride`. Pretty prerendered folders; `ErrorDocument 404 /404.html` — do not SPA-fallback unknown URLs to `index.html`. |
| Nginx | `location ~* \.svg$ { add_header Content-Type image/svg+xml; ... }` |
| Netlify | Publish `dist/apps/tools-site/browser`; `_headers` for MIME |
| Vercel | Output browser dist; `vercel.json` without catch-all SPA rewrite |
| Cloudflare Pages | Same output; MIME usually OK |
| S3 + CloudFront | Set SVG `Content-Type`; cache headers |

### SVG MIME (Apache)

If SVGs serve as `text/html`:

1. Ensure `.htaccess` from `apps/tools-site/public/` is at site root.  
2. Or vhost: `AddType image/svg+xml .svg` / `ForceType`.  
3. `sudo a2enmod mime headers && sudo systemctl restart apache2`.  
4. Verify: `curl -I https://easytoolhub.com/assets/logo.svg`.

Canonical OG/logo/favicon live under **`/assets/`**. Hosting configs (`_headers`, `vercel.json`, `.htaccess`) must target `/assets/*.svg`, not root `/og-image.svg`.

---

## 2. `tool-api` (required for hybrid PDF)

### Build & run options

```bash
# JAR
npm run build:api
java -jar services/tool-api/target/tool-api-0.1.0-SNAPSHOT.jar

# Or Docker (includes qpdf, Ghostscript, Tesseract, LibreOffice, Chromium)
npm run compose:api
# docker compose -f infra/compose/docker-compose.yml up --build tool-api
```

Optional Redis job store:

```bash
APP_JOB_STORE=redis docker compose -f infra/compose/docker-compose.yml --profile redis up --build
```

Env template: `infra/env/tool-api.env.example`.

### Reverse-proxy `/api`

The UI uses relative **`/api/v1/pdf`** (see `DEFAULT_PDF_BACKEND_CONFIG`). In production, terminate TLS on the edge and proxy:

```text
https://easytoolhub.com/api/*  →  tool-api:8080/api/*
```

Example Nginx fragment:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8080/api/;
  proxy_request_buffering off;
  client_max_body_size 55m;   # align with APP_MAX_UPLOAD_MB (+ margin)
  proxy_read_timeout 600s;    # OCR / Office / large merge
  proxy_send_timeout 600s;
}
```

Set `APP_CORS_ORIGINS` to your real site origins if the API is on a **different host** than the static site. Same-origin `/api` proxy is preferred (no CORS needed).

Do **not** cache `/api/**` at the CDN (`Cache-Control: no-store` is already set by the API).

### Engines & capabilities

| Binary / service | Used for |
| ---------------- | -------- |
| PDFBox (in JAR) | Core PDF ops, forms, redact rasterize, preview |
| qpdf | Web-optimize (fail-closed if missing) |
| Ghostscript | PDF/A, some compress paths (fail-closed where configured) |
| Tesseract | OCR / searchable PDF / deskew pipeline |
| LibreOffice (`soffice`) | Office→PDF, PDF→DOCX |
| Chromium | URL→PDF (SSRF-blocked) |
| Redis (optional) | Shared job store when `APP_JOB_STORE=redis` (needs shared `APP_TEMP_DIR`) |

Health:

```bash
curl -s https://easytoolhub.com/api/v1/health
curl -s https://easytoolhub.com/api/v1/pdf/health   # engines + capabilities
```

### Privacy (production must keep)

- No permanent uploads; ephemeral dirs under `APP_TEMP_DIR`, wiped after jobs + TTL sweeper
- Prefer ephemeral disk / emptyDir; do not mount a durable object store as the job dir
- Tune: `APP_MAX_UPLOAD_MB`, `APP_JOB_TTL_MINUTES`, rate limits, `PDF_MAX_PAGES`

### Recent hybrid surfaces to smoke after deploy

| Area | Check |
| ---- | ----- |
| Password / merge / split | Sync + large async jobs (`/jobs/{id}`) |
| OCR / images→searchable | Needs Tesseract |
| Office→PDF / to-DOCX | Needs LibreOffice |
| URL→PDF | Needs Chromium; SSRF blocks private hosts |
| Redact region picker | `/pdf-tools/pdf-redact` → `POST /redact` |
| Form validate | `/pdf-tools/pdf-form-validate` → `POST /validate-form` |
| Server preview | Viewer / large files → `/preview/session` |

---

## Post-deploy

**Static**

- Curl image headers; OG debuggers (Facebook/Twitter/LinkedIn)  
- Rich Results Test; Search Console indexing  
- Align meta OG URLs with real asset paths (`https://easytoolhub.com/assets/og-image.svg`)  
- Confirm unknown paths return **HTTP 404**, not soft-404 homepage  

**API**

- `GET /api/v1/pdf/health` shows expected engines  
- One upload-heavy path (merge or redact) completes; response is `no-store`  
- Confirm job dirs under `APP_TEMP_DIR` do not accumulate  

## Related

- [seo.md](./seo.md) — sitemap generation  
- [compilation.md](./compilation.md) — UI + API build  
- [../pdf/README.md](../pdf/README.md) — PDF hybrid, privacy, slices  
- [../architecture.md](../architecture.md) — SSG overview  
- [`services/tool-api/README.md`](../../services/tool-api/README.md) — API layout  
