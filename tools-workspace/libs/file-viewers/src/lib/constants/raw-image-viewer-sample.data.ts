/** Synthetic ShopFloor camera RAW snippets (education / research). */

export const RW_JSON_SAMPLE = `{
  "name": "ShopFloor",
  "title": "ShopFloor RAW",
  "rawVer": "1.0",
  "width": 12,
  "height": 8,
  "make": "Canon",
  "model": "ShopCam",
  "format": "CR2",
  "iso": "200",
  "demosaic": "bayer-rggb",
  "channels": [
    { "name": "red", "kind": "red", "pattern": "RGGB" },
    { "name": "green", "kind": "green", "pattern": "RGGB" },
    { "name": "blue", "kind": "blue", "pattern": "RGGB" }
  ],
  "exifs": [
    { "name": "iso", "value": "200" },
    { "name": "shutter", "value": "1/125" },
    { "name": "aperture", "value": "f/2.8" },
    { "name": "wb", "value": "daylight" }
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

export const RW_ASCII_SAMPLE = `RAW dump ShopFloor 1.0
SIZE 12 8
MAKE Canon
MODEL ShopCam
FORMAT CR2
ISO 200
DEMOSAIC bayer-rggb
CHANNEL red RGGB
CHANNEL green RGGB
CHANNEL blue RGGB
EXIF iso 200
EXIF shutter 1/125
EXIF aperture f/2.8
EXIF wb daylight
SHAPE rect slab 0 0 12 8 #34d399
SHAPE rect counter 1 1 3 1.2 #60a5fa
SHAPE rect storage 8 0.5 3.5 2 #60a5fa
SHAPE circle column 10 6 0.35 #f87171
SHAPE line aisle 6 1 6 7 #fbbf24
TEXT ShopRanker 4.2 4.2
`;

export const RW_CSV_SAMPLE = `name,type,kind,channel,exif,value
red,channel,red,red,,RGGB
green,channel,green,green,,RGGB
blue,channel,blue,blue,,RGGB
iso,exif,exif,,iso,200
shutter,exif,exif,,shutter,1/125
aperture,exif,exif,,aperture,f/2.8
wb,exif,exif,,wb,daylight
slab,preview,rect,red,,12x8
counter,preview,rect,green,,3x1.2
column,preview,circle,blue,,0.35
aisle,preview,line,green,,aisle
title,preview,text,red,,ShopRanker
`;

export const RW_MARKDOWN_SAMPLE = `# ShopFloor

name: STRING
type: STRING
kind: STRING

red | channel | red
green | channel | green
blue | channel | blue
iso | exif | 200
shutter | exif | 1/125
slab | preview | rect
column | preview | circle
title | preview | text
`;
