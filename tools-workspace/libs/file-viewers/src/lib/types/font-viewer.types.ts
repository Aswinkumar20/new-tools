export interface FontMetadata {
  fileName: string;
  formattedSize: string;
  rawSize: number;
  mimeType: string;
  formatLabel: string;
  lastModified: string;
  family: string;
  style: string;
  weight: string;
  stretch: string;
  variationSettings?: string;
}

export interface FontPreviewTemplate {
  id: string;
  label: string;
  description: string;
  content: string;
}

export interface FontComparisonOption {
  label: string;
  value: string;
}

export interface FontCharacterShowcase {
  title: string;
  description: string;
  characters: string;
}

export interface FontPreviewStyleOptions {
  uploadedFontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  textColor: string;
  backgroundColor: string;
  uppercase: boolean;
  selectedWeight: string;
  selectedStyle: string;
  enableSmoothPreview: boolean;
}

export interface FontPreviewDefaults {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  textColor: string;
  backgroundColor: string;
  uppercase: boolean;
  enableSmoothPreview: boolean;
  selectedWeight: string;
  selectedStyle: string;
}
