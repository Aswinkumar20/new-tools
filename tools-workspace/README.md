# EasyToolHub (ToolsWorkspace)

Free, browser-based toolkit at [easytoolhub.com](https://easytoolhub.com). Nx monorepo: one Angular app + 14 feature libraries. Processing is client-side.

**Documentation lives in [`docs/`](./docs/README.md)** — architecture, features, components, APIs, quality/debt, SEO, analytics, and deployment. Do not add new `.md` files outside `docs/` (except this README).

---

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Monorepo | Nx 21.6 |
| Framework | Angular 20 (standalone) |
| Language | TypeScript 5.9 |
| Styling | SCSS |
| SSR | `@angular/ssr` + Express |
| Unit tests | Jest |
| E2E | Playwright |

---

## Prerequisites

- Node.js 18.x or 20.x (LTS)
- npm 9+

```sh
node -v && npm -v
```

---

## Getting started

```sh
git clone <repository-url>
cd tools-workspace
npm install
npx nx serve tools-site
```

Open [http://localhost:4200](http://localhost:4200).

---

## Project structure

```
tools-workspace/
├── apps/tools-site/         # App shell, routes, SEO, GA, SSR
├── apps/tools-site-e2e/     # Playwright
├── libs/                    # Feature libraries (@tools-workspace/*)
├── docs/                    # Canonical documentation
├── scripts/                 # Maintenance scripts
├── nx.json
├── tsconfig.base.json
└── README.md
```

Libraries: `features-home`, `text-utilities`, `file-viewers`, `data-converters`, `math-date-utils`, `pdf-tools`, `image-color-tools`, `code-file-tools`, `dev-design-tools`, `testing-tools`, `security-tools`, `media-tools`, `browser-utils`, `fun-tools`.

Import example:

```typescript
import { Navigation, ToastService } from '@tools-workspace/features-home';
```

---

## Common commands

```sh
# Dev
npx nx serve tools-site
npx nx serve-ssr tools-site

# Build
npx nx build tools-site --configuration=production
npx nx serve-static tools-site

# Quality
npx nx lint tools-site
npx nx test text-utilities
npx nx e2e tools-site-e2e
npx nx graph

# SEO / sitemap (also runs before production build)
npx nx run tools-site:generate-sitemap
```

Deploy output: `dist/apps/tools-site/browser/`. Details: [docs/guides/deployment.md](./docs/guides/deployment.md).

---

## Adding a new tool

1. Create component under `libs/<category>/src/lib/component/<tool>/` (plus `utils` / `types` / `constants` / specs as needed).
2. Export from `libs/<category>/src/index.ts`.
3. Add lazy `loadComponent` route in `apps/tools-site/src/app/app.routes.ts`.
4. Run `npx nx run tools-site:generate-sitemap` (updates SEO catalog + sitemap).
5. Add AutoGA route mapping if you need tool-specific analytics ([docs/guides/analytics.md](./docs/guides/analytics.md)).
6. Reuse `Navigation`, `ToastService`, `AssetService`, `TooltipDirective` from `@tools-workspace/features-home`.

Patterns: [docs/components.md](./docs/components.md), [docs/features.md](./docs/features.md).

---

## Status snapshot

| Metric | Value |
| ------ | ----- |
| Lazy routes | 162 |
| Coming-soon UIs | 6 (see [docs/features.md](./docs/features.md)) |
| Unit specs | ~289 |

---

## Documentation index

| Doc | Topic |
| --- | ----- |
| [docs/README.md](./docs/README.md) | Full index |
| [docs/architecture.md](./docs/architecture.md) | Architecture & state |
| [docs/features.md](./docs/features.md) | Features & flows |
| [docs/components.md](./docs/components.md) | Component catalog |
| [docs/api.md](./docs/api.md) | External HTTP / CDN |
| [docs/quality.md](./docs/quality.md) | Quality, debt, testing |
| [docs/guides/seo.md](./docs/guides/seo.md) | SEO |
| [docs/guides/analytics.md](./docs/guides/analytics.md) | Google Analytics |
| [docs/guides/deployment.md](./docs/guides/deployment.md) | Deploy |
| [docs/guides/compilation.md](./docs/guides/compilation.md) | Build performance |

License: MIT.
