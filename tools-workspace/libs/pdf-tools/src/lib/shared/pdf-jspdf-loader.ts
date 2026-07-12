const CDN = {
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.28/dist/jspdf.plugin.autotable.min.js',
  html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  chart: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  jsbarcode: 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  qrcode: 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
} as const;

type JsPdfConstructor = new (options?: Record<string, unknown>) => JsPdfDocument;

export interface JsPdfDocument {
  internal: { pageSize: { getWidth(): number; getHeight(): number }; width?: number };
  setProperties(props: Record<string, string>): void;
  setFontSize(size: number): void;
  setFont(family: string, style?: string): void;
  text(text: string | string[], x: number, y: number): void;
  addPage(): void;
  splitTextToSize(text: string, maxWidth: number): string[];
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): void;
  getImageProperties(data: string): { width: number; height: number };
  output(type: 'arraybuffer'): ArrayBuffer;
  lastAutoTable?: { finalY: number };
  autoTable?(options: Record<string, unknown>): void;
}

export type AutoTableFn = (
  doc: JsPdfDocument,
  options: Record<string, unknown>,
) => void;

export type Html2CanvasFn = (
  element: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

export type ChartConstructor = new (
  ctx: CanvasRenderingContext2D | HTMLCanvasElement,
  config: Record<string, unknown>,
) => { destroy(): void; update(): void };

function ensureScript(src: string): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Scripts can only load in a browser'));
  }
  if (document.querySelector(`script[data-src="${src}"]`) || document.querySelector(`script[src="${src}"]`)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.setAttribute('data-src', src);
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export async function loadJsPDF(): Promise<JsPdfConstructor> {
  await ensureScript(CDN.jspdf);
  const lib = (globalThis as typeof globalThis & { jspdf?: { jsPDF: JsPdfConstructor } }).jspdf;
  if (!lib?.jsPDF) {
    throw new Error('jsPDF failed to load');
  }
  return lib.jsPDF;
}

export async function loadAutoTable(): Promise<void> {
  await loadJsPDF();
  await ensureScript(CDN.autotable);
}

export async function loadHtml2Canvas(): Promise<Html2CanvasFn> {
  await ensureScript(CDN.html2canvas);
  const fn = (globalThis as typeof globalThis & { html2canvas?: Html2CanvasFn }).html2canvas;
  if (!fn) {
    throw new Error('html2canvas failed to load');
  }
  return fn;
}

export async function loadChartJs(): Promise<ChartConstructor> {
  await ensureScript(CDN.chart);
  const ChartLib = (globalThis as typeof globalThis & { Chart?: ChartConstructor }).Chart;
  if (!ChartLib) {
    throw new Error('Chart.js failed to load');
  }
  return ChartLib;
}

export async function loadJsBarcode(): Promise<(element: HTMLCanvasElement, value: string, options?: Record<string, unknown>) => void> {
  await ensureScript(CDN.jsbarcode);
  const JsBarcode = (globalThis as typeof globalThis & { JsBarcode?: (element: HTMLCanvasElement, value: string, options?: Record<string, unknown>) => void }).JsBarcode;
  if (!JsBarcode) {
    throw new Error('JsBarcode failed to load');
  }
  return JsBarcode;
}

export interface QrCodeLib {
  toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
}

export async function loadQrCode(): Promise<QrCodeLib> {
  await ensureScript(CDN.qrcode);
  const QRCode = (globalThis as typeof globalThis & { QRCode?: QrCodeLib }).QRCode;
  if (!QRCode) {
    throw new Error('QRCode failed to load');
  }
  return QRCode;
}
