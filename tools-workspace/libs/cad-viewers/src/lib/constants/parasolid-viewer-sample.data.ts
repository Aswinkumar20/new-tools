/** Gearbox housing Parasolid snippets Parasolid snippets (education / research). */

export const PX_JSON_SAMPLE = `{
  "name": "Gearbox Housing",
  "schema": "PARASOLID 32.0",
  "units": "m",
  "bodies": [
    { "name": "GearboxHousing", "description": "gearbox housing" }
  ],
  "solids": [
    { "name": "case", "kind": "box", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "cover", "kind": "box", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "bore", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "measurements": [
    { "name": "case-width", "type": "distance", "value": 6, "unit": "m", "label": "6 m width" },
    { "name": "cover-length", "type": "distance", "value": 3, "unit": "m", "label": "1.8 m cover" },
    { "name": "bore-depth", "type": "distance", "value": 2.4, "unit": "m", "label": "1.6 m bore" }
  ]
}
`;

export const PX_ASCII_SAMPLE = `** Parasolid textual transmit **
SCHEME PARASOLID 32.0
PART GearboxHousing
BODY case BOX 12 8 0.15 AT 6 4 0.075
BODY cover BOX 3 1.2 0.9 AT 2.5 1.6 0.45
BODY bore CYLINDER 0.35 2.4 AT 10 6 1.2
END_OF_TRANSMIT
`;

export const PX_CSV_SAMPLE = `name,type,kind,cx,cy,cz,sx,sy,sz,r,h,value
GearboxHousing,body,,,,,,,,,,
case,solid,box,3,2,1.1,6,4,2.2,,,
cover,solid,box,3,2,2.3,5.4,3.6,0.2,,,
bore,solid,cylinder,3,2,1.1,,,,0.55,1.6,
case-width,distance,,,,,,,,,6
`;

export const PX_MARKDOWN_SAMPLE = `# Gearbox Housing

name: STRING
type: STRING
kind: STRING

GearboxHousing | body | assembly
case | solid | box
cover | solid | box
bore | solid | cylinder
case-width | distance | measure
`;
