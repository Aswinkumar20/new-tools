/** Synthetic ShopFloor PSD snippets (education / research). */

export const PD_JSON_SAMPLE = `{
  "name": "ShopFloor",
  "title": "ShopFloor composite",
  "psdVer": "1.0",
  "width": 12,
  "height": 8,
  "channels": [{ "name": "RGB" }, { "name": "Alpha" }],
  "layers": [
    { "name": "slab", "kind": "rect", "visible": true, "colorHex": "#34d399", "x": 0, "y": 0, "w": 12, "h": 8 },
    { "name": "counter", "kind": "rect", "visible": true, "colorHex": "#60a5fa", "x": 1, "y": 1, "w": 3, "h": 1.2 },
    { "name": "storage", "kind": "rect", "visible": true, "colorHex": "#60a5fa", "x": 8, "y": 0.5, "w": 3.5, "h": 2 },
    { "name": "column", "kind": "circle", "visible": true, "colorHex": "#f87171", "x": 10, "y": 6, "r": 0.35 },
    { "name": "aisle", "kind": "line", "visible": true, "colorHex": "#fbbf24", "x": 6, "y": 1, "x2": 6, "y2": 7 },
    { "name": "labels", "kind": "text", "visible": true, "colorHex": "#e2e8f0", "x": 4.2, "y": 4.2, "text": "ShopRanker" }
  ],
  "effects": [
    { "name": "drop-shadow", "layer": "labels", "kind": "shadow" },
    { "name": "stroke", "layer": "column", "kind": "stroke" }
  ]
}
`;

export const PD_ASCII_SAMPLE = `PSD dump ShopFloor 1.0
SIZE 12 8
CHANNEL RGB
CHANNEL Alpha
LAYER slab visible #34d399 BOX 0 0 12 8
LAYER counter visible #60a5fa BOX 1 1 3 1.2
LAYER storage visible #60a5fa BOX 8 0.5 3.5 2
LAYER column visible #f87171 CIRCLE 10 6 0.35
LAYER aisle visible #fbbf24 LINE 6 1 6 7
LAYER labels visible #e2e8f0 TEXT ShopRanker 4.2 4.2
EFFECT drop-shadow labels shadow
EFFECT stroke column stroke
`;

export const PD_CSV_SAMPLE = `name,type,kind,layer,effect,value
RGB,channel,,RGB,,
Alpha,channel,,Alpha,,
slab,layer,rect,slab,,12x8
counter,layer,rect,counter,,3x1.2
storage,layer,rect,storage,,3.5x2
column,layer,circle,column,,0.35
aisle,layer,line,aisle,,aisle
labels,layer,text,labels,,ShopRanker
drop-shadow,effect,shadow,labels,drop-shadow,shadow
stroke,effect,stroke,column,stroke,stroke
`;

export const PD_MARKDOWN_SAMPLE = `# ShopFloor

name: STRING
type: STRING
kind: STRING

RGB | channel | rgb
slab | layer | rect
counter | layer | rect
column | layer | circle
aisle | layer | line
labels | layer | text
drop-shadow | effect | shadow
stroke | effect | stroke
`;
