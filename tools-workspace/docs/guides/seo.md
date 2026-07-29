# SEO

Site: `https://easytoolhub.com`  
Runtime: `SeoService` + metadata from `App` on every navigation (SSR + browser).

## Automatic behavior

On each route (`app.ts` → `updateSeoForRoute`):

1. `getSeoMetadataForRoute()` (`route-seo.config.ts`)  
2. `SeoService.updateMetadata()` — title, description, keywords, OG, Twitter, canonical  
3. JSON-LD: home → Website; tools → WebApplication + BreadcrumbList  

Static defaults also in `index.html`. `robots.txt` points to `https://easytoolhub.com/sitemap.xml`.

## `SeoService`

Path: `apps/tools-site/src/app/services/seo.service.ts`

| API | Role |
| --- | ---- |
| `updateMetadata` | Title/meta/OG/canonical/structured data |
| `generateToolStructuredData` | WebApplication |
| `generateBreadcrumbStructuredData` | BreadcrumbList |
| `generateWebsiteStructuredData` | WebSite |
| `generateOrganizationStructuredData` | Organization |

Align OG image URL with the file actually deployed (`public/og-image.svg` vs `/assets/og-image.svg` meta).

## Catalogs

| Artifact | Role |
| -------- | ---- |
| `tool-seo-catalog.generated.ts` | Auto SEO — **do not hand-edit** |
| `route-seo.config.ts` → `SEO_OVERRIDES` | Manual overrides |
| `tools-catalog.generated.ts` | Home/nav catalog |
| `prerender-routes.txt` | Prerender list |

Generator: `apps/tools-site/scripts/generate-tool-seo-catalog.js` (reads `app.routes.ts` + enrichment).

```bash
npx nx run tools-site:generate-tool-seo-catalog
npx nx run tools-site:generate-sitemap   # depends on catalog
```

Build/prerender depend on sitemap generation.

## Sitemap

`generate-sitemap.js` extracts routes from the app (not a hand-edited URL list) → `apps/tools-site/public/sitemap.xml`.

## Add SEO for a new tool

1. Add route in `app.routes.ts`.  
2. `npx nx run tools-site:generate-sitemap` (or production build).  
3. Optional: `SEO_OVERRIDES` in `route-seo.config.ts`.  
4. Optional enrichment: `scripts/lib/tool-seo-enrichment.js`.  
5. Verify View Source / Rich Results / `/sitemap.xml`.

## Checklist

- Unique title + description; H1 matches purpose  
- Internal links; image `alt`  
- Keep generators in sync with routes  
- Submit sitemap in Search Console / Bing  

## Troubleshooting

| Issue | Check |
| ----- | ----- |
| Not indexed | robots, sitemap, reachability, no accidental noindex |
| Weak snippets | Overrides / enrichment, regenerate |
| Wrong OG image | Absolute HTTPS URL must match deployed asset |
