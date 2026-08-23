/** Cabin massing SketchUp snippets SketchUp snippets (education / research). */

export const SK_JSON_SAMPLE = `{
  "name": "Cabin Massing",
  "version": "2024",
  "units": "m",
  "groups": [
    { "name": "slab", "kind": "box", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "wall", "kind": "box", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "chimney", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "components": [
    { "name": "Cabin Massing", "description": "cabin massing" },
    { "name": "CabinMassing", "description": "cabin massing" }
  ],
  "instances": [
    { "name": "slab-1", "group": "slab", "component": "CabinMassing", "cx": 6, "cy": 4, "cz": 0.075 },
    { "name": "wall-1", "group": "wall", "component": "CabinMassing", "cx": 2.5, "cy": 1.6, "cz": 0.45 },
    { "name": "chimney-1", "group": "chimney", "component": "CabinMassing", "cx": 10, "cy": 6, "cz": 1.2 },
    { "name": "wall-2", "group": "wall", "component": "CabinMassing", "cx": 0, "cy": 0, "cz": 0.45 }
  ]
}
`;

export const SK_ASCII_SAMPLE = `SketchUp dump Cabin-Massing 2024
GROUP slab BOX 12 8 0.15 AT 6 4 0.075
GROUP wall BOX 3 1.2 0.9 AT 2.5 1.6 0.45
GROUP chimney CYLINDER 0.35 2.4 AT 10 6 1.2
COMPONENT CabinMassing
COMPONENT CabinMassing
INSTANCE slab-1 GROUP slab IN CabinMassing AT 6 4 0.075
INSTANCE wall-1 GROUP wall IN CabinMassing AT 2.5 1.6 0.45
INSTANCE chimney-1 GROUP chimney IN CabinMassing AT 10 6 1.2
INSTANCE wall-2 GROUP wall IN CabinMassing AT 0 0 0.45
`;

export const SK_CSV_SAMPLE = `name,type,kind,group,component,cx,cy,cz,sx,sy,sz,r,h
slab,group,box,,,5,4,0.13,10,8,0.25,,
wall,group,box,,,5,0.15,1.6,10,0.3,3.0,,
chimney,group,cylinder,,,8.2,6.2,2.2,,,,0.4,4.2
CabinMassing,component,,,,,,,,,
CabinMassing,component,,,,,,,,,
slab-1,instance,,slab,CabinMassing,5,4,0.13,,,,,
chimney-1,instance,,chimney,CabinMassing,8.2,6.2,2.2,,,,,
`;

export const SK_MARKDOWN_SAMPLE = `# Cabin Massing

name: STRING
type: STRING
kind: STRING

slab | group | box
wall | group | box
chimney | group | cylinder
CabinMassing | component | layout
CabinMassing | component | mount
slab-1 | instance | slab
`;
