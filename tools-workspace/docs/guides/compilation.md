# Compilation / build performance

EasyToolHub uses Angular 20 `@angular/build:application` (esbuild), not the webpack `browser` builder.

## Local vs production (one codebase, two configs)

| Command | Config | Behavior |
| --- | --- | --- |
| `npx nx serve tools-site` / `npm start` | `development` | CSR only, no prerender, `sourceMap: false`, ~4GB Node heap |
| `npx nx serve-ssr tools-site` | `ssr-dev` | SSR without prerender |
| `npx nx run tools-site:build-prod` | `production` | Prerender every sitemap URL (tools + category indexes). Use a **16GB** machine |

Heap: `.npmrc` + `apps/tools-site/.env` set `NODE_OPTIONS=--max-old-space-size=4096`. On a very tight 8GB laptop you can also set `NG_BUILD_MAX_WORKERS=1`.

## Known hotspots

- Large SCSS (`generic-styles.scss`, home, global styles)
- Monaco loaded only on the text-difference route (`provideMonacoEditor` on that route; assets = `monaco-editor/min/vs`)
- Many libs/routes — each tool is a deep `loadComponent`, not a library barrel

## Commands

```bash
npx nx serve tools-site
npx nx run tools-site:generate-sitemap
npx nx build tools-site --configuration=production
npx nx serve-ssr tools-site
```

See also [`README.md`](../../README.md).
