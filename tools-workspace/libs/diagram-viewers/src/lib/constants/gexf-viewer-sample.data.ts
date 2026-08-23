/** Synthetic shop GEXF snippets (education / research). */

export const GXF_GEXF_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" xmlns:viz="http://www.gexf.net/1.2draft/viz" version="1.2">
  <meta>
    <creator>EasyToolHub</creator>
    <description>Shop network</description>
  </meta>
  <graph defaultedgetype="directed" mode="dynamic" timeformat="double">
    <attributes class="node">
      <attribute id="0" title="community" type="string"/>
    </attributes>
    <attributes class="edge">
      <attribute id="1" title="weight" type="float"/>
    </attributes>
    <nodes>
      <node id="n0" label="Customer" start="0" end="10">
        <attvalues><attvalue for="0" value="shoppers"/></attvalues>
      </node>
      <node id="n1" label="Cart" start="0" end="8">
        <attvalues><attvalue for="0" value="shoppers"/></attvalues>
      </node>
      <node id="n2" label="Pay" start="2" end="10">
        <attvalues><attvalue for="0" value="checkout"/></attvalues>
      </node>
      <node id="n3" label="Bank" start="4" end="10">
        <attvalues><attvalue for="0" value="checkout"/></attvalues>
      </node>
    </nodes>
    <edges>
      <edge id="e0" source="n0" target="n1" weight="1" start="0" end="8"/>
      <edge id="e1" source="n1" target="n2" weight="1" start="2" end="8"/>
      <edge id="e2" source="n2" target="n3" weight="0.5" start="4" end="10"/>
      <edge id="e3" source="n0" target="n2" weight="0.2" start="2" end="6"/>
    </edges>
  </graph>
</gexf>
`;

export const GXF_JSON_SAMPLE = `{
  "name": "Shop graph",
  "directed": true,
  "mode": "dynamic",
  "nodes": [
    { "id": "n0", "label": "Customer", "community": "shoppers", "start": 0, "end": 10 },
    { "id": "n1", "label": "Cart", "community": "shoppers", "start": 0, "end": 8 },
    { "id": "n2", "label": "Pay", "community": "checkout", "start": 2, "end": 10 }
  ],
  "edges": [
    { "source": "n0", "target": "n1", "weight": 1, "start": 0, "end": 8 },
    { "source": "n1", "target": "n2", "label": "checkout", "weight": 1, "start": 2, "end": 8 }
  ]
}
`;

export const GXF_MARKDOWN_SAMPLE = `# Shop

\`\`\`json
{"nodes":[{"id":"a","label":"A","community":"one","start":0,"end":4},{"id":"b","label":"B","community":"one","start":1,"end":4}],"edges":[{"source":"a","target":"b","start":1,"end":4}]}
\`\`\`
`;

export const GXF_NO_COMMUNITY_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gexf>
  <graph defaultedgetype="directed" mode="static">
    <nodes>
      <node id="a" label="A"/>
      <node id="b" label="B"/>
      <node id="c" label="C"/>
    </nodes>
    <edges>
      <edge source="a" target="b"/>
      <edge source="c" target="c"/>
    </edges>
  </graph>
</gexf>
`;
