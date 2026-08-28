# SEO

Site: `https://easytoolhub.com`  
Runtime: `SeoService` + metadata from `App` on every navigation (build-time prerender + browser hydration).

## Automatic behavior

On each route (`app.ts` → `updateSeoForRoute`):

1. `getSeoMetadataForRoute()` (`route-seo.config.ts`)  
2. `SeoService.updateMetadata()` — title, description, keywords, OG, Twitter, canonical  
3. JSON-LD: home → Website (+ SearchAction on `?search=`); category → WebApplication + BreadcrumbList + ItemList; tools → WebApplication + BreadcrumbList  

Static defaults also in `index.html`. `robots.txt` points to `https://easytoolhub.com/sitemap.xml`.

Coming-soon placeholders (`ComingSoonPageComponent` + a few `isComingSoon` tools): **`noindex, follow`** and **omitted from sitemap**.

## `SeoService`

Path: `apps/tools-site/src/app/services/seo.service.ts`

| API | Role |
| --- | ---- |
| `updateMetadata` | Title/meta/OG/canonical/structured data |
| `generateToolStructuredData` | WebApplication |
| `generateBreadcrumbStructuredData` | BreadcrumbList |
| `generateItemListStructuredData` | ItemList (category indexes) |
| `generateWebsiteStructuredData` | WebSite |
| `generateOrganizationStructuredData` | Organization |

Canonical OG image: `https://easytoolhub.com/assets/og-image.svg`.

## Catalogs

| Artifact | Role |
| -------- | ---- |
| `tool-seo-catalog.generated.ts` | Auto SEO — **do not hand-edit** |
| `COMING_SOON_PATHS` (same file) | noindex / sitemap exclusion |
| `route-seo.config.ts` → `SEO_OVERRIDES` | Manual overrides |
| `tools-catalog.generated.ts` | Home/nav catalog |
| `prerender-routes.txt` | Route inventory for CI vs `find … index.html` |

Generator: `apps/tools-site/scripts/generate-tool-seo-catalog.js` (reads `app.routes.ts` + `src/app/routes/*.routes.ts` + enrichment).

Prerender mechanism: hybrid SSG — `RenderMode.Prerender` for home, category indexes, and `/404`; tool pages use `RenderMode.Client` (browser APIs in tool init). Inventory file `prerender-routes.txt` is **not** a build input.

Do **not** add hreflang while UI language is client-side on the same URL. Locale prefixes (`/es/...`) would be a separate project.

Unknown URLs must return **HTTP 404** + NotFound (`noindex, follow`), not a redirect to `/tools`.

```bash
npx nx run tools-site:generate-tool-seo-catalog
npx nx run tools-site:generate-sitemap   # depends on catalog
```

`npm run build` / `build-prod` always regenerates sitemap first.

## Sitemap

`generate-sitemap.js` extracts routes from the app (excluding coming-soon) → `apps/tools-site/public/sitemap.xml`.

## Add SEO for a new tool

1. Add a deep `loadComponent` in `apps/tools-site/src/app/routes/<category>.routes.ts`.  
2. `npx nx run tools-site:generate-sitemap` (or `npm run build`).  
3. Optional: `SEO_OVERRIDES` in `route-seo.config.ts`.  
4. Optional enrichment: `scripts/lib/tool-seo-enrichment.js`.  
5. Verify View Source / Rich Results / `/sitemap.xml`.

## Checklist

- Unique title + description; H1 matches purpose  
- Internal links; image `alt`  
- Keep generators in sync with routes  
- Submit sitemap in Search Console / Bing  
- After deploy: coverage (no soft-404 spike), sitemap count excludes coming-soon and `/404`, view-source unique titles, fake URL returns HTTP 404  

## Troubleshooting

| Issue | Check |
| ----- | ----- |
| Not indexed | robots, sitemap, reachability, no accidental noindex |
| Weak snippets | Overrides / enrichment, regenerate |
| Wrong OG image | Absolute HTTPS URL must match `/assets/og-image.svg` |
| Soft 404s | Remove SPA catch-all rewrites (Vercel); use Apache `.htaccess` pattern |
