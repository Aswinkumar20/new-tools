import 'zone.js/node';

import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr/node';
import * as express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import bootstrap from './main.server';

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), 'dist/apps/tools-site/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? join(distFolder, 'index.original.html')
    : join(distFolder, 'index.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  
  // Serve sitemap.xml from dist folder (copied during build)
  const sitemapPath = join(distFolder, 'sitemap.xml');
  if (existsSync(sitemapPath)) {
    server.get('/sitemap.xml', (req, res) => {
      res.setHeader('Content-Type', 'application/xml');
      res.sendFile(sitemapPath);
    });
  }
  
  // Serve robots.txt from dist folder (copied during build)
  const robotsPath = join(distFolder, 'robots.txt');
  if (existsSync(robotsPath)) {
    server.get('/robots.txt', (req, res) => {
      res.setHeader('Content-Type', 'text/plain');
      res.sendFile(robotsPath);
    });
  }
  
  // IMPORTANT: Serve static files BEFORE Angular routing to prevent asset requests
  // from being caught by Angular router (which returns index.html)
  // This must come BEFORE the catch-all route to ensure assets are served correctly
  server.use(
    express.static(distFolder, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, path) => {
        // Set proper MIME types for different file types
        if (path.endsWith('.svg')) {
          res.setHeader('Content-Type', 'image/svg+xml');
        } else if (path.endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (path.endsWith('.gif')) {
          res.setHeader('Content-Type', 'image/gif');
        } else if (path.endsWith('.webp')) {
          res.setHeader('Content-Type', 'image/webp');
        } else if (path.endsWith('.ico')) {
          res.setHeader('Content-Type', 'image/x-icon');
        } else if (path.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json');
        }
        
        // Cache control for static assets
        if (path.match(/\.(svg|png|jpg|jpeg|gif|ico|webp|woff|woff2|ttf|eot)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (path.match(/\.(css|js)$/)) {
          // For CSS/JS with hash in filename (production build), cache for 1 year
          // Otherwise, cache for 1 hour in development
          if (path.match(/\.[a-f0-9]{8,}\.(css|js)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=3600');
          }
        }
      },
    })
  );

  // All regular routes use the Angular engine (this is a catch-all)
  // Static files are served above, so this only handles Angular routes
  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: distFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = (mainModule && mainModule.filename) || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export default bootstrap;
