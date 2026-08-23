import { Routes } from '@angular/router';

export const IMAGE_COLOR_TOOLS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'image-to-base64',
    loadComponent: () =>
      import('@tools-workspace/image-color-tools/image-to-base64/image-to-base64').then(m => m.ImageToBase64Component),
  },
  {
    path: 'image-resizer',
    loadComponent: () =>
      import('@tools-workspace/image-color-tools/image-resizer/image-resizer').then(m => m.ImageResizerComponent),
  },
  {
    path: 'image-compressor',
    loadComponent: () =>
      import('@tools-workspace/image-color-tools/image-compressor/image-compressor').then(m => m.ImageCompressorComponent),
  },
  {
    path: 'color-picker',
    loadComponent: () =>
      import('@tools-workspace/image-color-tools/color-picker/color-picker').then(m => m.ColorPickerComponent),
  },
  {
    path: 'hex-to-rgb',
    loadComponent: () =>
      import('@tools-workspace/image-color-tools/hex-to-rgb/hex-to-rgb').then(m => m.HexToRgbComponent),
  },
  {
    path: 'gradient-generator',
    loadComponent: () =>
      import('@tools-workspace/image-color-tools/gradient-generator/gradient-generator').then(m => m.GradientGeneratorComponent),
  },
  {
    path: 'palette-generator',
    loadComponent: () =>
      import('@tools-workspace/image-color-tools/palette-generator/palette-generator').then(m => m.PaletteGeneratorComponent),
  },
  {
    path: 'image-to-text',
    loadComponent: () =>
      import('@tools-workspace/image-color-tools/image-to-text/image-to-text').then(m => m.ImageToTextComponent),
  },
  {
    path: 'favicon-generator',
    loadComponent: () =>
      import('@tools-workspace/image-color-tools/favicon-generator/favicon-generator').then(m => m.FaviconGeneratorComponent),
  },
  {
    path: 'drawing-pad',
    loadComponent: () =>
      import('@tools-workspace/image-color-tools/drawing-pad/drawing-pad').then(m => m.DrawingPadComponent),
  },
];
