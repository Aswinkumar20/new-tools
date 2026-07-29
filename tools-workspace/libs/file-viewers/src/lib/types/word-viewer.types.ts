export enum DocumentType {
  DOCX = 'docx',
  DOC = 'doc',
  RTF = 'rtf',
  ODT = 'odt',
  TXT = 'txt',
  HTML = 'html',
  UNSUPPORTED = 'unsupported'
}

export interface MammothMessage {
  type: string;
  message: string;
}

export interface MammothResult {
  value: string;
  messages: MammothMessage[];
}

export interface MammothLibrary {
  convertToHtml(
    options: { arrayBuffer: ArrayBuffer },
    config?: { styleMap?: string[] }
  ): Promise<MammothResult>;
  extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

export interface WordFile {
  name: string;
  file: File;
  url: string;
  size: number;
  htmlContent: string | null;
  textContent: string;
  documentType: DocumentType;
  needsPassword: boolean;
  passwordError: boolean;
}

export interface WordValidationResult {
  validFiles: File[];
  errors: string[];
}

export interface WordParseResult {
  htmlContent: string;
  textContent: string;
  warnings: string[];
}
