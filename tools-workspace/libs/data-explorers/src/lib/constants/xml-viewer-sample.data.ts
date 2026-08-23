/** Product catalog XML snippets (education / research). */

export const XM_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<catalog name="ProductFeed" currency="USD" active="true">
  <items>
    <item orderId="1001" sku="WB-100" total="49.5" itemCount="2">
      <note>Canvas tote</note>
    </item>
    <item orderId="1002" sku="MUG-02" total="18" itemCount="1">
      <note>Ceramic mug</note>
    </item>
    <item orderId="1003" sku="HOOD-03" total="72" itemCount="3">
      <note/>
    </item>
  </items>
</catalog>
`;

export const XM_JSON_SAMPLE = `{
  "format": "xml",
  "name": "ProductFeed",
  "root": "catalog",
  "encoding": "UTF-8",
  "nodes": [
    { "name": "catalog", "path": "/catalog", "attrs": { "name": "ProductFeed", "currency": "USD" }, "text": "" },
    { "name": "item", "path": "/catalog/items/item[1]", "attrs": { "orderId": "1001", "sku": "WB-100", "total": "49.5" }, "text": "" },
    { "name": "note", "path": "/catalog/items/item[1]/note", "attrs": {}, "text": "Canvas tote" }
  ],
  "rows": [
    { "orderId": 1001, "sku": "WB-100", "total": 49.5 },
    { "orderId": 1002, "sku": "MUG-02", "total": 18 }
  ]
}
`;

export const XM_CSV_SAMPLE = `orderId,sku,total
1001,WB-100,49.5
1002,MUG-02,18
`;

export const XM_MARKDOWN_SAMPLE = `# ProductFeed

orderId: STRING
sku: STRING
total: STRING

1001 | WB-100 | 49.5
1002 | MUG-02 | 18
`;
