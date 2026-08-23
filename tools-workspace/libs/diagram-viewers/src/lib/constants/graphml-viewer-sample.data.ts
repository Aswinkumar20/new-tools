/** Synthetic shop GraphML snippets (education / research). */

export const GML_GRAPHML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="d0" for="node" attr.name="label" attr.type="string"/>
  <key id="d1" for="node" attr.name="community" attr.type="string"/>
  <key id="d2" for="edge" attr.name="weight" attr.type="double"/>
  <graph id="Shop" edgedefault="undirected">
    <node id="n0"><data key="d0">Customer</data><data key="d1">shoppers</data></node>
    <node id="n1"><data key="d0">Cart</data><data key="d1">shoppers</data></node>
    <node id="n2"><data key="d0">Pay</data><data key="d1">checkout</data></node>
    <node id="n3"><data key="d0">Bank</data><data key="d1">checkout</data></node>
    <edge source="n0" target="n1"><data key="d2">1</data></edge>
    <edge source="n1" target="n2"><data key="d2">1</data></edge>
    <edge source="n2" target="n3"><data key="d2">0.5</data></edge>
    <edge source="n0" target="n2"><data key="d2">0.2</data></edge>
  </graph>
</graphml>
`;

export const GML_JSON_SAMPLE = `{
  "name": "Shop graph",
  "directed": false,
  "nodes": [
    { "id": "n0", "label": "Customer", "community": "shoppers" },
    { "id": "n1", "label": "Cart", "community": "shoppers" },
    { "id": "n2", "label": "Pay", "community": "checkout" }
  ],
  "edges": [
    { "source": "n0", "target": "n1", "weight": 1 },
    { "source": "n1", "target": "n2", "label": "checkout", "weight": 1 }
  ]
}
`;

export const GML_MARKDOWN_SAMPLE = `# Shop

\`\`\`json
{"nodes":[{"id":"a","label":"A","community":"one"},{"id":"b","label":"B","community":"one"}],"edges":[{"source":"a","target":"b"}]}
\`\`\`
`;

export const GML_NO_COMMUNITY_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<graphml>
  <graph edgedefault="directed">
    <node id="a"/>
    <node id="b"/>
    <node id="c"/>
    <edge source="a" target="b"/>
    <edge source="c" target="c"/>
  </graph>
</graphml>
`;
