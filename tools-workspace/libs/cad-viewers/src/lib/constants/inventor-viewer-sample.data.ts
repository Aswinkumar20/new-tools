/** Shaft collar Inventor snippets Inventor snippets (education / research). */

export const IV_JSON_SAMPLE = `{
  "name": "Shaft Collar",
  "version": "2025",
  "units": "m",
  "parts": [
    { "name": "collar", "kind": "box", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "boss", "kind": "box", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "bore", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "assemblies": [
    { "name": "Shaft Collar", "description": "shaft collar" },
    { "name": "ShaftCollar", "description": "shaft collar" }
  ],
  "instances": [
    { "name": "collar-1", "part": "collar", "assembly": "ShaftCollar", "cx": 6, "cy": 4, "cz": 0.075 },
    { "name": "boss-1", "part": "boss", "assembly": "ShaftCollar", "cx": 2.5, "cy": 1.6, "cz": 0.45 },
    { "name": "bore-1", "part": "bore", "assembly": "ShaftCollar", "cx": 10, "cy": 6, "cz": 1.2 },
    { "name": "boss-2", "part": "boss", "assembly": "ShaftCollar", "cx": 0, "cy": 0, "cz": 0.45 }
  ]
}
`;

export const IV_ASCII_SAMPLE = `Inventor dump Shaft-Collar 2025
IPT collar BOX 12 8 0.15 AT 6 4 0.075
IPT boss BOX 3 1.2 0.9 AT 2.5 1.6 0.45
IPT bore CYLINDER 0.35 2.4 AT 10 6 1.2
IAM ShaftCollar
ASSEMBLY ShaftCollar
INSTANCE collar-1 PART collar IN ShaftCollar AT 6 4 0.075
INSTANCE boss-1 PART boss IN ShaftCollar AT 2.5 1.6 0.45
INSTANCE bore-1 PART bore IN ShaftCollar AT 10 6 1.2
INSTANCE boss-2 PART boss IN ShaftCollar AT 0 0 0.45
`;

export const IV_CSV_SAMPLE = `name,type,kind,part,assembly,cx,cy,cz,sx,sy,sz,r,h
collar,part,box,,,1.2,1.2,0.4,2.4,2.4,0.8,,
boss,part,box,,,1.2,1.2,0.85,1.1,1.1,0.5,,
bore,part,cylinder,,,1.2,1.2,0.4,,,,0.55,0.8
ShaftCollar,assembly,,,,,,,,,
ShaftCollar,assembly,,,,,,,,,
collar-1,instance,,collar,ShaftCollar,1.2,1.2,0.4,,,,,
bore-1,instance,,bore,ShaftCollar,1.2,1.2,0.4,,,,,
`;

export const IV_MARKDOWN_SAMPLE = `# Shaft Collar

name: STRING
type: STRING
kind: STRING

collar | part | box
boss | part | box
bore | part | cylinder
ShaftCollar | assembly | layout
ShaftCollar | assembly | mount
collar-1 | instance | collar
`;
