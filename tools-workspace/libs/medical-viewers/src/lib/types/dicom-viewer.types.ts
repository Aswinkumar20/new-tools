export type DicomExportFormat = 'original' | 'metadata-json' | 'summary-json' | 'png';

export interface DicomRelatedToolLink {
  label: string;
  description: string;
  path: string;
}

export interface DicomWindowPreset {
  id: string;
  label: string;
  center: number;
  width: number;
}

export interface DicomMetadataRow {
  keyword: string;
  tag: string;
  value: string;
}

export interface DicomPixelProbe {
  x: number;
  y: number;
  raw: number;
  hu: number | null;
  /** Rescaled value — SUV-like for PT when Units/rescale present */
  suv?: number | null;
}

export interface DicomParsedImage {
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  highBit: number;
  pixelRepresentation: number;
  samplesPerPixel: number;
  photometricInterpretation: string;
  rescaleSlope: number;
  rescaleIntercept: number;
  windowCenter: number | null;
  windowWidth: number | null;
  numberOfFrames: number;
  transferSyntaxUid: string;
  patientName: string;
  patientId: string;
  modality: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
  instanceNumber: number | null;
  /** PixelSpacing (0028,0030): [rowSpacingMm, columnSpacingMm] */
  pixelSpacing: [number, number] | null;
  /** ImagePositionPatient (0020,0032) */
  imagePositionPatient: [number, number, number] | null;
  seriesDescription: string;
  protocolName: string;
  /** ViewPosition (0018,5101) — CC, MLO, etc. */
  viewPosition: string;
  /** ImageLaterality (0020,0062) — R, L, B */
  imageLaterality: string;
  /** Units (0054,1001) — e.g. BQML for PET SUV context */
  units: string;
  pixels: Float32Array;
  metadataRows: DicomMetadataRow[];
  warnings: string[];
  compressed: boolean;
}

export interface DicomLoadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  bytes: Uint8Array;
  parsed: DicomParsedImage | null;
  warnings: string[];
  softFail: boolean;
}

export interface DicomSuggestion {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  path: string;
}

export interface DicomSeriesGroup {
  seriesInstanceUid: string;
  label: string;
  description: string;
  protocolName: string;
  files: DicomLoadedFile[];
}
