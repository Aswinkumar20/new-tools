/** Synthetic shop concept map snippets (education / research). */

export const CMAP_CXL_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<cmap xmlns="http://cmap.ihmc.us/xml/cmap/">
  <res-meta>
    <title>Shop concept map</title>
  </res-meta>
  <map>
    <concept-list>
      <concept id="c1" label="Customer"/>
      <concept id="c2" label="Cart"/>
      <concept id="c3" label="Checkout"/>
      <concept id="c4" label="Payment"/>
    </concept-list>
    <linking-phrase-list>
      <linking-phrase id="p1" label="uses"/>
      <linking-phrase id="p2" label="contains"/>
      <linking-phrase id="p3" label="pays via"/>
    </linking-phrase-list>
    <connection-list>
      <connection id="x1" from-id="c1" to-id="p1"/>
      <connection id="x2" from-id="p1" to-id="c2"/>
      <connection id="x3" from-id="c2" to-id="p2"/>
      <connection id="x4" from-id="p2" to-id="c3"/>
      <connection id="x5" from-id="c3" to-id="p3"/>
      <connection id="x6" from-id="p3" to-id="c4"/>
    </connection-list>
  </map>
</cmap>
`;

export const CMAP_JSON_SAMPLE = `{
  "name": "Shop concept map",
  "nodes": [
    { "id": "Customer", "label": "Customer", "note": "Shopper" },
    { "id": "Cart", "label": "Cart" },
    { "id": "Pay", "label": "Payment" }
  ],
  "links": [
    { "source": "Customer", "target": "Cart", "label": "uses" },
    { "source": "Cart", "target": "Pay", "label": "pays via" }
  ]
}
`;

export const CMAP_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<concept-map name="Shop">
  <node id="Customer" label="Customer" note="Shopper"/>
  <node id="Cart" label="Cart"/>
  <link source="Customer" target="Cart" label="uses"/>
  <link source="Cart" target="Pay" label="pays via"/>
</concept-map>
`;

export const CMAP_MARKDOWN_SAMPLE = `# Shop concept map

Customer -- uses --> Cart
Cart -- contains --> Item
Checkout -- charges --> Bank
`;

export const CMAP_DOT_SAMPLE = `digraph Shop {
  Customer -> Cart [label="uses"];
  Cart -> Item [label="contains"];
}
`;
