# EasyToolHub documentation

All project documentation lives in this folder. The root [`README.md`](../README.md) is the short getting-started entry point only.

## Index

| Doc | Contents |
| --- | -------- |
| [architecture.md](./architecture.md) | Purpose, stack, folders, runtime architecture, state, diagrams |
| [features.md](./features.md) | Feature categories, user flows, coming-soon tools |
| [components.md](./components.md) | Shell, shared bases, component catalog by library |
| [api.md](./api.md) | HTTP, CDN, WebSocket, analytics endpoints |
| [quality.md](./quality.md) | Code quality, debt, testing, future work |
| [guides/analytics.md](./guides/analytics.md) | Google Analytics (canonical) |
| [guides/seo.md](./guides/seo.md) | SEO, sitemap, catalogs (canonical) |
| [guides/deployment.md](./guides/deployment.md) | Deploy checklist, SVG MIME, platforms |
| [guides/compilation.md](./guides/compilation.md) | Build / compile performance tips |

## Snapshot (from code)

| Metric | Value |
| ------ | ----- |
| Libraries | 23 (1 shared + 22 feature) |
| Lazy routes (`loadComponent`) | 365 |
| Unit specs | ~520 |
| Playwright e2e specs | 2 |
| Coming-soon UIs | media ×4 + 19 file-viewers extras |

## Maintenance rule

- **One topic → one file.** Do not add parallel guides under `apps/` or `libs/`.
- Update the matching file here when behavior changes; regenerate SEO/sitemap via Nx when routes change.
- Prefer linking here from PRs instead of adding new `.md` files elsewhere.
