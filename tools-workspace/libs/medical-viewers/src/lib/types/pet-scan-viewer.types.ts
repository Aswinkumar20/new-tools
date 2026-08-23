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

export type PetScanExportFormat = DicomExportFormat;
export type PetScanLoadedFile = DicomLoadedFile;
export type PetScanParsedImage = DicomParsedImage;
export type PetScanPixelProbe = DicomPixelProbe;
export type PetScanRelatedToolLink = DicomRelatedToolLink;
export type PetScanSuggestion = DicomSuggestion;
export type PetScanWindowPreset = DicomWindowPreset;
export type PetScanSeriesGroup = DicomSeriesGroup;

export type PetScanColormap = 'hot' | 'grayscale';

export interface PetScanFusionPair {
  ptSeriesIndex: number;
  anatomySeriesIndex: number;
  ptLabel: string;
  anatomyLabel: string;
}
