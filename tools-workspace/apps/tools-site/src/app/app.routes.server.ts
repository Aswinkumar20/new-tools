import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Hybrid SSG (`outputMode: "static"`) — deploy `dist/.../browser` only, no Node server.
 *
 * - Home + category indexes + 404: prerendered HTML (crawlable SEO).
 * - Individual tool URLs: Client (SPA shell). Tools touch canvas/PDF.js/Monaco/etc.
 *   in lifecycle hooks; full `**` prerender fails those routes.
 *
 * `prerender-routes.txt` remains a full URL inventory for sitemap/CI — not a build input.
 */
const CATEGORY_PRERENDER_PATHS = [
  'browser-utils',
  'cad-viewers',
  'code-file-tools',
  'data-converters',
  'data-explorers',
  'dev-design-tools',
  'diagram-viewers',
  'file-viewers',
  'fun-tools',
  'gis-viewers',
  'image-color-tools',
  'math-date-utils',
  'media-tools',
  'medical-viewers',
  'ml-viewers',
  'network-viewers',
  'pdf-tools',
  'process-viewers',
  'science-viewers',
  'security-tools',
  'testing-tools',
  'text-utilities',
] as const;

export const serverRoutes: ServerRoute[] = [
  {
    path: '404',
    renderMode: RenderMode.Prerender,
  },
  // Nested under loadChildren('tools') — needs getPrerenderParams for SSG discovery.
  {
    path: 'tools/**',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return [{ '**': 'home' }];
    },
  },
  ...CATEGORY_PRERENDER_PATHS.map(
    (path): ServerRoute => ({
      path,
      renderMode: RenderMode.Prerender,
    }),
  ),
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
