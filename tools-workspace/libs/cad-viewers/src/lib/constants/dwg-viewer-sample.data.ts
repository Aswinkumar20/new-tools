/** Office L2 DWG dump snippets (education / research). */

export const DW_JSON_SAMPLE = `{
  "name": "Office L2",
  "version": "AC1027",
  "units": "m",
  "layers": [
    { "name": "A-WALL", "color": 1, "visible": true },
    { "name": "A-FURN", "color": 5, "visible": true },
    { "name": "A-ANNO", "color": 3, "visible": true },
    { "name": "A-DIMS", "color": 6, "visible": true }
  ],
  "entities": [
    { "name": "south-wall", "type": "line", "layer": "A-WALL", "x": 0, "y": 0, "x2": 18, "y2": 0 },
    { "name": "east-wall", "type": "line", "layer": "A-WALL", "x": 18, "y": 0, "x2": 18, "y2": 12 },
    { "name": "north-wall", "type": "line", "layer": "A-WALL", "x": 18, "y": 12, "x2": 0, "y2": 12 },
    { "name": "west-wall", "type": "line", "layer": "A-WALL", "x": 0, "y": 12, "x2": 0, "y2": 0 },
    { "name": "desk", "type": "polyline", "layer": "A-FURN", "points": [[2,2],[6,2],[6,3.4],[2,3.4]] },
    { "name": "column", "type": "circle", "layer": "A-FURN", "x": 15, "y": 9, "r": 0.4 },
    { "name": "corridor", "type": "line", "layer": "A-FURN", "x": 9, "y": 1, "x2": 9, "y2": 11 },
    { "name": "title", "type": "text", "layer": "A-ANNO", "x": 7, "y": 6, "text": "OFFICE L2" }
  ],
  "measurements": [
    { "name": "bay-width", "type": "distance", "layer": "A-DIMS", "value": 18, "unit": "m", "label": "18 m width" },
    { "name": "bay-depth", "type": "distance", "layer": "A-DIMS", "value": 12, "unit": "m", "label": "12 m depth" },
    { "name": "desk-length", "type": "distance", "layer": "A-DIMS", "value": 4, "unit": "m", "label": "4 m desk" }
  ]
}
`;

export const DW_CSV_SAMPLE = `name,type,layer,x,y,x2,y2,r,text
A-WALL,layer,A-WALL,,,,,
A-FURN,layer,A-FURN,,,,,
south-wall,line,A-WALL,0,0,18,0,,
east-wall,line,A-WALL,18,0,18,12,,
north-wall,line,A-WALL,18,12,0,12,,
west-wall,line,A-WALL,0,12,0,0,,
column,circle,A-FURN,15,9,,,0.4,
title,text,A-ANNO,7,6,,,,OFFICE L2
bay-width,distance,A-DIMS,,,,,,18 m width
`;

export const DW_MARKDOWN_SAMPLE = `# Office L2

name: STRING
type: STRING
layer: STRING

A-WALL | layer | A-WALL
A-FURN | layer | A-FURN
south-wall | line | A-WALL
east-wall | line | A-WALL
north-wall | line | A-WALL
west-wall | line | A-WALL
column | circle | A-FURN
title | text | A-ANNO
`;
