# Compilation / build performance

Notes for faster local builds of this large Angular + Monaco workspace.

## Known hotspots

| Issue | Detail |
| ----- | ------ |
| Large SCSS | e.g. `generic-styles.scss`, home SCSS, global `styles.scss` |
| Monaco assets | `node_modules/monaco-editor` copied to `assets/monaco-editor` (~50 MB) |
| Large codebase | Many libs and routes |

## Already improved

- Default build configuration: **development** (faster local)  
- Incremental TypeScript (`incremental`, `isolatedModules` in base tsconfig)  

Always pass `--configuration=production` before deploy.

## Recommendations

1. Split large SCSS; prefer `@use` over deep `@import` chains.  
2. Load Monaco only on routes that need it (e.g. text difference).  
3. Use Nx affected:
   ```bash
   npx nx affected -t lint,test
   npx nx graph
   ```
4. Optional: disable source maps in a custom fast-dev config if not debugging.  
5. Avoid weakening `strict` long-term for speed — prefer isolating heavy projects.

## Commands

```bash
npx nx serve tools-site                          # dev
npx nx build tools-site                          # development build
npx nx build tools-site --configuration=production
npx nx serve-ssr tools-site
npx nx run tools-site:generate-sitemap
```

See also root getting-started in [`README.md`](../../README.md).
