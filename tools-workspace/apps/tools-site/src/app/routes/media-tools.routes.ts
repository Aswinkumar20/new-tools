import { Routes } from '@angular/router';

export const MEDIA_TOOLS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'voice-recorder',
    loadComponent: () =>
      import('@tools-workspace/media-tools/voice-recorder/voice-recorder').then(m => m.VoiceRecorderComponent),
  },
  {
    path: 'audio-player',
    loadComponent: () =>
      import('@tools-workspace/media-tools/audio-player/audio-player').then(m => m.AudioPlayerComponent),
  },
  {
    path: 'audio-trimmer',
    loadComponent: () =>
      import('@tools-workspace/media-tools/audio-trimmer/audio-trimmer').then(m => m.AudioTrimmerComponent),
  },
  {
    path: 'video-to-gif',
    loadComponent: () =>
      import('@tools-workspace/media-tools/video-to-gif/video-to-gif').then(m => m.VideoToGifComponent),
  },
  {
    path: 'webcam-snapshot',
    loadComponent: () =>
      import('@tools-workspace/media-tools/webcam-snapshot/webcam-snapshot').then(m => m.WebcamSnapshotComponent),
  },
];
