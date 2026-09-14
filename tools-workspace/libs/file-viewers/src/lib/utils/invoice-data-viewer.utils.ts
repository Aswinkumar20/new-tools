import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  vendor: string;
  customer: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  lineItems: InvoiceLineItem[];
  raw: unknown;
}

export function isInvoiceFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.json') ||
    name.endsWith('.xml') ||
    file.type === 'application/json' ||
    file.type === 'text/xml' ||
    file.type === 'application/xml'
  );
}

export function parseInvoiceContent(content: string, fileName: string): InvoiceData {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xml') || content.trimStart().startsWith('<')) {
    return parseInvoiceXml(content);
  }
  return parseInvoiceJson(content);
}

export function parseInvoiceJson(content: string): InvoiceData {
  const raw = JSON.parse(content) as Record<string, unknown>;
  const root = (raw['invoice'] as Record<string, unknown> | undefined) ?? raw;

  const lineItemsRaw =
    root['line_items'] ?? root['lineItems'] ?? root['items'] ?? root['lines'] ?? [];
  const lineItems = normalizeLineItems(lineItemsRaw);

  return {
    invoiceNumber: pickString(root, ['invoice_number', 'invoiceNumber', 'number', 'id']) ?? '—',
    issueDate: pickString(root, ['issue_date', 'issueDate', 'date', 'invoice_date']) ?? '—',
    dueDate: pickString(root, ['due_date', 'dueDate']) ?? '—',
    vendor: pickParty(root, ['vendor', 'seller', 'from', 'supplier']),
    customer: pickParty(root, ['customer', 'buyer', 'to', 'client']),
    currency: pickString(root, ['currency', 'currency_code']) ?? '—',
    subtotal: pickNumber(root, ['subtotal', 'sub_total', 'net']) ?? sumLineItems(lineItems),
    tax: pickNumber(root, ['tax', 'tax_total', 'vat']) ?? 0,
    total: pickNumber(root, ['total', 'grand_total', 'amount_due']) ?? sumLineItems(lineItems),
    lineItems,
    raw: root
  };
}

export function parseInvoiceXml(content: string): InvoiceData {
  const doc = new DOMParser().parseFromString(content, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid XML invoice');
  }

  const text = (selector: string): string =>
    doc.querySelector(selector)?.textContent?.trim() ?? '';

  const lineNodes = Array.from(
    doc.querySelectorAll('line, lineitem, item, LineItem, cac\\:InvoiceLine')
  );
  const lineItems = lineNodes.map((node) => ({
    description:
      node.querySelector('description, Description, name, Name')?.textContent?.trim() ?? 'Item',
    quantity: Number(node.querySelector('quantity, Quantity')?.textContent ?? 1) || 1,
    unitPrice: Number(node.querySelector('unitprice, UnitPrice, price, Price')?.textContent ?? 0) || 0,
    amount: Number(node.querySelector('amount, Amount, lineTotal, LineExtensionAmount')?.textContent ?? 0) || 0
  }));

  return {
    invoiceNumber: text('invoiceNumber') || text('InvoiceNumber') || text('ID') || '—',
    issueDate: text('issueDate') || text('IssueDate') || text('date') || '—',
    dueDate: text('dueDate') || text('DueDate') || '—',
    vendor: text('vendor') || text('Seller') || text('Supplier') || '—',
    customer: text('customer') || text('Buyer') || text('Customer') || '—',
    currency: text('currency') || text('DocumentCurrencyCode') || '—',
    subtotal: Number(text('subtotal') || text('TaxExclusiveAmount')) || sumLineItems(lineItems),
    tax: Number(text('tax') || text('TaxAmount')) || 0,
    total: Number(text('total') || text('PayableAmount')) || sumLineItems(lineItems),
    lineItems,
    raw: content
  };
}

function normalizeLineItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const record = (item ?? {}) as Record<string, unknown>;
    const quantity = pickNumber(record, ['quantity', 'qty']) ?? 1;
    const unitPrice = pickNumber(record, ['unit_price', 'unitPrice', 'price']) ?? 0;
    const amount = pickNumber(record, ['amount', 'total', 'line_total']) ?? quantity * unitPrice;
    return {
      description: pickString(record, ['description', 'name', 'title']) ?? 'Item',
      quantity,
      unitPrice,
      amount
    };
  });
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function pickParty(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const name = pickString(record, ['name', 'company', 'title']);
      if (name) {
        return name;
      }
    }
  }
  return '—';
}

function sumLineItems(items: InvoiceLineItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function resolveInvoiceSuggestion(options: {
  hasInvoice: boolean;
  hasError: boolean;
}): FvToolSuggestion | null {
  if (options.hasError) {
    return {
      id: 'inv-text',
      title: 'Raw document instead?',
      reason: 'Text File Viewer handles unstructured invoice exports.',
      actionLabel: 'Open Text File Viewer',
      path: '/file-viewers/text-file-viewer'
    };
  }
  if (!options.hasInvoice) {
    return {
      id: 'inv-excel',
      title: 'Spreadsheet invoice?',
      reason: 'Excel Viewer opens XLSX line-item exports with column filters.',
      actionLabel: 'Open Excel Viewer',
      path: '/file-viewers/excel-viewer'
    };
  }
  return null;
}
