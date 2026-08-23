import { Routes } from '@angular/router';

export const BROWSER_UTILS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'screen-resolution-info',
    loadComponent: () =>
      import('@tools-workspace/browser-utils/screen-resolution-info/screen-resolution-info').then(m => m.ScreenResolutionInfoComponent),
  },
  {
    path: 'battery-status-viewer',
    loadComponent: () =>
      import('@tools-workspace/browser-utils/battery-status-viewer/battery-status-viewer').then(m => m.BatteryStatusViewerComponent),
  },
  {
    path: 'device-orientation-logger',
    loadComponent: () =>
      import('@tools-workspace/browser-utils/device-orientation-logger/device-orientation-logger').then(m => m.DeviceOrientationLoggerComponent),
  },
  {
    path: 'storage-viewer',
    loadComponent: () =>
      import('@tools-workspace/browser-utils/storage-viewer/storage-viewer').then(m => m.StorageViewerComponent),
  },
  {
    path: 'cookie-editor',
    loadComponent: () =>
      import('@tools-workspace/browser-utils/cookie-editor/cookie-editor').then(m => m.CookieEditorComponent),
  },
  {
    path: 'network-speed-test',
    loadComponent: () =>
      import('@tools-workspace/browser-utils/network-speed-test/network-speed-test').then(m => m.NetworkSpeedTestComponent),
  },
];
