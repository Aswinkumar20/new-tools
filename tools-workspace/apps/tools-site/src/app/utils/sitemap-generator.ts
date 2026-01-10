import { appRoutes } from '../app.routes';
import { Routes } from '@angular/router';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

/**
 * Extract all routes from Angular routes configuration
 */
function extractRoutes(routes: Routes, basePath: string = ''): string[] {
  const paths: string[] = [];

  for (const route of routes) {
    if (route.path) {
      const fullPath = basePath ? `${basePath}/${route.path}` : `/${route.path}`;
      
      // Skip redirects and wildcards
      if (route.path !== '**' && !route.redirectTo) {
        // Clean up the path
        const cleanPath = fullPath
          .replace(/\/+/g, '/') // Remove duplicate slashes
          .replace(/\/$/, '') || '/'; // Remove trailing slash
        
        // Only add if it's a valid route (not just a parent route)
        if (route.children && route.children.length > 0) {
          // Recursively get child routes
          const childPaths = extractRoutes(route.children, cleanPath);
          paths.push(...childPaths);
        } else if (route.loadComponent || route.component) {
          // This is a leaf route
          paths.push(cleanPath);
        }
      }
    }
  }

  return paths;
}

/**
 * Generate sitemap XML content
 */
export function generateSitemap(baseUrl: string = 'https://easytoolhub.com'): string {
  const routes = extractRoutes(appRoutes);
  
  // Remove duplicates and sort
  const uniqueRoutes = Array.from(new Set(routes)).sort();
  
  // Add home page explicitly
  const allRoutes = ['/tools/home', ...uniqueRoutes.filter(r => r !== '/tools/home')];

  const urls: SitemapUrl[] = allRoutes.map((route) => {
    // Determine priority and changefreq based on route
    let priority = 0.8;
    let changefreq: SitemapUrl['changefreq'] = 'weekly';

    if (route === '/tools/home') {
      priority = 1.0;
      changefreq = 'daily';
    } else if (route.includes('/tools/')) {
      priority = 0.9;
      changefreq = 'weekly';
    } else if (route.split('/').length <= 2) {
      // Category pages
      priority = 0.9;
      changefreq = 'weekly';
    }

    return {
      loc: `${baseUrl}${route}`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq,
      priority,
    };
  });

  // Generate XML
  const xmlUrls = urls
    .map(
      (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority !== undefined ? `<priority>${url.priority}</priority>` : ''}
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get all routes as an array (for other uses)
 */
export function getAllRoutes(): string[] {
  const routes = extractRoutes(appRoutes);
  return Array.from(new Set(['/tools/home', ...routes.filter(r => r !== '/tools/home')])).sort();
}

