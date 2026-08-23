/** Synthetic shop mind-map snippets (education / research). */

export const MMAP_MARKDOWN_SAMPLE = `# Shop
## Customer
### Cart
### Wishlist
## Checkout
### Pay
#### Bank
`;

export const MMAP_MERMAID_SAMPLE = `mindmap
  root((Shop))
    Customer
      Cart
    Checkout
      Pay
`;

export const MMAP_OPML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Shop</title></head>
  <body>
    <outline text="Shop">
      <outline text="Customer">
        <outline text="Cart"/>
      </outline>
      <outline text="Checkout" _note="payment"/>
    </outline>
  </body>
</opml>
`;

export const MMAP_JSON_SAMPLE = `{
  "label": "Shop",
  "children": [
    { "label": "Customer", "children": [{ "label": "Cart" }, { "label": "Wishlist" }] },
    { "label": "Checkout", "note": "flow", "children": [{ "label": "Pay" }] }
  ]
}
`;

export const MMAP_INDENTED_SAMPLE = `Shop
  Customer
    Cart
  Checkout
    Pay
`;
