# Compilation / build performance

EasyToolHub uses Angular 20 `@angular/build:application` (esbuild) with **SSG** (`outputMode: "static"`). Production deploys static files only — no Node SSR runtime.

## Local vs production

| Command | Config | Behavior |
| --- | --- | --- |
| `npm start` / `npx nx serve tools-site` | `development` | Fast CSR for coding (no prerender) |
| `npm run build` / `build-prod` | `production` | Hybrid SSG: sitemap regen + prerender home/categories/404 → `dist/apps/tools-site/browser` |
| `npm run serve:ssg` | preview | Serve the static SSG output locally |

Heap: `.npmrc` + `apps/tools-site/.env` set `NODE_OPTIONS=--max-old-space-size=4096`. On a tight laptop use `NG_BUILD_MAX_WORKERS=1`. Prefer a **16GB** machine for full production SSG.

## Commands

```bash
npm start
npx nx run tools-site:generate-sitemap
npm run build
npm run serve:ssg
```

See also [`README.md`](../../README.md) and [`deployment.md`](./deployment.md).
