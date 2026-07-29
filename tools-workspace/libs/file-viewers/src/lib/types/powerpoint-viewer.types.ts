export enum PresentationType {
  PPTX = 'pptx',
  UNSUPPORTED = 'unsupported'
}

export interface PptxSlide {
  id: number;
  elements: PptxElement[];
  background?: string;
  notes?: string;
  /** Set when this slide failed to parse — never shown as file content */
  parseError?: string;
}

export interface PptxElement {
  type: 'text' | 'image' | 'shape';
  content?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    textAlign?: string;
    background?: string;
    borderRadius?: string;
  };
  imageData?: string;
}

export interface PptxData {
  slides: PptxSlide[];
  slideWidthEmu: number;
  slideHeightEmu: number;
  warnings: string[];
}

export interface PresentationFile {
  name: string;
  file: File;
  url: string;
  size: number;
  presentationType: PresentationType;
  slides: PptxSlide[];
  totalSlides: number;
  currentSlideIndex: number;
  slideWidthEmu: number;
  slideHeightEmu: number;
  metadata?: {
    title?: string;
    author?: string;
    created?: string;
  };
}

export interface PresentationValidationResult {
  validFiles: File[];
  errors: string[];
}

export type JsZipConstructor = {
  loadAsync(data: ArrayBuffer): Promise<JsZipArchive>;
};

export type JsZipArchive = {
  files: Record<string, { async(type: string): Promise<string> } | undefined>;
};
