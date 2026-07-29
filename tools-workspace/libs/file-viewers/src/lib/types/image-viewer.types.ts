export interface ImageFile {
  name: string;
  file: File;
  url: string;
  size: number;
  type: string;
}

export interface ImageValidationResult {
  validFiles: File[];
  errors: string[];
}
