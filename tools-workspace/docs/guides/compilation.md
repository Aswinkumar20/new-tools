# Compilation / build performance

EasyToolHub uses Angular 20 `@angular/build:application` (esbuild) with **SSG** (`outputMode: "static"`). The public site ships as static files from `dist/apps/tools-site/browser/`.

Heavy PDF (and other server-side) work runs in **`services/tool-api`** (Spring Boot / Java 21). That API is a **separate build and process** — not part of the Angular SSG output.

Canonical PDF hybrid details: [`docs/pdf/README.md`](../pdf/README.md).

## Local vs production (UI)

| Command | Config | Behavior |
| --- | --- | --- |
| `npm start` / `npx nx serve tools-site` | `development` | Fast CSR; proxies `/api` → `http://localhost:8080` (`apps/tools-site/proxy.conf.json`) |
| `npm run build` / `build-prod` | `production` | Hybrid SSG: sitemap regen + prerender → `dist/apps/tools-site/browser` |
| `npm run serve:ssg` | preview | Serve the static SSG output locally |

Heap: `.npmrc` + `apps/tools-site/.env` set `NODE_OPTIONS=--max-old-space-size=4096`. On a tight laptop use `NG_BUILD_MAX_WORKERS=1`. Prefer a **16GB** machine for full production SSG.

## UI commands

```bash
npm start
npx nx run tools-site:generate-sitemap
npm run build
npm run serve:ssg
```

### After PDF advanced-tool registry changes

When you edit `scripts/pdf-tools/pdf-advanced-tools.registry.mjs`:

```bash
node scripts/pdf-tools/generate-advanced-pdf-tools.mjs
npx nx run tools-site:generate-tool-seo-catalog
```

- Regenerates thin workbench wrappers, routes exports, and `libs/pdf-tools/.../pdf-advanced-tools.registry.ts`
- Custom workbenches (e.g. `pdf-redact`) are **skipped** by the generator so they are not overwritten
- SEO / UI catalogs and prerender routes update from the live route set

## Backend (`tool-api`)

Requires **JDK 21+** and **Maven**.

| Command | Behavior |
| --- | --- |
| `npm run start:api` | `mvn spring-boot:run` on `:8080` |
| `npm run start:all` | UI + API concurrently |
| `npm run build:api` | `mvn -DskipTests package` → JAR under `services/tool-api/target/` |
| `mvn -Dtest=… test` (from `services/tool-api`) | Unit tests (e.g. `PdfBoxFormAndSplitTest`) |
| `npm run compose:api` | Docker image with engines (qpdf, Ghostscript, Tesseract, LibreOffice, Chromium) |

```bash
# Dev API only
npm run start:api

# Package JAR (skip tests)
npm run build:api

# Run a focused PDF test
cd services/tool-api && mvn -Dtest=PdfBoxFormAndSplitTest test
```

Optional engines on the host (or use Compose): **qpdf**, **Ghostscript**, **Tesseract**, **LibreOffice (`soffice`)**, **Chromium**. Without them, honesty/fail-closed endpoints report missing capabilities via `GET /api/v1/pdf/health`.

Env template: `infra/env/tool-api.env.example`.

## What must be compiled for a full local PDF check

1. Start API (`npm run start:api` or Compose).
2. Start UI (`npm run start:ui` / `npm start`) so `/api` proxies correctly.
3. Smoke: `http://localhost:8080/api/v1/pdf/health` and a hybrid tool such as `/pdf-tools/password-protect-pdf` or `/pdf-tools/pdf-redact`.

Static-only SSG preview (`serve:ssg`) does **not** include the API unless you reverse-proxy `/api` to a running `tool-api`.

## Related

- [`deployment.md`](./deployment.md) — static site + API deploy
- [`../pdf/README.md`](../pdf/README.md) — PDF privacy, endpoints, slices
- [`../../README.md`](../../README.md) — getting started
