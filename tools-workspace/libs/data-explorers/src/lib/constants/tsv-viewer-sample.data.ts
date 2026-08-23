/** BLAST hit TSV snippets (education / research). */

export const TV_ORDER_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { orderId: 1001, sku: 'BRCA1', total: 49.5, itemCount: 2, note: 'breast cancer gene' },
  { orderId: 1002, sku: 'TP53', total: 18, itemCount: 1, note: 'tumor suppressor' },
  { orderId: 1003, sku: 'EGFR', total: 72, itemCount: 3, note: 'receptor tyrosine kinase' },
  { orderId: 1004, sku: 'KRAS', total: 9, itemCount: 1, note: '' }
];

export const TV_TSV_SAMPLE = `orderId\tsku\ttotal\titemCount\tnote
1001\tBRCA1\t49.5\t2\tbreast cancer gene
1002\tTP53\t18\t1\ttumor suppressor
1003\tEGFR\t72\t3\t"receptor, kinase"
1004\tKRAS\t9\t1\t
`;

export const TV_JSON_SAMPLE = `{
  "format": "tsv",
  "name": "BlastHits",
  "delimiter": "\\t",
  "hasHeader": true,
  "columns": [
    { "name": "orderId", "type": "INTEGER" },
    { "name": "sku", "type": "TEXT" },
    { "name": "total", "type": "REAL" }
  ],
  "rows": [
    { "orderId": 1001, "sku": "BRCA1", "total": 49.5 },
    { "orderId": 1002, "sku": "TP53", "total": 18 }
  ]
}
`;

export const TV_MARKDOWN_SAMPLE = `# BlastHits

orderId: INTEGER
sku: TEXT
total: REAL

1001 | BRCA1 | 49.5
1002 | TP53 | 18
`;
