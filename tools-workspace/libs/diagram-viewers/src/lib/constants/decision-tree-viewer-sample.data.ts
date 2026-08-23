/** Synthetic shop checkout decision tree snippets (education / research). */

export const DT_SAMPLE = `{
  "name": "ShopCheckout",
  "root": "n0",
  "nodes": [
    { "id": "n0", "kind": "root", "feature": "cartTotal", "operator": "<=", "threshold": "50" },
    { "id": "n1", "kind": "branch", "feature": "itemCount", "operator": "<=", "threshold": "2" },
    { "id": "n2", "kind": "leaf", "value": "standard" },
    { "id": "n3", "kind": "leaf", "value": "express" },
    { "id": "n4", "kind": "leaf", "value": "priority" }
  ],
  "edges": [
    { "source": "n0", "target": "n1", "label": "yes" },
    { "source": "n0", "target": "n4", "label": "no" },
    { "source": "n1", "target": "n2", "label": "yes" },
    { "source": "n1", "target": "n3", "label": "no" }
  ]
}
`;

export const DT_JSON_SAMPLE = `{
  "name": "ShopCheckout",
  "feature": "cartTotal",
  "operator": "<=",
  "threshold": 50,
  "left": { "value": "standard" },
  "right": { "value": "priority" }
}
`;

export const DT_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<decision-tree name="ShopCheckout" root="n0">
  <node id="n0" kind="root" feature="cartTotal" operator="<=" threshold="50"/>
  <node id="n2" kind="leaf" value="standard"/>
  <node id="n4" kind="leaf" value="priority"/>
  <edge source="n0" target="n2" label="yes"/>
  <edge source="n0" target="n4" label="no"/>
</decision-tree>
`;

export const DT_CSV_SAMPLE = `id,kind,feature,operator,threshold,value,parent,edge
n0,root,cartTotal,<=,50,,,
n2,leaf,,,,standard,n0,yes
n4,leaf,,,,priority,n0,no
`;

export const DT_MARKDOWN_SAMPLE = `# ShopCheckout

cartTotal <= 50 --yes--> standard
cartTotal <= 50 --no--> priority
`;
