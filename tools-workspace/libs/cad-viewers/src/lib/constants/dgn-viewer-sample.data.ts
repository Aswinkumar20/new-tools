/** Site corridor DGN dump snippets (education / research). */

export const DG_JSON_SAMPLE = `{
  "name": "Site Corridor",
  "version": "V8",
  "units": "m",
  "levels": [
    { "name": "ROW", "color": 1, "visible": true },
    { "name": "ALIGN", "color": 5, "visible": true },
    { "name": "CIVIL", "color": 4, "visible": true },
    { "name": "ANNO", "color": 3, "visible": true }
  ],
  "entities": [
    { "name": "south-row", "type": "line", "level": "ROW", "x": 0, "y": 0, "x2": 20, "y2": 0 },
    { "name": "east-row", "type": "line", "level": "ROW", "x": 20, "y": 0, "x2": 20, "y2": 6 },
    { "name": "north-row", "type": "line", "level": "ROW", "x": 20, "y": 6, "x2": 0, "y2": 6 },
    { "name": "west-row", "type": "line", "level": "ROW", "x": 0, "y": 6, "x2": 0, "y2": 0 },
    { "name": "manhole", "type": "circle", "level": "ALIGN", "x": 16, "y": 4.5, "r": 0.4 },
    { "name": "title", "type": "text", "level": "ANNO", "x": 7, "y": 3, "text": "SITE CORRIDOR" }
  ],
  "civil": [
    { "name": "centerline", "type": "alignment", "level": "CIVIL", "points": [[1,3],[19,3]], "length": 18, "label": "18 m CL" },
    { "name": "site-contour", "type": "contour", "level": "CIVIL", "elevation": 1.5, "points": [[0.5,0.4],[19.5,0.4],[19.5,5.6],[0.5,5.6]] },
    { "name": "entry-station", "type": "station", "level": "CIVIL", "points": [[1,3]], "label": "STA 0+00" }
  ]
}
`;

export const DG_CSV_SAMPLE = `name,type,level,x,y,x2,y2,r,text,elevation
ROW,level,ROW,,,,,,,
ALIGN,level,ALIGN,,,,,,,
CIVIL,level,CIVIL,,,,,,,
south-row,line,ROW,0,0,20,0,,,
east-row,line,ROW,20,0,20,6,,,
north-row,line,ROW,20,6,0,6,,,
west-row,line,ROW,0,6,0,0,,,
manhole,circle,ALIGN,16,4.5,,,0.4,,
title,text,ANNO,7,3,,,,SITE CORRIDOR,
centerline,alignment,CIVIL,1,3,19,3,,,18 m CL,
site-contour,contour,CIVIL,0.5,0.4,,,,,1.5
entry-station,station,CIVIL,1,3,,,,STA 0+00,
`;

export const DG_MARKDOWN_SAMPLE = `# Site Corridor

name: STRING
type: STRING
level: STRING

ROW | level | ROW
ALIGN | level | ALIGN
CIVIL | level | CIVIL
south-row | line | ROW
east-row | line | ROW
north-row | line | ROW
west-row | line | ROW
manhole | circle | ALIGN
title | text | ANNO
centerline | alignment | CIVIL
site-contour | contour | CIVIL
entry-station | station | CIVIL
`;
