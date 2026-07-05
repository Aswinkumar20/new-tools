# EasyToolHub (ToolsWorkspace)

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

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
- [Adding a New Tool](#adding-a-new-tool)
- [Deployment](#deployment)
- [Additional Documentation](#additional-documentation)
- [Useful Nx Commands](#useful-nx-commands)

---

## Features

- **130+ tools** across 14 categories (text, PDF, file viewers, converters, security, etc.)
- **Client-side processing** — data stays in the browser
- **Lazy-loaded routes** — each tool loads on demand for fast initial page load
- **SEO optimized** — per-route metadata, sitemap generation, structured data
- **Google Analytics 4** — page views, tool usage, scroll, and error tracking
- **Internationalization** — English, Spanish, German, French (`apps/tools-site/src/assets/i18n/`)
- **SSR support** — optional server-side rendering via Express
- **Multi-platform deploy** — Vercel, Netlify, Apache, Nginx, Cloudflare Pages, VPS

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Nx 21.6 |
| Framework | Angular 20 (standalone components) |
| Language | TypeScript 5.9 |
| Styling | SCSS |
| SSR | `@angular/ssr` + Express |
| Unit tests | Jest + jest-preset-angular |
| E2E tests | Playwright |
| Linting | ESLint 9 (flat config) |

**Key runtime libraries:** Monaco Editor, CodeMirror, pdf-lib, tesseract.js (OCR), ngx-doc-viewer, signature_pad, figlet

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
│   ├── text-utilities/          # Text & encoding tools (9 tools)
│   ├── file-viewers/            # File preview tools (13 tools)
│   ├── data-converters/         # JSON/CSV/YAML converters (8 tools)
│   ├── math-date-utils/         # Calculators & date tools (13 tools)
│   ├── pdf-tools/               # PDF manipulation (21 tools)
│   ├── image-color-tools/       # Image & color tools (10 tools)
│   ├── code-file-tools/         # Code minifiers & file tools (9 tools)
│   ├── dev-design-tools/        # CSS generators, HTTP tools (11 tools)
│   ├── testing-tools/           # Validators, JWT decoder (6 tools)
│   ├── security-tools/          # Hash, UUID, encryption (7 tools)
│   ├── media-tools/             # Audio/video/webcam (5 tools)
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
dist/apps/tools-site/browser/    ← Deploy this folder (static SPA)
dist/apps/tools-site/            ← Root build output
```

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

Opens [http://localhost:4200](http://localhost:4200) serving files from `dist/apps/tools-site/browser/`.

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

| Target | Command | Output |
|--------|---------|--------|
| SPA (production) | `npx nx build tools-site --configuration=production` | `dist/apps/tools-site/browser/` |
| SPA (development) | `npx nx build tools-site` | `dist/apps/tools-site/` |
| SSR server | `npx nx server tools-site` | `dist/apps/tools-site/server/` |
| Sitemap | `npx nx run tools-site:generate-sitemap` | `apps/tools-site/public/sitemap.xml` |

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

| File | Purpose |
|------|---------|
| `apps/tools-site/src/main.ts` | Browser entry point |
| `apps/tools-site/src/app/app.ts` | Root shell (footer, toasts, GA, SEO) |
| `apps/tools-site/src/app/app.routes.ts` | Central route table (~132 lazy-loaded tools) |
| `apps/tools-site/src/app/config/route-seo.config.ts` | Per-route SEO metadata |
| `apps/tools-site/src/app/services/google-analytics.service.ts` | GA4 tracking |
| `libs/features-home/src/lib/component/myComponent/` | Home page tool catalog |
| `libs/features-home/src/lib/component/navigation/` | Shared navigation bar |
| `libs/<category>/src/lib/component/<tool>/` | Individual tool components |

### Tool component pattern

Each tool is a **standalone Angular component**:

1. Lives in `libs/<category>/src/lib/component/<tool-name>/`
2. Imports `Navigation` and `ToastService` from `@tools-workspace/features-home`
3. Exported from the library's `src/index.ts`
4. Registered in `apps/tools-site/src/app/app.routes.ts` with `loadComponent`
5. Listed in `toolCategories` inside `my-component.ts` for the home page catalog

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

### Build for production

```sh
npx nx build tools-site --configuration=production
```

Deploy the contents of **`dist/apps/tools-site/browser/`** to your hosting provider.

### VPS deployment (Apache / shared hosting)

Copy built files to the server:

```sh
# From dist/apps/tools-site/browser/ on your local machine:
scp -r * root@72.60.220.37:/var/www/easytoolhub.com/html/
```

Ensure `.htaccess` from `apps/tools-site/public/` is included for SPA routing and SVG MIME types.

### Platform-specific settings

| Platform | Build command | Publish directory |
|----------|---------------|-------------------|
| Vercel | `npx nx build tools-site --configuration=production` | `dist/apps/tools-site/browser` |
| Netlify | `npx nx build tools-site --configuration=production` | `dist/apps/tools-site/browser` |
| Cloudflare Pages | `npx nx build tools-site --configuration=production` | `dist/apps/tools-site/browser` |
| Apache / VPS | Build locally, upload `browser/` contents | `/var/www/easytoolhub.com/html/` |

Deploy configs are in `apps/tools-site/public/`:

- `vercel.json` — Vercel rewrites and cache headers
- `_headers` — Netlify headers
- `.htaccess` — Apache SPA routing and MIME types

See `apps/tools-site/DEPLOYMENT_CHECKLIST.md` for a full pre/post-deployment checklist.

### Post-deployment verification

- [ ] Home page loads at `/tools/home`
- [ ] Individual tools load (e.g. `/text-utilities/character-counter`)
- [ ] `/sitemap.xml` and `/robots.txt` are accessible
- [ ] `/favicon.svg`, `/logo.svg`, `/og-image.svg` return 200
- [ ] Google Analytics events fire (check browser DevTools → Network)

---

## Additional Documentation

Guides inside `apps/tools-site/`:

| File | Topic |
|------|-------|
| `DEPLOYMENT_CHECKLIST.md` | Pre/post deployment verification |
| `SEO_GUIDE.md` | SEO setup and best practices |
| `SEO_QUICK_START.md` | Quick SEO reference |
| `GA_TRACKING_GUIDE.md` | Google Analytics implementation |
| `GA_QUICK_REFERENCE.md` | GA event reference |
| `AUTO_TRACKING_GUIDE.md` | Automatic GA tracking |
| `COMPILATION_OPTIMIZATION.md` | Build performance tips |

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
