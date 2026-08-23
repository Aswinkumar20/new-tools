/** REST API users JSON snippets (education / research). */

export const JN_JSON_SAMPLE = `{
  "name": "ApiUsers",
  "currency": "USD",
  "active": true,
  "orders": [
    { "orderId": 1001, "sku": "USR-ADA", "total": 49.5, "itemCount": 2, "note": "Admin user" },
    { "orderId": 1002, "sku": "USR-LIN", "total": 18, "itemCount": 1, "note": "Editor user" },
    { "orderId": 1003, "sku": "USR-KAY", "total": 72, "itemCount": 3, "note": null }
  ]
}
`;

export const JN_JSONL_SAMPLE = `{"orderId":1001,"sku":"USR-ADA","total":49.5}
{"orderId":1002,"sku":"USR-LIN","total":18}
{"orderId":1003,"sku":"USR-KAY","total":72}
`;

export const JN_CSV_SAMPLE = `orderId,sku,total
1001,USR-ADA,49.5
1002,USR-LIN,18
`;

export const JN_MARKDOWN_SAMPLE = `# ApiUsers

orderId: NUMBER
sku: STRING
total: NUMBER

1001 | USR-ADA | 49.5
1002 | USR-LIN | 18
`;
