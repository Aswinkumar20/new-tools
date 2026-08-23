import type {
  DicomExportFormat,
  DicomLoadedFile,
  DicomParsedImage,
  DicomPixelProbe,
  DicomRelatedToolLink,
  DicomSuggestion,
  DicomWindowPreset
} from './dicom-viewer.types';

export type CtExportFormat = DicomExportFormat;
export type CtLoadedFile = DicomLoadedFile;
export type CtParsedImage = DicomParsedImage;
export type CtPixelProbe = DicomPixelProbe;
export type CtRelatedToolLink = DicomRelatedToolLink;
export type CtSuggestion = DicomSuggestion;
export type CtWindowPreset = DicomWindowPreset;

export interface CtMeasurePoint {
  x: number;
  y: number;
}

export interface CtMeasureResult {
  a: CtMeasurePoint;
  b: CtMeasurePoint;
  distancePx: number;
  distanceMm: number | null;
}
