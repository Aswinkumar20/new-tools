# Deployment

## Build output

```bash
npm run build
# equivalent: npx nx run tools-site:build-prod
# (runs generate-sitemap → production SSG)
```

Deploy folder: **`dist/apps/tools-site/browser/`** only. There is **no** Node/Express SSR runtime to deploy.

Put **Cloudflare** (or similar) in front of Apache for global TTFB: long cache on hashed JS/CSS, shorter TTL on HTML, keep `sitemap.xml` / `robots.txt` fresh. Use one HTTPS host (`easytoolhub.com`, not www + apex duplicates).

## Pre-deploy checklist

Confirm in browser dist:

- `/assets/favicon.ico`, `/assets/favicon.svg`, `/assets/logo.svg`, `/assets/og-image.svg`
- `robots.txt`, `sitemap.xml`
- Apache: `.htaccess`
- Netlify: `_headers` (copied from `public/_headers`)
- Vercel: `vercel.json` (**no** SPA catch-all rewrite to `index.html`)

Local smoke:

```bash
npm run serve:ssg
# Hit /assets/og-image.svg /assets/logo.svg → 200, Content-Type image/svg+xml
# Hit /fake-url-test → HTTP 404 (not homepage)
```

## Platforms

| Platform | Notes |
| -------- | ----- |
| Apache | Copy `.htaccess`; enable `mod_mime`, `mod_headers`, `mod_rewrite`, `AllowOverride`. Pretty prerendered folders; `ErrorDocument 404 /404.html` — do not SPA-fallback unknown URLs to `index.html`. |
| Nginx | `location ~* \.svg$ { add_header Content-Type image/svg+xml; ... }` |
| Netlify | Publish `dist/apps/tools-site/browser`; `_headers` for MIME |
| Vercel | Output browser dist; `vercel.json` without catch-all SPA rewrite |
| Cloudflare Pages | Same output; MIME usually OK |
| S3 + CloudFront | Set SVG `Content-Type`; cache headers |

## SVG MIME (Apache)

If SVGs serve as `text/html`:

1. Ensure `.htaccess` from `apps/tools-site/public/` is at site root.  
2. Or vhost: `AddType image/svg+xml .svg` / `ForceType`.  
3. `sudo a2enmod mime headers && sudo systemctl restart apache2`.  
4. Verify: `curl -I https://easytoolhub.com/assets/logo.svg`.

## SVG MIME notes (from prior Netlify/Apache fixes)

- Canonical OG/logo/favicon live under **`/assets/`** (bundled from `apps/tools-site/assets/`).
- Hosting configs (`_headers`, `vercel.json`, `.htaccess`) must target `/assets/*.svg`, not root `/og-image.svg`.

## Post-deploy

- Curl image headers; OG debuggers (Facebook/Twitter/LinkedIn)  
- Rich Results Test; Search Console indexing  
- Align meta OG URLs with real asset paths (`https://easytoolhub.com/assets/og-image.svg`)  
- Confirm unknown paths return **HTTP 404**, not soft-404 homepage

## Related

- [seo.md](./seo.md) — sitemap generation  
- [compilation.md](./compilation.md) — local build speed  
- [../architecture.md](../architecture.md) — SSG overview  
