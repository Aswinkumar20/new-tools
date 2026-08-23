/** Synthetic checkout DOT graph for local Graphviz preview (education / research). */

export const GVZ_DOT_SAMPLE = `digraph Checkout {
  rankdir=LR;
  graph [layout=dot];
  node [shape=box];
  Cart -> Payment [label="checkout"];
  Payment -> Fulfill [label="ok"];
  Payment -> Retry [label="fail"];
  Retry -> Payment;
  Fulfill -> Done;
}
`;

export const GVZ_NEATO_SAMPLE = `graph Mesh {
  layout=neato;
  A -- B;
  B -- C;
  C -- A;
  A -- D;
}
`;

export const GVZ_MARKDOWN_SAMPLE = `# Checkout

\`\`\`dot
digraph Pay {
  rankdir=TB;
  Start -> Paid;
  Paid -> Done;
}
\`\`\`
`;

export const GVZ_JSON_SAMPLE = `{
  "name": "Checkout",
  "directed": true,
  "layout": "dot",
  "rankdir": "LR",
  "nodes": [
    { "id": "Cart", "name": "Cart", "shape": "box" },
    { "id": "Payment", "name": "Payment", "shape": "box" },
    { "id": "Done", "name": "Done", "shape": "ellipse" }
  ],
  "edges": [
    { "source": "Cart", "target": "Payment", "label": "checkout", "directed": true },
    { "source": "Payment", "target": "Done", "label": "ok", "directed": true }
  ]
}
`;
