import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = existsSync(join(browserDistFolder, 'index.original.html'))
  ? join(browserDistFolder, 'index.original.html')
  : join(browserDistFolder, 'index.html');
const notFoundHtml = existsSync(join(browserDistFolder, '404.html'))
  ? join(browserDistFolder, '404.html')
  : indexHtml;

const app = express();
const angularApp = new AngularNodeAppEngine();

app.get('/sitemap.xml', (req, res, next) => {
  const sitemapPath = join(browserDistFolder, 'sitemap.xml');
  if (!existsSync(sitemapPath)) {
    return next();
  }
  res.setHeader('Content-Type', 'application/xml');
  return res.sendFile(sitemapPath);
});

app.get('/robots.txt', (req, res, next) => {
  const robotsPath = join(browserDistFolder, 'robots.txt');
  if (!existsSync(robotsPath)) {
    return next();
  }
  res.setHeader('Content-Type', 'text/plain');
  return res.sendFile(robotsPath);
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      } else if (filePath.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (filePath.endsWith('.gif')) {
        res.setHeader('Content-Type', 'image/gif');
      } else if (filePath.endsWith('.webp')) {
        res.setHeader('Content-Type', 'image/webp');
      } else if (filePath.endsWith('.ico')) {
        res.setHeader('Content-Type', 'image/x-icon');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json');
      }

      if (filePath.match(/\.(svg|png|jpg|jpeg|gif|ico|webp|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.match(/\.(css|js)$/)) {
        if (filePath.match(/\.[a-f0-9]{8,}\.(css|js)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      }
    },
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => {
      if (response) {
        return writeResponseToNodeResponse(response, res);
      }
      res.status(404);
      return res.sendFile(notFoundHtml);
    })
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
