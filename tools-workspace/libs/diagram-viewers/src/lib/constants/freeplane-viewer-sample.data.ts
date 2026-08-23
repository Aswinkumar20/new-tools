/** Synthetic shop Freeplane snippets (education / research). */

export const FP_MM_SAMPLE = `<map version="freeplane 1.9.0">
  <node TEXT="Shop" ID="ID_1">
    <icon BUILTIN="folder"/>
    <node TEXT="Customer" ID="ID_2">
      <icon BUILTIN="male1"/>
      <attribute NAME="segment" VALUE="retail"/>
      <node TEXT="Cart" ID="ID_3">
        <icon BUILTIN="button_ok"/>
      </node>
    </node>
    <node TEXT="Checkout" ID="ID_4">
      <icon BUILTIN="idea"/>
      <icon BUILTIN="flag-yellow"/>
      <richcontent TYPE="NOTE"><html><body>Payment step</body></html></richcontent>
    </node>
  </node>
</map>
`;

export const FP_JSON_SAMPLE = `{
  "label": "Shop",
  "icons": ["folder"],
  "children": [
    { "label": "Customer", "icons": ["male1"], "attributes": [{ "name": "segment", "value": "retail" }], "children": [{ "label": "Cart", "icons": ["button_ok"] }] },
    { "label": "Checkout", "icons": ["idea", "flag"] }
  ]
}
`;

export const FP_MARKDOWN_SAMPLE = `# Shop

\`\`\`xml
<map version="freeplane 1.9.0">
  <node TEXT="Shop"><icon BUILTIN="folder"/><node TEXT="Pay"><icon BUILTIN="idea"/></node></node>
</map>
\`\`\`
`;
