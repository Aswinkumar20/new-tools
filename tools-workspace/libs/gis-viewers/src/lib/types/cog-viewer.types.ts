import type {
  GeotiffBandSelection,
  GeotiffDiagramStats,
  GeotiffExportFormat,
  GeotiffLoadedFile,
  GeotiffMetadataRow,
  GeotiffRasterMetadata,
  GeotiffRelatedToolLink,
  GeotiffRenderOptions,
  GeotiffStretchMode,
  CogComplianceFlags
} from './geotiff-viewer.types';

export type CogExportFormat = GeotiffExportFormat;
export type CogStretchMode = GeotiffStretchMode;
export type CogBandSelection = GeotiffBandSelection;
export type CogRasterMetadata = GeotiffRasterMetadata;
export type CogDiagramStats = GeotiffDiagramStats;
export type CogLoadedFile = GeotiffLoadedFile;
export type CogRelatedToolLink = GeotiffRelatedToolLink;
export type CogMetadataRow = GeotiffMetadataRow;
export type CogRenderOptions = GeotiffRenderOptions;
export type { CogComplianceFlags };

export interface CogWindowOptions {
  /** When true, crop a center square/window before reading. */
  enabled: boolean;
  /** Max window size in pixels on the longest side (of the crop). */
  maxWindowSize: number;
}
