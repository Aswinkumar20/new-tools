export interface FileDimensions {
  width: number;
  height: number;
}

export interface FileAdditionalInfo {
  lines?: number;
  characters?: number;
  words?: number;
  [key: string]: string | number | undefined;
}

export interface FileMetadata {
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  extension: string;
  mimeType: string;
  preview?: string;
  dimensions?: FileDimensions;
  additionalInfo?: FileAdditionalInfo;
}

export interface FileAdditionalInfoItem {
  key: string;
  label: string;
  value: string;
}
