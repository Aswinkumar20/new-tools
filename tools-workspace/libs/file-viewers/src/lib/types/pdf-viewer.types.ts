export interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  destroy(): void;
}

export interface PDFPageProxy {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void>; cancel(): void };
}

export interface PdfJsPasswordResponses {
  NEED_PASSWORD: number;
  INCORRECT_PASSWORD: number;
}

export interface PdfJsLibrary {
  version: string;
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: {
    url: string;
    password?: string;
    passwordCallback?: (
      updatePassword: (password: string) => void,
      reason: unknown
    ) => void | Promise<string>;
  }): { promise: Promise<PDFDocumentProxy> };
  PasswordResponses: PdfJsPasswordResponses;
}

export interface PdfFile {
  name: string;
  file: File;
  url: string;
  size: number;
  pdfDoc: PDFDocumentProxy | null;
  totalPages: number;
  password?: string;
  needsPassword: boolean;
  passwordError: boolean;
  /** Resolves PDF.js passwordCallback when the user submits a password. */
  passwordResolver?: (password: string) => void;
}

export interface PdfViewportSize {
  width: number;
  height: number;
}

export interface PdfValidationResult {
  validFiles: File[];
  errors: string[];
}

export type PdfRenderTask = { cancel(): void; promise: Promise<void> } | null;
