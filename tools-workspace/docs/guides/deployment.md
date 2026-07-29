# Deployment

## Build output

```bash
npx nx build tools-site --configuration=production
# or prerender:
npx nx run tools-site:build-prod
```

Deploy folder: `dist/apps/tools-site/browser/` (SPA). SSR server: `dist/apps/tools-site/server/` via `npx nx server tools-site`.

## Pre-deploy checklist

Confirm in browser dist:

- `favicon.ico`, `favicon.svg`, `logo.svg`, `og-image.svg`
- `robots.txt`, `sitemap.xml`
- Apache: `.htaccess`
- Netlify: `_headers`
- Vercel: `vercel.json`

Local smoke:

```bash
npx nx serve-static tools-site
# Hit /og-image.svg /logo.svg /favicon.svg → 200, Content-Type image/svg+xml
```

## Platforms

| Platform | Notes |
| -------- | ----- |
| Apache | Copy `.htaccess`; enable `mod_mime`, `mod_headers`, `AllowOverride` |
| Nginx | `location ~* \.svg$ { add_header Content-Type image/svg+xml; ... }` |
| Netlify | Publish `dist/apps/tools-site/browser`; `_headers` for MIME |
| Vercel | Output browser dist; `vercel.json` |
| Cloudflare Pages | Same output; MIME usually OK |
| S3 + CloudFront | Set SVG `Content-Type`; cache headers |

Build command pattern: `npx nx build tools-site --configuration=production`.

## SVG MIME (Apache)

If SVGs serve as `text/html`:

1. Ensure `.htaccess` from `apps/tools-site/public/` is at site root.  
2. Or vhost: `AddType image/svg+xml .svg` / `ForceType`.  
3. `sudo a2enmod mime headers && sudo systemctl restart apache2`.  
4. Verify: `curl -I https://easytoolhub.com/logo.svg`.

## Post-deploy

- Curl image headers; OG debuggers (Facebook/Twitter/LinkedIn)  
- Rich Results Test; Search Console indexing  
- Align meta OG URLs with real asset paths  
- SSR: `PORT` env (default 4000) for Express

## Related

- [seo.md](./seo.md) — sitemap generation  
- [compilation.md](./compilation.md) — local build speed  
- [../architecture.md](../architecture.md) — SSR overview  
