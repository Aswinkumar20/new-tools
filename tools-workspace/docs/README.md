# EasyToolHub documentation

All project documentation lives in this folder. The root [`README.md`](../README.md) is the short getting-started entry point only.

## Index

| Doc | Contents |
| --- | -------- |
| [architecture.md](./architecture.md) | Purpose, stack, folders, runtime architecture, state, diagrams |
| [features.md](./features.md) | Feature categories, user flows, tool status summary |
| [tools-inventory.md](./tools-inventory.md) | **Full catalog of all 365 tools** — live, coming soon, partial, per-category roadmap |
| [components.md](./components.md) | Shell, shared bases, component catalog by library |
| [api.md](./api.md) | HTTP, CDN, WebSocket, analytics endpoints |
| [quality.md](./quality.md) | Code quality, debt, testing, future work |
| [future-file-viewers.md](./future-file-viewers.md) | Long-form viewer roadmap by vertical |
| [guides/analytics.md](./guides/analytics.md) | Google Analytics (canonical) |
| [guides/seo.md](./guides/seo.md) | SEO, sitemap, catalogs (canonical) |
| [guides/deployment.md](./guides/deployment.md) | Static SSG + tool-api deploy, proxy `/api`, engines |
| [guides/compilation.md](./guides/compilation.md) | UI SSG build, PDF registry regen, Maven/API build |

## Snapshot (August 2026)

| Metric | Value |
| ------ | ----- |
| Libraries | 23 (1 shared + 22 feature) |
| Routed tools | **365** |
| Live tools | **343** |
| Coming soon | **23** (placeholder pages or stub components) |
| Partial (incomplete UI) | **3** (media audio player, unit-converter history, BPMN text-to-diagram) |
| Prerender URLs | 387 |
| Unit specs | ~520 |
| Playwright e2e | Smoke + deep tool audit suites |

## Tool status at a glance

| Category | Live | Coming soon | Partial |
| -------- | ---- | ----------- | ------- |
| browser-utils | 6 | — | — |
| cad-viewers | 29 | — | — |
| code-file-tools | 9 | — | — |
| data-converters | 8 | — | — |
| data-explorers | 15 | — | — |
| dev-design-tools | 12 | — | — |
| diagram-viewers | 29 | — | — |
| file-viewers | 26 | 20 | — |
| fun-tools | 11 | — | — |
| gis-viewers | 20 | — | — |
| image-color-tools | 10 | — | — |
| math-date-utils | 13 | — | 1 (unit-converter history) |
| media-tools | 2 | 3 | 1 (audio player) |
| medical-viewers | 18 | — | — |
| ml-viewers | 9 | — | — |
| network-viewers | 17 | — | — |
| pdf-tools | 31 | — | — |
| process-viewers | 15 | — | 1 (BPMN text-to-diagram) |
| science-viewers | 20 | — | — |
| security-tools | 7 | — | — |
| testing-tools | 6 | — | — |
| text-utilities | 30 | — | — |

See [tools-inventory.md](./tools-inventory.md) for every tool name, route, and implementation notes.

## Maintenance rule

- **One topic → one file.** Do not add parallel guides under `apps/` or `libs/`.
- Update the matching file here when behavior changes; regenerate SEO/sitemap via Nx when routes change.
- After adding or changing routes, run `npx nx run tools-site:generate-tool-seo-catalog` and update [tools-inventory.md](./tools-inventory.md) if status changed.
- Prefer linking here from PRs instead of adding new `.md` files elsewhere.
