# Deployment Checklist - Image Assets

## ✅ Pre-Deployment Verification

### 1. Build Output Verification
After building, verify these files exist in `dist/apps/tools-site/browser/`:
- ✅ `/favicon.ico`
- ✅ `/favicon.svg`
- ✅ `/logo.svg`
- ✅ `/og-image.svg`
- ✅ `/robots.txt`

### 2. Test Locally
```bash
# Build the project
npm run build
# or
nx build tools-site

# Serve the built files
nx serve-static tools-site

# Test these URLs in browser:
# http://localhost:4200/og-image.svg
# http://localhost:4200/logo.svg
# http://localhost:4200/favicon.svg
```

### 3. Verify Image Accessibility
- Open browser DevTools → Network tab
- Check that images return `200 OK` status
- Verify `Content-Type: image/svg+xml` header for SVG files

---

## 🚀 Platform-Specific Deployment

### For Apache/Shared Hosting
1. ✅ `.htaccess` file is included (handles MIME types)
2. ✅ Files are in root directory after build
3. ✅ Verify Apache has `mod_mime` enabled

### For Netlify
1. ✅ `_headers` file is included
2. ✅ Files are in `public` folder (already configured)
3. ✅ Build command: `nx build tools-site`
4. ✅ Publish directory: `dist/apps/tools-site/browser`

### For Vercel
1. ✅ `vercel.json` is included
2. ✅ Files are in root after build
3. ✅ Build command: `nx build tools-site`
4. ✅ Output directory: `dist/apps/tools-site/browser`

### For Nginx
Add to your nginx config:
```nginx
location ~* \.svg$ {
    add_header Content-Type image/svg+xml;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### For Cloudflare Pages
1. ✅ Files are in root after build
2. ✅ Build command: `nx build tools-site`
3. ✅ Output directory: `dist/apps/tools-site/browser`
4. Cloudflare automatically handles SVG MIME types

### For AWS S3 + CloudFront
1. ✅ Set `Content-Type: image/svg+xml` for `.svg` files
2. ✅ Enable CORS if needed
3. ✅ Set cache headers

---

## 🔍 Post-Deployment Verification

### 1. Test Image URLs
Visit these URLs after deployment:
- `https://easytoolhub.com/og-image.svg`
- `https://easytoolhub.com/logo.svg`
- `https://easytoolhub.com/favicon.svg`

### 2. Test Open Graph
Use these tools to verify:
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

### 3. Check Google Search
- Use [Google Rich Results Test](https://search.google.com/test/rich-results)
- Submit URL to Google Search Console
- Request indexing

### 4. Verify Headers
Check HTTP headers:
```bash
curl -I https://easytoolhub.com/og-image.svg
# Should return:
# Content-Type: image/svg+xml
# Cache-Control: public, max-age=31536000, immutable
```

---

## 🐛 Troubleshooting

### Images Not Loading
1. **Check file paths**: Ensure files are in root of dist folder
2. **Check MIME types**: Server must serve SVG as `image/svg+xml`
3. **Check CORS**: If loading from different domain, enable CORS
4. **Check cache**: Clear browser cache and CDN cache

### Open Graph Not Working
1. **Absolute URLs**: Ensure URLs use `https://easytoolhub.com/`
2. **File accessibility**: Images must be publicly accessible
3. **Cache**: Clear Facebook/Twitter cache using their debuggers
4. **File size**: Keep images under 8MB for social platforms

### 404 Errors
1. **Build output**: Verify files exist in `dist/apps/tools-site/browser/`
2. **Server config**: Ensure server serves static files from root
3. **Base href**: Check `<base href="/">` in index.html

---

## 📝 Build Configuration

The build is configured in `project.json`:
```json
{
  "glob": "**/*",
  "input": "apps/tools-site/public",
  "output": "/"
}
```

This copies all files from `public` folder to root of dist folder.

---

## ✅ Final Checklist

Before deploying:
- [ ] Build completes successfully
- [ ] Images exist in `dist/apps/tools-site/browser/`
- [ ] Test images load locally
- [ ] Verify MIME types are correct
- [ ] Check file sizes (keep under 8MB)
- [ ] Test Open Graph with debuggers
- [ ] Verify absolute URLs in meta tags
- [ ] Check robots.txt is accessible

After deploying:
- [ ] Test image URLs work
- [ ] Verify Open Graph preview
- [ ] Check Google Search Console
- [ ] Test on mobile devices
- [ ] Verify social sharing works

---

## 🎯 Quick Test Commands

```bash
# Build
nx build tools-site

# Check if files exist
ls -la dist/apps/tools-site/browser/*.svg
ls -la dist/apps/tools-site/browser/*.ico

# Test locally
nx serve-static tools-site

# Test image (in browser)
# http://localhost:4200/og-image.svg
```

---

**All images are configured to work in production!** 🚀

