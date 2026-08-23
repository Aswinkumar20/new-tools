/** Faucet body Rhino snippets Rhino snippets (education / research). */

export const RH_JSON_SAMPLE = `{
  "name": "Faucet Body",
  "version": "8.0",
  "units": "m",
  "surfaces": [
    { "name": "bowl", "kind": "box", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "spout", "kind": "box", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "aerator", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "layers": [
    { "name": "Faucet Body", "description": "faucet body" },
    { "name": "FaucetBody", "description": "faucet body" }
  ],
  "instances": [
    { "name": "bowl-1", "surface": "bowl", "layer": "FaucetBody", "cx": 6, "cy": 4, "cz": 0.075 },
    { "name": "spout-1", "surface": "spout", "layer": "FaucetBody", "cx": 2.5, "cy": 1.6, "cz": 0.45 },
    { "name": "aerator-1", "surface": "aerator", "layer": "FaucetBody", "cx": 10, "cy": 6, "cz": 1.2 },
    { "name": "spout-2", "surface": "spout", "layer": "FaucetBody", "cx": 0, "cy": 0, "cz": 0.45 }
  ]
}
`;

export const RH_ASCII_SAMPLE = `Rhino dump Faucet-Body 8.0
SURFACE bowl BOX 12 8 0.15 AT 6 4 0.075
SURFACE spout BOX 3 1.2 0.9 AT 2.5 1.6 0.45
SURFACE aerator CYLINDER 0.35 2.4 AT 10 6 1.2
LAYER FaucetBody
LAYER FaucetBody
INSTANCE bowl-1 SURFACE bowl IN FaucetBody AT 6 4 0.075
INSTANCE spout-1 SURFACE spout IN FaucetBody AT 2.5 1.6 0.45
INSTANCE aerator-1 SURFACE aerator IN FaucetBody AT 10 6 1.2
INSTANCE spout-2 SURFACE spout IN FaucetBody AT 0 0 0.45
`;

export const RH_CSV_SAMPLE = `name,type,kind,surface,layer,cx,cy,cz,sx,sy,sz,r,h
bowl,surface,box,,,1.4,1.4,0.55,2.8,2.8,1.1,,
spout,surface,box,,,2.4,1.4,1.2,2.2,0.6,0.45,,
aerator,surface,cylinder,,,3.2,1.4,1.35,,,,0.22,0.35
FaucetBody,layer,,,,,,,,,
FaucetBody,layer,,,,,,,,,
bowl-1,instance,,bowl,FaucetBody,1.4,1.4,0.55,,,,,
aerator-1,instance,,aerator,FaucetBody,3.2,1.4,1.35,,,,,
`;

export const RH_MARKDOWN_SAMPLE = `# Faucet Body

name: STRING
type: STRING
kind: STRING

bowl | surface | box
spout | surface | box
aerator | surface | cylinder
FaucetBody | layer | layout
FaucetBody | layer | mount
bowl-1 | instance | bowl
`;
