import { Routes } from '@angular/router';

export const FILE_VIEWERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'image-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/image-viewer/image-viewer').then(m => m.ImageViewerComponent),
  },
  {
    path: 'pdf-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/pdf-viewer/pdf-viewer').then(m => m.FileViewerPdfViewerComponent),
  },
  {
    path: 'word-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/word-viewer/word-viewer').then(m => m.FileViewerWordViewerComponent),
  },
  {
    path: 'powerpoint-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/powerpoint-viewer/powerpoint-viewer').then(m => m.PowerpointViewerComponent),
  },
  {
    path: 'text-file-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/text-file-viewer/text-file-viewer').then(m => m.TextFileViewerComponent),
  },
  {
    path: 'markdown-previewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/markdown-previewer/markdown-previewer').then(m => m.MarkdownPreviewerComponent),
  },
  {
    path: 'excel-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/excel-viewer/excel-viewer').then(m => m.ExcelViewerComponent),
  },
  {
    path: 'log-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/log-viewer/log-viewer').then(m => m.LogViewerComponent),
  },
  {
    path: 'audio-player',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/audio-player/audio-player').then(m => m.FileViewerAudioPlayerComponent),
  },
  {
    path: 'video-player',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/video-player/video-player').then(m => m.VideoPlayerComponent),
  },
  {
    path: 'font-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/font-viewer/font-viewer').then(m => m.FontViewerComponent),
  },
  {
    path: '3d-model-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/3d-model-viewer/3d-model-viewer').then(m => m.Model3dViewerComponent),
  },
  {
    path: 'archive-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/archive-viewer/archive-viewer').then(m => m.ArchiveViewerComponent),
  },
  {
    path: 'xes-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/xes-viewer/xes-viewer').then(m => m.XesViewerComponent),
  },
  {
    path: 'epub-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/epub-viewer/epub-viewer').then(m => m.EpubViewerComponent),
  },
  {
    path: 'mobi-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/mobi-viewer/mobi-viewer').then(m => m.MobiViewerComponent),
  },
  {
    path: 'latex-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/latex-viewer/latex-viewer').then(m => m.LatexViewerComponent),
  },
  {
    path: 'svg-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/svg-viewer/svg-viewer').then(m => m.SvgViewerComponent),
  },
  {
    path: 'psd-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/psd-viewer/psd-viewer').then(m => m.PsdViewerComponent),
  },
  {
    path: 'ai-file-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/ai-file-viewer/ai-file-viewer').then(m => m.AiFileViewerComponent),
  },
  {
    path: 'heic-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/heic-viewer/heic-viewer').then(m => m.HeicViewerComponent),
  },
  {
    path: 'raw-image-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/raw-image-viewer/raw-image-viewer').then(m => m.RawImageViewerComponent),
  },
  {
    path: 'tiff-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/tiff-viewer/tiff-viewer').then(m => m.TiffViewerComponent),
  },
  {
    path: 'opendocument-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/opendocument-viewer/opendocument-viewer').then(m => m.OpendocumentViewerComponent),
  },
  {
    path: 'rtf-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/rtf-viewer/rtf-viewer').then(m => m.RtfViewerComponent),
  },
  {
    path: 'ics-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/ics-viewer/ics-viewer').then(m => m.IcsViewerComponent),
  },
  {
    path: 'subtitle-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/subtitle-viewer/subtitle-viewer').then(m => m.SubtitleViewerComponent),
  },
  {
    path: 'midi-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/midi-viewer/midi-viewer').then(m => m.MidiViewerComponent),
  },
  {
    path: 'musicxml-viewer',
    loadComponent: () =>
      import('@tools-workspace/features-home/coming-soon-page/coming-soon-page').then(m => m.ComingSoonPageComponent),
  },
  {
    path: 'apk-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/apk-viewer/apk-viewer').then(m => m.ApkViewerComponent),
  },
  {
    path: 'ipa-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/ipa-viewer/ipa-viewer').then(m => m.IpaViewerComponent),
  },
  {
    path: 'elf-binary-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/elf-binary-viewer/elf-binary-viewer').then(m => m.ElfBinaryViewerComponent),
  },
  {
    path: 'pe-binary-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/pe-binary-viewer/pe-binary-viewer').then(m => m.PeBinaryViewerComponent),
  },
  {
    path: 'wav-spectrum-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/wav-spectrum-viewer/wav-spectrum-viewer').then(m => m.WavSpectrumViewerComponent),
  },
  {
    path: 'spectrogram-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/spectrogram-viewer/spectrogram-viewer').then(m => m.SpectrogramViewerComponent),
  },
  {
    path: 'minecraft-world-viewer',
    loadComponent: () =>
      import('@tools-workspace/features-home/coming-soon-page/coming-soon-page').then(m => m.ComingSoonPageComponent),
  },
  {
    path: 'unity-asset-viewer',
    loadComponent: () =>
      import('@tools-workspace/features-home/coming-soon-page/coming-soon-page').then(m => m.ComingSoonPageComponent),
  },
  {
    path: 'game-save-viewer',
    loadComponent: () =>
      import('@tools-workspace/features-home/coming-soon-page/coming-soon-page').then(m => m.ComingSoonPageComponent),
  },
  {
    path: 'nft-metadata-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/nft-metadata-viewer/nft-metadata-viewer').then(m => m.NftMetadataViewerComponent),
  },
  {
    path: 'smart-contract-viewer',
    loadComponent: () =>
      import('@tools-workspace/features-home/coming-soon-page/coming-soon-page').then(m => m.ComingSoonPageComponent),
  },
  {
    path: 'invoice-data-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/invoice-data-viewer/invoice-data-viewer').then(m => m.InvoiceDataViewerComponent),
  },
  {
    path: 'audit-log-viewer',
    loadComponent: () =>
      import('@tools-workspace/file-viewers/audit-log-viewer/audit-log-viewer').then(m => m.AuditLogViewerComponent),
  },
  {
    path: 'figma-export-viewer',
    loadComponent: () =>
      import('@tools-workspace/features-home/coming-soon-page/coming-soon-page').then(m => m.ComingSoonPageComponent),
  },
  {
    path: 'sketch-file-viewer',
    loadComponent: () =>
      import('@tools-workspace/features-home/coming-soon-page/coming-soon-page').then(m => m.ComingSoonPageComponent),
  },
  {
    path: 'indesign-viewer',
    loadComponent: () =>
      import('@tools-workspace/features-home/coming-soon-page/coming-soon-page').then(m => m.ComingSoonPageComponent),
  },
];
