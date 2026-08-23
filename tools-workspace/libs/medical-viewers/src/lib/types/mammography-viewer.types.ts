import type {
  DicomExportFormat,
  DicomLoadedFile,
  DicomParsedImage,
  DicomPixelProbe,
  DicomRelatedToolLink,
  DicomSuggestion,
  DicomWindowPreset
} from './dicom-viewer.types';

export type MammographyExportFormat = DicomExportFormat;
export type MammographyLoadedFile = DicomLoadedFile;
export type MammographyParsedImage = DicomParsedImage;
export type MammographyPixelProbe = DicomPixelProbe;
export type MammographyRelatedToolLink = DicomRelatedToolLink;
export type MammographySuggestion = DicomSuggestion;
export type MammographyWindowPreset = DicomWindowPreset;

export type MammographyHangingSlot = 'R-CC' | 'R-MLO' | 'L-CC' | 'L-MLO' | 'unassigned';

export interface MammographyHangingCell {
  slot: MammographyHangingSlot;
  file: MammographyLoadedFile | null;
}

export type MammographyViewMode = 'single' | 'hanging';
