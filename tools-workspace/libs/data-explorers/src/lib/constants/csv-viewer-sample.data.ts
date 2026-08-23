/** Bakery invoice CSV snippets (education / research). */

export const CV_ORDER_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { orderId: 1001, sku: 'CROIS-01', total: 49.5, itemCount: 2, note: 'Butter croissant' },
  { orderId: 1002, sku: 'MUFFIN-BL', total: 18, itemCount: 1, note: 'Blueberry muffin' },
  { orderId: 1003, sku: 'BAGUETTE', total: 72, itemCount: 3, note: 'Daily baguette' },
  { orderId: 1004, sku: 'TART-LEM', total: 9, itemCount: 1, note: '' }
];

export const CV_CSV_SAMPLE = `orderId,sku,total,itemCount,note
1001,CROIS-01,49.5,2,"Butter croissant"
1002,MUFFIN-BL,18,1,Blueberry muffin
1003,BAGUETTE,72,3,"Daily baguette"
1004,TART-LEM,9,1,
`;

export const CV_JSON_SAMPLE = `{
  "format": "csv",
  "name": "BakeryInvoices",
  "delimiter": ",",
  "hasHeader": true,
  "columns": [
    { "name": "orderId", "type": "INTEGER" },
    { "name": "sku", "type": "TEXT" },
    { "name": "total", "type": "REAL" }
  ],
  "rows": [
    { "orderId": 1001, "sku": "CROIS-01", "total": 49.5 },
    { "orderId": 1002, "sku": "MUFFIN-BL", "total": 18 }
  ]
}
`;

export const CV_MARKDOWN_SAMPLE = `# BakeryInvoices

orderId: INTEGER
sku: TEXT
total: REAL

1001 | CROIS-01 | 49.5
1002 | MUFFIN-BL | 18
`;

export const CV_SEMICOLON_SAMPLE = `orderId;sku;total
1001;CROIS-01;49.5
1002;MUFFIN-BL;18
`;
