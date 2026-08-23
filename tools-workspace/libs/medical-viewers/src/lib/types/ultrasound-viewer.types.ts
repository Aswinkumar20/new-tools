import type {
  DicomExportFormat,
  DicomLoadedFile,
  DicomParsedImage,
  DicomPixelProbe,
  DicomRelatedToolLink,
  DicomSeriesGroup,
  DicomSuggestion,
  DicomWindowPreset
} from './dicom-viewer.types';

export type UltrasoundExportFormat = DicomExportFormat;
export type UltrasoundLoadedFile = DicomLoadedFile;
export type UltrasoundParsedImage = DicomParsedImage;
export type UltrasoundPixelProbe = DicomPixelProbe;
export type UltrasoundRelatedToolLink = DicomRelatedToolLink;
export type UltrasoundSuggestion = DicomSuggestion;
export type UltrasoundWindowPreset = DicomWindowPreset;
export type UltrasoundSeriesGroup = DicomSeriesGroup;

export type UltrasoundCineMode = 'multi-frame' | 'multi-file' | 'single';
