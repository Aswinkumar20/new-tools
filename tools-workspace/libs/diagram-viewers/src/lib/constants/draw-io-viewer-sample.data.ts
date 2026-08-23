/** Synthetic shop draw.io snippets (education / research). */

export const DIO_SAMPLE = `<mxfile host="app.diagrams.net" agent="education" version="24.0">
  <diagram id="page-shop" name="Shop">
    <mxGraphModel dx="1000" dy="700" grid="1" page="1" pageWidth="827" pageHeight="1169">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="c1" value="Customer" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;" vertex="1" parent="1">
          <mxGeometry x="80" y="80" width="120" height="56" as="geometry"/>
        </mxCell>
        <mxCell id="c2" value="Cart" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;" vertex="1" parent="1">
          <mxGeometry x="280" y="80" width="120" height="56" as="geometry"/>
        </mxCell>
        <mxCell id="c3" value="Checkout" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;" vertex="1" parent="1">
          <mxGeometry x="480" y="80" width="120" height="56" as="geometry"/>
        </mxCell>
        <mxCell id="e1" value="uses" style="endArrow=classic;html=1;" edge="1" parent="1" source="c1" target="c2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e2" value="pays" style="endArrow=classic;html=1;" edge="1" parent="1" source="c2" target="c3">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
  <diagram id="page-pay" name="Payments">
    <mxGraphModel dx="800" dy="600" grid="1" page="1" pageWidth="827" pageHeight="1169">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="p1" value="Checkout" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="100" y="120" width="120" height="56" as="geometry"/>
        </mxCell>
        <mxCell id="p2" value="Bank" style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="320" y="120" width="120" height="56" as="geometry"/>
        </mxCell>
        <mxCell id="pe1" value="charge" style="endArrow=block;html=1;dashed=1;" edge="1" parent="1" source="p1" target="p2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;

export const DIO_JSON_SAMPLE = `{
  "name": "Shop",
  "pages": [
    {
      "id": "page-shop",
      "name": "Shop",
      "shapes": [
        { "id": "c1", "label": "Customer", "x": 80, "y": 80, "width": 120, "height": 56 },
        { "id": "c2", "label": "Cart", "x": 280, "y": 80, "width": 120, "height": 56 }
      ],
      "connectors": [
        { "source": "c1", "target": "c2", "label": "uses" }
      ]
    }
  ]
}
`;

export const DIO_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<drawio name="Shop">
  <page id="page-shop" name="Shop">
    <shape id="c1" label="Customer" x="80" y="80" width="120" height="56"/>
    <shape id="c2" label="Cart" x="280" y="80" width="120" height="56"/>
    <connector source="c1" target="c2" label="uses"/>
  </page>
</drawio>
`;

export const DIO_MARKDOWN_SAMPLE = `# Shop

\`\`\`xml
<mxfile>
  <diagram name="Shop">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="a" value="Web" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="100" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="b" value="API" vertex="1" parent="1">
          <mxGeometry x="200" y="40" width="100" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="e" edge="1" parent="1" source="a" target="b"/>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
\`\`\`
`;
