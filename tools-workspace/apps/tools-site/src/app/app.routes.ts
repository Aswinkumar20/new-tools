import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: 'tools',
    loadChildren: () => import('./routes/tools.routes').then(m => m.TOOLS_ROUTES),
  },
  {
    path: 'text-utilities',
    loadChildren: () => import('./routes/text-utilities.routes').then(m => m.TEXT_UTILITIES_ROUTES),
  },
  {
    path: 'file-viewers',
    loadChildren: () => import('./routes/file-viewers.routes').then(m => m.FILE_VIEWERS_ROUTES),
  },
  {
    path: 'data-converters',
    loadChildren: () => import('./routes/data-converters.routes').then(m => m.DATA_CONVERTERS_ROUTES),
  },
  {
    path: 'math-date-utils',
    loadChildren: () => import('./routes/math-date-utils.routes').then(m => m.MATH_DATE_UTILS_ROUTES),
  },
  {
    path: 'pdf-tools',
    loadChildren: () => import('./routes/pdf-tools.routes').then(m => m.PDF_TOOLS_ROUTES),
  },
  {
    path: 'image-color-tools',
    loadChildren: () => import('./routes/image-color-tools.routes').then(m => m.IMAGE_COLOR_TOOLS_ROUTES),
  },
  {
    path: 'code-file-tools',
    loadChildren: () => import('./routes/code-file-tools.routes').then(m => m.CODE_FILE_TOOLS_ROUTES),
  },
  {
    path: 'dev-design-tools',
    loadChildren: () => import('./routes/dev-design-tools.routes').then(m => m.DEV_DESIGN_TOOLS_ROUTES),
  },
  {
    path: 'testing-tools',
    loadChildren: () => import('./routes/testing-tools.routes').then(m => m.TESTING_TOOLS_ROUTES),
  },
  {
    path: 'security-tools',
    loadChildren: () => import('./routes/security-tools.routes').then(m => m.SECURITY_TOOLS_ROUTES),
  },
  {
    path: 'media-tools',
    loadChildren: () => import('./routes/media-tools.routes').then(m => m.MEDIA_TOOLS_ROUTES),
  },
  {
    path: 'browser-utils',
    loadChildren: () => import('./routes/browser-utils.routes').then(m => m.BROWSER_UTILS_ROUTES),
  },
  {
    path: 'fun-tools',
    loadChildren: () => import('./routes/fun-tools.routes').then(m => m.FUN_TOOLS_ROUTES),
  },
  {
    path: 'cad-viewers',
    loadChildren: () => import('./routes/cad-viewers.routes').then(m => m.CAD_VIEWERS_ROUTES),
  },
  {
    path: 'gis-viewers',
    loadChildren: () => import('./routes/gis-viewers.routes').then(m => m.GIS_VIEWERS_ROUTES),
  },
  {
    path: 'medical-viewers',
    loadChildren: () => import('./routes/medical-viewers.routes').then(m => m.MEDICAL_VIEWERS_ROUTES),
  },
  {
    path: 'science-viewers',
    loadChildren: () => import('./routes/science-viewers.routes').then(m => m.SCIENCE_VIEWERS_ROUTES),
  },
  {
    path: 'network-viewers',
    loadChildren: () => import('./routes/network-viewers.routes').then(m => m.NETWORK_VIEWERS_ROUTES),
  },
  {
    path: 'process-viewers',
    loadChildren: () => import('./routes/process-viewers.routes').then(m => m.PROCESS_VIEWERS_ROUTES),
  },
  {
    path: 'diagram-viewers',
    loadChildren: () => import('./routes/diagram-viewers.routes').then(m => m.DIAGRAM_VIEWERS_ROUTES),
  },
  {
    path: 'data-explorers',
    loadChildren: () => import('./routes/data-explorers.routes').then(m => m.DATA_EXPLORERS_ROUTES),
  },
  {
    path: 'ml-viewers',
    loadChildren: () => import('./routes/ml-viewers.routes').then(m => m.ML_VIEWERS_ROUTES),
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
