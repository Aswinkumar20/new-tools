import { Routes } from '@angular/router';

const category = (path: string, loader: () => Promise<Routes>): Routes[number] => ({
  path,
  loadChildren: loader,
  data: { preloadCategory: true },
});

export const appRoutes: Routes = [
  {
    path: 'tools',
    loadChildren: () => import('./routes/tools.routes').then(m => m.TOOLS_ROUTES),
  },
  category('text-utilities', () => import('./routes/text-utilities.routes').then(m => m.TEXT_UTILITIES_ROUTES)),
  category('file-viewers', () => import('./routes/file-viewers.routes').then(m => m.FILE_VIEWERS_ROUTES)),
  category('data-converters', () => import('./routes/data-converters.routes').then(m => m.DATA_CONVERTERS_ROUTES)),
  category('math-date-utils', () => import('./routes/math-date-utils.routes').then(m => m.MATH_DATE_UTILS_ROUTES)),
  category('pdf-tools', () => import('./routes/pdf-tools.routes').then(m => m.PDF_TOOLS_ROUTES)),
  category('image-color-tools', () => import('./routes/image-color-tools.routes').then(m => m.IMAGE_COLOR_TOOLS_ROUTES)),
  category('code-file-tools', () => import('./routes/code-file-tools.routes').then(m => m.CODE_FILE_TOOLS_ROUTES)),
  category('dev-design-tools', () => import('./routes/dev-design-tools.routes').then(m => m.DEV_DESIGN_TOOLS_ROUTES)),
  category('testing-tools', () => import('./routes/testing-tools.routes').then(m => m.TESTING_TOOLS_ROUTES)),
  category('security-tools', () => import('./routes/security-tools.routes').then(m => m.SECURITY_TOOLS_ROUTES)),
  category('media-tools', () => import('./routes/media-tools.routes').then(m => m.MEDIA_TOOLS_ROUTES)),
  category('browser-utils', () => import('./routes/browser-utils.routes').then(m => m.BROWSER_UTILS_ROUTES)),
  category('fun-tools', () => import('./routes/fun-tools.routes').then(m => m.FUN_TOOLS_ROUTES)),
  category('cad-viewers', () => import('./routes/cad-viewers.routes').then(m => m.CAD_VIEWERS_ROUTES)),
  category('gis-viewers', () => import('./routes/gis-viewers.routes').then(m => m.GIS_VIEWERS_ROUTES)),
  category('medical-viewers', () => import('./routes/medical-viewers.routes').then(m => m.MEDICAL_VIEWERS_ROUTES)),
  category('science-viewers', () => import('./routes/science-viewers.routes').then(m => m.SCIENCE_VIEWERS_ROUTES)),
  category('network-viewers', () => import('./routes/network-viewers.routes').then(m => m.NETWORK_VIEWERS_ROUTES)),
  category('process-viewers', () => import('./routes/process-viewers.routes').then(m => m.PROCESS_VIEWERS_ROUTES)),
  category('diagram-viewers', () => import('./routes/diagram-viewers.routes').then(m => m.DIAGRAM_VIEWERS_ROUTES)),
  category('data-explorers', () => import('./routes/data-explorers.routes').then(m => m.DATA_EXPLORERS_ROUTES)),
  category('ml-viewers', () => import('./routes/ml-viewers.routes').then(m => m.ML_VIEWERS_ROUTES)),
  {
    path: 'about',
    loadComponent: () =>
      import('@tools-workspace/features-home/about-page/about-page').then(m => m.AboutPageComponent),
  },
  {
    path: 'contact',
    redirectTo: 'about',
    pathMatch: 'full',
  },
  { path: '', redirectTo: 'tools', pathMatch: 'full' },
  {
    path: '404',
    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFoundComponent),
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFoundComponent),
  },
];
