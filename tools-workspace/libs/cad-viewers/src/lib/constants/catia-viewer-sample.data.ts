/** Wing rib CATIA snippets CATIA snippets (education / research). */

export const CT_JSON_SAMPLE = `{
  "name": "Wing Rib",
  "version": "V5R31",
  "units": "m",
  "parts": [
    { "name": "web", "kind": "box", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "cap", "kind": "box", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "lightener", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "assemblies": [
    { "name": "Wing Rib", "description": "wing rib" },
    { "name": "WingRib", "description": "wing rib" }
  ],
  "instances": [
    { "name": "web-1", "part": "web", "assembly": "WingRib", "cx": 6, "cy": 4, "cz": 0.075 },
    { "name": "cap-1", "part": "cap", "assembly": "WingRib", "cx": 2.5, "cy": 1.6, "cz": 0.45 },
    { "name": "lightener-1", "part": "lightener", "assembly": "WingRib", "cx": 10, "cy": 6, "cz": 1.2 },
    { "name": "cap-2", "part": "cap", "assembly": "WingRib", "cx": 0, "cy": 0, "cz": 0.45 }
  ]
}
`;

export const CT_ASCII_SAMPLE = `CATProduct WingRib V5R31
CATPart web BOX 12 8 0.15 AT 6 4 0.075
CATPart cap BOX 3 1.2 0.9 AT 2.5 1.6 0.45
CATPart lightener CYLINDER 0.35 2.4 AT 10 6 1.2
PRODUCT WingRib
INSTANCE web-1 PART web IN WingRib AT 6 4 0.075
INSTANCE cap-1 PART cap IN WingRib AT 2.5 1.6 0.45
INSTANCE lightener-1 PART lightener IN WingRib AT 10 6 1.2
INSTANCE cap-2 PART cap IN WingRib AT 0 0 0.45
`;

export const CT_CSV_SAMPLE = `name,type,kind,part,assembly,cx,cy,cz,sx,sy,sz,r,h
web,part,box,,,4,0.2,1.1,8,0.4,2.2,,
cap,part,box,,,4,0.2,2.15,7.2,0.35,0.18,,
lightener,part,cylinder,,,4.5,0.2,1.1,,,,0.45,0.12
WingRib,assembly,,,,,,,,,
WingRib,assembly,,,,,,,,,
web-1,instance,,web,WingRib,4,0.2,1.1,,,,,
lightener-1,instance,,lightener,WingRib,4.5,0.2,1.1,,,,,
`;

export const CT_MARKDOWN_SAMPLE = `# Wing Rib

name: STRING
type: STRING
kind: STRING

web | part | box
cap | part | box
lightener | part | cylinder
WingRib | assembly | layout
WingRib | assembly | mount
web-1 | instance | web
`;
