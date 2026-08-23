/** Synthetic ShopFloor HEIC snippets (education / research). */

export const HC_JSON_SAMPLE = `{
  "name": "ShopFloor",
  "title": "ShopFloor photo",
  "heicVer": "1.0",
  "width": 12,
  "height": 8,
  "make": "Apple",
  "model": "ShopCam",
  "frames": [
    { "name": "primary", "kind": "primary", "width": 12, "height": 8 },
    { "name": "thumbnail", "kind": "thumbnail", "width": 3, "height": 2 }
  ],
  "metas": [
    { "name": "make", "value": "Apple", "group": "meta" },
    { "name": "model", "value": "ShopCam", "group": "meta" },
    { "name": "iso", "value": "100", "group": "exif" },
    { "name": "exposure", "value": "1/60", "group": "exif" }
  ],
  "previews": [
    { "name": "slab", "kind": "rect", "colorHex": "#34d399", "x": 0, "y": 0, "w": 12, "h": 8 },
    { "name": "counter", "kind": "rect", "colorHex": "#60a5fa", "x": 1, "y": 1, "w": 3, "h": 1.2 },
    { "name": "storage", "kind": "rect", "colorHex": "#60a5fa", "x": 8, "y": 0.5, "w": 3.5, "h": 2 },
    { "name": "column", "kind": "circle", "colorHex": "#f87171", "x": 10, "y": 6, "r": 0.35 },
    { "name": "aisle", "kind": "line", "colorHex": "#fbbf24", "x": 6, "y": 1, "x2": 6, "y2": 7 },
    { "name": "title", "kind": "text", "colorHex": "#e2e8f0", "x": 4.2, "y": 4.2, "text": "ShopRanker" }
  ]
}
`;

export const HC_ASCII_SAMPLE = `HEIC dump ShopFloor 1.0
SIZE 12 8
FRAME primary 12 8
FRAME thumbnail 3 2
META make Apple
META model ShopCam
EXIF iso 100
EXIF exposure 1/60
SHAPE rect slab 0 0 12 8 #34d399
SHAPE rect counter 1 1 3 1.2 #60a5fa
SHAPE rect storage 8 0.5 3.5 2 #60a5fa
SHAPE circle column 10 6 0.35 #f87171
SHAPE line aisle 6 1 6 7 #fbbf24
TEXT ShopRanker 4.2 4.2
`;

export const HC_CSV_SAMPLE = `name,type,kind,frame,meta,value
primary,frame,primary,primary,,12x8
thumbnail,frame,thumbnail,thumbnail,,3x2
make,meta,meta,,make,Apple
model,meta,meta,,model,ShopCam
iso,exif,exif,,iso,100
exposure,exif,exif,,exposure,1/60
slab,preview,rect,primary,,12x8
counter,preview,rect,primary,,3x1.2
column,preview,circle,primary,,0.35
aisle,preview,line,primary,,aisle
title,preview,text,primary,,ShopRanker
`;

export const HC_MARKDOWN_SAMPLE = `# ShopFloor

name: STRING
type: STRING
kind: STRING

primary | frame | primary
thumbnail | frame | thumbnail
make | meta | Apple
model | meta | ShopCam
iso | exif | 100
exposure | exif | 1/60
slab | preview | rect
column | preview | circle
title | preview | text
`;
