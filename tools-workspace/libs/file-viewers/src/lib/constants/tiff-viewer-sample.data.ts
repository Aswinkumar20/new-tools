/** Synthetic ShopFloor TIFF snippets (education / research). */

export const TF_JSON_SAMPLE = `{
  "name": "ShopFloor",
  "title": "ShopFloor TIFF",
  "tiffVer": "1.0",
  "width": 12,
  "height": 8,
  "compression": "LZW",
  "photometric": "RGB",
  "pages": [
    { "name": "cover", "kind": "primary", "width": 12, "height": 8 },
    { "name": "floor", "kind": "overlay", "width": 12, "height": 8 }
  ],
  "metas": [
    { "name": "compression", "value": "LZW" },
    { "name": "photometric", "value": "RGB" },
    { "name": "dpi", "value": "300" },
    { "name": "software", "value": "ShopScan" }
  ],
  "previews": [
    { "name": "slab", "kind": "rect", "page": "cover", "colorHex": "#34d399", "x": 0, "y": 0, "w": 12, "h": 8 },
    { "name": "counter", "kind": "rect", "page": "cover", "colorHex": "#60a5fa", "x": 1, "y": 1, "w": 3, "h": 1.2 },
    { "name": "storage", "kind": "rect", "page": "cover", "colorHex": "#60a5fa", "x": 8, "y": 0.5, "w": 3.5, "h": 2 },
    { "name": "column", "kind": "circle", "page": "floor", "colorHex": "#f87171", "x": 10, "y": 6, "r": 0.35 },
    { "name": "aisle", "kind": "line", "page": "floor", "colorHex": "#fbbf24", "x": 6, "y": 1, "x2": 6, "y2": 7 },
    { "name": "title", "kind": "text", "page": "cover", "colorHex": "#e2e8f0", "x": 4.2, "y": 4.2, "text": "ShopRanker" }
  ]
}
`;

export const TF_ASCII_SAMPLE = `TIFF dump ShopFloor 1.0
SIZE 12 8
PAGE cover 12 8
PAGE floor 12 8
META compression LZW
META photometric RGB
META dpi 300
META software ShopScan
SHAPE rect slab cover 0 0 12 8 #34d399
SHAPE rect counter cover 1 1 3 1.2 #60a5fa
SHAPE rect storage cover 8 0.5 3.5 2 #60a5fa
SHAPE circle column floor 10 6 0.35 #f87171
SHAPE line aisle floor 6 1 6 7 #fbbf24
TEXT ShopRanker cover 4.2 4.2
`;

export const TF_CSV_SAMPLE = `name,type,kind,page,meta,value
cover,page,primary,cover,,12x8
floor,page,overlay,floor,,12x8
compression,meta,meta,,compression,LZW
photometric,meta,meta,,photometric,RGB
dpi,meta,meta,,dpi,300
software,meta,meta,,software,ShopScan
slab,preview,rect,cover,,12x8
counter,preview,rect,cover,,3x1.2
column,preview,circle,floor,,0.35
aisle,preview,line,floor,,aisle
title,preview,text,cover,,ShopRanker
`;

export const TF_MARKDOWN_SAMPLE = `# ShopFloor

name: STRING
type: STRING
kind: STRING

cover | page | primary
floor | page | overlay
compression | meta | LZW
photometric | meta | RGB
slab | preview | rect
column | preview | circle
title | preview | text
`;
