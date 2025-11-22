# SVG MIME Type Fix for Apache Server

## Problem
SVG files are being served as `text/html` instead of `image/svg+xml` on the server.

## Solution

### Option 1: Update .htaccess (Recommended)
The `.htaccess` file in the `public` folder has been updated with multiple methods to force the correct MIME type. Make sure this file is copied to your server's root directory (`/var/www/easytoolhub.com/html/`).

### Option 2: Server Configuration (If .htaccess doesn't work)
If `.htaccess` is not working, you may need to add this to your Apache virtual host configuration:

```apache
<Directory /var/www/easytoolhub.com/html>
    # Force SVG MIME type
    <FilesMatch "\.svg$">
        ForceType image/svg+xml
    </FilesMatch>
    
    # Or use AddType
    AddType image/svg+xml .svg
</Directory>
```

### Option 3: Check Apache Modules
Make sure these Apache modules are enabled:
```bash
sudo a2enmod mime
sudo a2enmod headers
sudo systemctl restart apache2
```

### Option 4: Verify .htaccess is being read
Add this to your `.htaccess` to test if it's being processed:
```apache
# Test - this should cause an error if .htaccess is working
# Remove after testing
# <IfModule mod_rewrite.c>
#   RewriteEngine On
#   RewriteRule ^test$ - [F]
# </IfModule>
```

## Deployment Steps

1. **Copy .htaccess to server:**
   ```bash
   # On your local machine, after building:
   scp apps/tools-site/public/.htaccess user@server:/var/www/easytoolhub.com/html/
   ```

2. **Verify file permissions:**
   ```bash
   chmod 644 /var/www/easytoolhub.com/html/.htaccess
   ```

3. **Test SVG file:**
   ```bash
   curl -I https://easytoolhub.com/assets/icons/copy.svg
   # Should show: Content-Type: image/svg+xml
   ```

4. **Clear browser cache** and test again.

## Verification

After deployment, check the response headers:
```bash
curl -I https://easytoolhub.com/assets/icons/copy.svg
```

Expected output:
```
HTTP/1.1 200 OK
Content-Type: image/svg+xml
...
```

If it still shows `text/html`, the server might be:
- Not reading `.htaccess` files (check `AllowOverride` in Apache config)
- Using a different web server (Nginx, etc.)
- Has caching that needs to be cleared

