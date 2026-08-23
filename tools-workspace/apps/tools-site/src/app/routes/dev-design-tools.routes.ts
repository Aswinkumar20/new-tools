import { Routes } from '@angular/router';

export const DEV_DESIGN_TOOLS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'css-gradient-generator',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/css-gradient-generator/css-gradient-generator').then(m => m.CssGradientGeneratorComponent),
  },
  {
    path: 'box-shadow-generator',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/box-shadow-generator/box-shadow-generator').then(m => m.BoxShadowGeneratorComponent),
  },
  {
    path: 'border-radius-preview',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/border-radius-preview/border-radius-preview').then(m => m.BorderRadiusPreviewComponent),
  },
  {
    path: 'pixel-to-rem',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/pixel-to-rem/pixel-to-rem').then(m => m.PixelToRemComponent),
  },
  {
    path: 'responsive-breakpoint-tester',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/responsive-breakpoint-tester/responsive-breakpoint-tester').then(m => m.ResponsiveBreakpointTesterComponent),
  },
  {
    path: 'viewport-size-detector',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/viewport-size-detector/viewport-size-detector').then(m => m.ViewportSizeDetectorComponent),
  },
  {
    path: 'postman-lite',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/postman-lite/postman-lite').then(m => m.PostmanLiteComponent),
  },
  {
    path: 'cors-test-tool',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/cors-test-tool/cors-test-tool').then(m => m.CorsTestToolComponent),
  },
  {
    path: 'http-header-decoder',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/http-header-decoder/http-header-decoder').then(m => m.HttpHeaderDecoderComponent),
  },
  {
    path: 'websocket-client',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/websocket-client/websocket-client').then(m => m.WebSocketClientComponent),
  },
  {
    path: 'http-request-generator',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/http-request-generator/http-request-generator').then(m => m.HttpRequestGeneratorComponent),
  },
  {
    path: 'mock-json-generator',
    loadComponent: () =>
      import('@tools-workspace/dev-design-tools/mock-json-generator/mock-json-generator').then(m => m.MockJsonGeneratorComponent),
  },
];
