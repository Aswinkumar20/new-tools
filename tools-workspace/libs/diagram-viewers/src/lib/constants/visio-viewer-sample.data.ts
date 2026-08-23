/** Synthetic shop Visio snippets (education / research). */

export const VSD_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<VisioDocument xmlns="urn:schemas-microsoft-com:office:visio">
  <Pages>
    <Page ID="0" Name="Shop" NameU="Shop">
      <PageSheet>
        <XForm>
          <Width>11</Width>
          <Height>8.5</Height>
        </XForm>
      </PageSheet>
      <Shapes>
        <Shape ID="1" NameU="Customer" Type="Shape">
          <Text>Customer</Text>
          <XForm><PinX>1.5</PinX><PinY>6</PinY><Width>1.6</Width><Height>0.6</Height></XForm>
        </Shape>
        <Shape ID="2" NameU="Cart" Type="Shape">
          <Text>Cart</Text>
          <XForm><PinX>4</PinX><PinY>6</PinY><Width>1.6</Width><Height>0.6</Height></XForm>
        </Shape>
        <Shape ID="3" NameU="Checkout" Type="Shape">
          <Text>Checkout</Text>
          <XForm><PinX>6.5</PinX><PinY>6</PinY><Width>1.6</Width><Height>0.6</Height></XForm>
        </Shape>
        <Shape ID="10" NameU="uses" Type="Connector">
          <Text>uses</Text>
        </Shape>
        <Shape ID="11" NameU="pays" Type="Connector">
          <Text>pays</Text>
        </Shape>
      </Shapes>
      <Connects>
        <Connect FromSheet="10" FromCell="BeginX" ToSheet="1" ToCell="PinX"/>
        <Connect FromSheet="10" FromCell="EndX" ToSheet="2" ToCell="PinX"/>
        <Connect FromSheet="11" FromCell="BeginX" ToSheet="2" ToCell="PinX"/>
        <Connect FromSheet="11" FromCell="EndX" ToSheet="3" ToCell="PinX"/>
      </Connects>
    </Page>
    <Page ID="1" Name="Payments" NameU="Payments">
      <Shapes>
        <Shape ID="4" NameU="Checkout" Type="Shape">
          <Text>Checkout</Text>
          <XForm><PinX>2</PinX><PinY>4</PinY><Width>1.6</Width><Height>0.6</Height></XForm>
        </Shape>
        <Shape ID="5" NameU="Bank" Type="Shape">
          <Text>Bank</Text>
          <XForm><PinX>5</PinX><PinY>4</PinY><Width>1.6</Width><Height>0.6</Height></XForm>
        </Shape>
        <Shape ID="12" NameU="charge" Type="Connector">
          <Text>charge</Text>
        </Shape>
      </Shapes>
      <Connects>
        <Connect FromSheet="12" FromCell="BeginX" ToSheet="4" ToCell="PinX"/>
        <Connect FromSheet="12" FromCell="EndX" ToSheet="5" ToCell="PinX"/>
      </Connects>
    </Page>
  </Pages>
</VisioDocument>
`;

export const VSD_JSON_SAMPLE = `{
  "name": "Shop",
  "pages": [
    {
      "id": "page-shop",
      "name": "Shop",
      "shapes": [
        { "id": "1", "label": "Customer", "x": 80, "y": 80, "width": 120, "height": 56 },
        { "id": "2", "label": "Cart", "x": 280, "y": 80, "width": 120, "height": 56 }
      ],
      "connectors": [
        { "source": "1", "target": "2", "label": "uses" }
      ]
    }
  ]
}
`;

export const VSD_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<visio name="Shop">
  <page id="page-shop" name="Shop">
    <shape id="1" label="Customer" x="80" y="80" width="120" height="56"/>
    <shape id="2" label="Cart" x="280" y="80" width="120" height="56"/>
    <connector source="1" target="2" label="uses"/>
  </page>
</visio>
`;

export const VSD_MARKDOWN_SAMPLE = `# Shop

\`\`\`xml
<VisioDocument>
  <Pages>
    <Page Name="Shop">
      <Shapes>
        <Shape ID="1" NameU="Web" Type="Shape"><Text>Web</Text></Shape>
        <Shape ID="2" NameU="API" Type="Shape"><Text>API</Text></Shape>
        <Shape ID="3" NameU="calls" Type="Connector"><Text>calls</Text></Shape>
      </Shapes>
      <Connects>
        <Connect FromSheet="3" FromCell="BeginX" ToSheet="1"/>
        <Connect FromSheet="3" FromCell="EndX" ToSheet="2"/>
      </Connects>
    </Page>
  </Pages>
</VisioDocument>
\`\`\`
`;
