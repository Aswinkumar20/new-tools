/** Bracket plate DXF snippets (education / research). */

export const DX_ASCII_SAMPLE = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1027
9
$INSUNITS
70
6
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
OUTLINE
62
1
0
LAYER
2
HOLES
62
5
0
LAYER
2
NOTES
62
3
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
OUTLINE
10
0.0
20
0.0
11
8.0
21
0.0
0
LINE
8
OUTLINE
10
8.0
20
0.0
11
8.0
21
5.0
0
LINE
8
OUTLINE
10
8.0
20
5.0
11
0.0
21
5.0
0
LINE
8
OUTLINE
10
0.0
20
5.0
11
0.0
21
0.0
0
LWPOLYLINE
8
OUTLINE
90
4
70
1
10
0.4
20
0.4
10
7.6
20
0.4
10
7.6
20
4.6
10
0.4
20
4.6
0
CIRCLE
8
HOLES
10
1.2
20
1.2
40
0.35
0
LINE
8
NOTES
10
4.0
20
0.4
11
4.0
21
4.6
0
TEXT
8
NOTES
10
2.4
20
2.4
1
BRACKET-PLATE
0
ENDSEC
0
EOF
`;

export const DX_JSON_SAMPLE = `{
  "name": "Bracket Plate",
  "acadVer": "AC1027",
  "units": "m",
  "layers": [
    { "name": "OUTLINE", "color": 1 },
    { "name": "HOLES", "color": 5 },
    { "name": "NOTES", "color": 3 }
  ],
  "entities": [
    { "name": "south-edge", "type": "line", "layer": "OUTLINE", "x": 0, "y": 0, "x2": 8, "y2": 0 },
    { "name": "east-edge", "type": "line", "layer": "OUTLINE", "x": 8, "y": 0, "x2": 8, "y2": 5 },
    { "name": "north-edge", "type": "line", "layer": "OUTLINE", "x": 8, "y": 5, "x2": 0, "y2": 5 },
    { "name": "west-edge", "type": "line", "layer": "OUTLINE", "x": 0, "y": 5, "x2": 0, "y2": 0 },
    { "name": "plate", "type": "lwpolyline", "layer": "OUTLINE", "points": [[0.4,0.4],[7.6,0.4],[7.6,4.6],[0.4,4.6]] },
    { "name": "hole1", "type": "circle", "layer": "HOLES", "x": 1.2, "y": 1.2, "r": 0.35 },
    { "name": "centerline", "type": "line", "layer": "NOTES", "x": 4, "y": 0.4, "x2": 4, "y2": 4.6 },
    { "name": "title", "type": "text", "layer": "NOTES", "x": 2.4, "y": 2.4, "text": "BRACKET-PLATE" }
  ]
}
`;

export const DX_CSV_SAMPLE = `name,type,layer,x,y,x2,y2,r,text
OUTLINE,layer,OUTLINE,,,,,
HOLES,layer,HOLES,,,,,
south-edge,line,OUTLINE,0,0,8,0,,
east-edge,line,OUTLINE,8,0,8,5,,
north-edge,line,OUTLINE,8,5,0,5,,
west-edge,line,OUTLINE,0,5,0,0,,
hole1,circle,HOLES,1.2,1.2,,,0.35,
title,text,NOTES,2.4,2.4,,,,BRACKET-PLATE
`;

export const DX_MARKDOWN_SAMPLE = `# Bracket Plate

name: STRING
type: STRING
layer: STRING

OUTLINE | layer | OUTLINE
HOLES | layer | HOLES
south-edge | line | OUTLINE
east-edge | line | OUTLINE
north-edge | line | OUTLINE
west-edge | line | OUTLINE
hole1 | circle | HOLES
title | text | NOTES
`;
