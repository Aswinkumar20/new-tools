# Architecture

## Purpose

**EasyToolHub** (`@tools-workspace/source`) is a free browser toolkit at [easytoolhub.com](https://easytoolhub.com). Processing is almost entirely **client-side**. The Express SSR server serves HTML/static files only — **no product REST API**.

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Monorepo | Nx 21.6 |
| Framework | Angular ~20.3 (standalone components) |
| Language | TypeScript ~5.9 |
| Styling | SCSS |
| SSR | `@angular/ssr` + Express `CommonEngine` |
| Unit tests | Jest + jest-preset-angular |
| E2E | Playwright |
| Lint | ESLint 9 flat config |

**Bundled libs (notable):** `pdf-lib`, `signature_pad`, `tesseract.js`, `ngx-monaco-editor-v2`, `rxjs`, `pako`.

**CDN at runtime:** pdf.js, SheetJS, mammoth, marked, DOMPurify (markdown), JSZip, Chart.js, qrcode, JsBarcode, jspdf, html2canvas.

No NgRx, no app `environments/`, no HTTP interceptors, no route guards. Root `package.json` `"scripts": {}` — use `npx nx …`.

## Folder structure

```
tools-workspace/
├── apps/
│   ├── tools-site/          # SPA + SSR (routes, SEO, GA)
│   └── tools-site-e2e/      # Playwright
├── libs/                    # 23 libraries (@tools-workspace/*)
├── docs/                    # This documentation (canonical)
├── scripts/                 # SVG audit / stub helpers
├── nx.json
├── tsconfig.base.json
└── README.md                # Getting started only
```

Path aliases: `@tools-workspace/<lib>` → `libs/<lib>/src/index.ts`.

## Runtime architecture

```mermaid
flowchart TB
  User[Browser] --> App[App shell]
  App --> Outlet[router-outlet]
  App --> Footer[lib-footer]
  App --> Toast[lib-toast-container]
  App --> SEO[SeoService]
  App --> GA[GoogleAnalyticsService]
  Outlet -->|lazy loadComponent| Home[features-home]
  Outlet -->|lazy loadComponent| Tools[22 tool libs]
  Home --> Nav[Navigation]
  Tools --> Nav
  Tools --> ToastSvc[ToastService]
  Tools --> Assets[AssetService]
  SSR[Express server.ts] --> Engine[CommonEngine]
```

| Layer | Responsibility |
| ----- | -------------- |
| `apps/tools-site` | Bootstrap, `app.routes.ts` (365 lazy routes), SEO, GA, shell |
| `features-home` (`type:shared`) | Home, nav, footer, toast, assets, i18n, coming-soon page |
| Feature libs (`type:feature`) | One tool (or PDF mode) per route; client logic + optional CDN |
| Build scripts | SEO catalog, prerender routes, sitemap |

### Routing

- Single table: `apps/tools-site/src/app/app.routes.ts`.
- Pattern: category parent → `children` with `loadComponent`.
- Coming-soon routes load shared `ComingSoonPageComponent` from `features-home`.
- `''` and `**` redirect toward `tools`.

### Design choices

1. Thin app, fat libs  
2. Lazy per-tool chunks  
3. Privacy-first client processing (FX rates are the main outbound product API)  
4. Shell shared via `features-home` (`type:shared`; Navigation still coupled to the generated catalog)  
5. PDF: mode-driven workbenches; Text: many tools extend `TextToolBase`

Hardcoded: SEO base `https://easytoolhub.com`, GA `G-C7L2T1RHVW`.

---

## State management

No global UI store.

| Pattern | Where |
| ------- | ----- |
| Component fields / Angular signals | Most tools |
| `BehaviorSubject` | `ToastService`, `LanguageService`, `TranslationService` |
| In-memory `Map` cache | `CurrencyRateService`, GA session sets |
| Signal stores | Unit-converter preset/history |
| `localStorage` | Theme (`theme`), language, clipboard history, some tool history |
| `sessionStorage` | PDF workbench (`easytoolhub.pdf.session`) |

**Theme caveat:** shell uses key `theme`; home also references `easytoolhub.theme` in places — can desync.

```mermaid
flowchart LR
  Tool --> ToastSvc[ToastService]
  Tool --> Local[Component state]
  Tool --> Storage[local/session storage]
  Nav --> Lang[LanguageService]
  Lang --> Trans[TranslationService]
  Currency --> FX[FX HTTP APIs]
```

**Guidance:** keep utils pure; use signals + OnPush for new UIs; root services only for cross-route concerns.

---

## Architecture diagrams

### Component hierarchy

```mermaid
flowchart TB
  App[app-root] --> Main[router-outlet]
  App --> Footer[lib-footer]
  App --> Toasts[lib-toast-container]
  Main --> Home[lib-my-component]
  Main --> Tool[lib-* tool]
  Home --> Nav[lib-navigation]
  Tool --> Nav
```

### Typical tool flow

```mermaid
sequenceDiagram
  participant U as User
  participant R as Router
  participant T as Tool
  participant Util as Utils
  participant Toast as ToastService
  U->>R: Navigate
  R->>T: lazy load
  U->>T: Input / upload
  T->>Util: process
  Util-->>T: result
  T->>Toast: feedback
```

### PDF workbench

```mermaid
sequenceDiagram
  participant U as User
  participant W as Thin route
  participant WB as PdfWorkbench
  participant PL as PdfLibService
  U->>W: Open mode route
  W->>WB: mode + titles
  U->>WB: Upload PDF
  WB->>PL: mutate by mode
  U->>WB: Download
```

### Build catalog pipeline

```mermaid
flowchart LR
  Routes[app.routes.ts] --> Gen[generate-tool-seo-catalog]
  Gen --> SEO[tool-seo-catalog.generated.ts]
  Gen --> UI[tools-catalog.generated.ts]
  Gen --> Pre[prerender-routes.txt]
  Gen --> SM[generate-sitemap]
  SM --> XML[public/sitemap.xml]
```

### SEO + GA on navigation

```mermaid
sequenceDiagram
  participant R as Router
  participant App as App
  participant SEO as SeoService
  participant Auto as AutoGATracker
  participant GA as GoogleAnalytics
  R->>App: NavigationEnd
  App->>SEO: updateMetadata
  App->>GA: time on page / page view
  Auto->>GA: tool_usage / tool_view if mapped
```
