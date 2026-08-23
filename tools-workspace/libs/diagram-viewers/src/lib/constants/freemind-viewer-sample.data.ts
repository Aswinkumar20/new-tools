/** Synthetic shop FreeMind snippets (education / research). */

export const FM_MM_SAMPLE = `<map version="1.0.1">
  <node TEXT="Shop" ID="ID_1">
    <node TEXT="Customer" ID="ID_2" POSITION="right">
      <richcontent TYPE="NOTE"><html><body><p>Loyalty shopper</p></body></html></richcontent>
      <node TEXT="Cart" ID="ID_3"/>
    </node>
    <node TEXT="Checkout" ID="ID_4" POSITION="left">
      <node TEXT="Pay" ID="ID_5">
        <richcontent TYPE="NOTE"><html><body>Card only</body></html></richcontent>
      </node>
    </node>
  </node>
</map>
`;

export const FM_JSON_SAMPLE = `{
  "label": "Shop",
  "children": [
    { "label": "Customer", "note": "Loyalty shopper", "children": [{ "label": "Cart" }] },
    { "label": "Checkout", "children": [{ "label": "Pay", "note": "Card only" }] }
  ]
}
`;

export const FM_MARKDOWN_SAMPLE = `# Shop

\`\`\`xml
<map version="1.0.1">
  <node TEXT="Shop">
    <node TEXT="Customer"><richcontent TYPE="NOTE"><html><body>VIP</body></html></richcontent></node>
    <node TEXT="Checkout"/>
  </node>
</map>
\`\`\`
`;
