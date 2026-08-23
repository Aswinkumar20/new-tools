import { Chart, registerables } from 'chart.js';
import html2canvas from 'html2canvas';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

Chart.register(...registerables);

export type JsPdfConstructor = typeof jsPDF;
export type JsPdfDocument = InstanceType<typeof jsPDF> & {
  lastAutoTable?: { finalY: number };
};

export type AutoTableFn = (
  doc: JsPdfDocument,
  options: Record<string, unknown>
) => void;

export type Html2CanvasFn = typeof html2canvas;

export type ChartConstructor = typeof Chart;

export async function loadJsPDF(): Promise<JsPdfConstructor> {
  return jsPDF;
}

export async function loadAutoTable(): Promise<AutoTableFn> {
  return autoTable as AutoTableFn;
}

export async function loadHtml2Canvas(): Promise<Html2CanvasFn> {
  return html2canvas;
}

export async function loadChartJs(): Promise<ChartConstructor> {
  return Chart;
}

export async function loadJsBarcode(): Promise<typeof JsBarcode> {
  return JsBarcode;
}

export interface QrCodeLib {
  toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
}

export async function loadQrCode(): Promise<QrCodeLib> {
  return QRCode as unknown as QrCodeLib;
}
