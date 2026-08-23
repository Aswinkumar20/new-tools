/** Impeller hub IGES snippets (education / research). */

export const IG_JSON_SAMPLE = `{
  "name": "Impeller Hub",
  "version": "5.3",
  "units": "m",
  "surfaces": [
    { "name": "hub", "kind": "plane", "cx": 6, "cy": 4, "cz": 0, "sx": 12, "sy": 8 },
    { "name": "shroud", "kind": "plane", "cx": 6, "cy": 0, "cz": 1.2, "sx": 12, "sy": 0.05, "sz": 2.4 },
    { "name": "blade", "kind": "plane", "cx": 2.5, "cy": 1.6, "cz": 0.9, "sx": 3, "sy": 1.2 },
    { "name": "bore", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "entities": [
    { "name": "hub-edge", "type": "line", "typeCode": 110, "surface": "shroud", "x": 0, "y": 0, "z": 0 },
    { "name": "bore-axis", "type": "line", "typeCode": 110, "surface": "bore", "x": 10, "y": 6, "z": 0 },
    { "name": "title", "type": "point", "typeCode": 116, "surface": "hub", "x": 4.2, "y": 4.2, "z": 0.15, "text": "ImpelHub01" }
  ]
}
`;

export const IG_ASCII_SAMPLE = `ImpelHub01 IGES dump                                                     S      1
1H,,1H;,4HIG01,10HImpelHub01,32,38,6,308,15,4HSF01,1.,2,2HMM,1,0.01,    G      1
15H20260101.000000,0.001,10000.,7HUnknown,7HUnknown,11,0,               G      2
15H20260101.000000;                                                     G      3
     110       1       0       0       0       0       0       000000001D      1
     110       0       0       1       0                               0D      2
     120       2       0       0       0       0       0       000000002D      3
     120       0       0       1       0                               0D      4
     144       3       0       0       0       0       0       000000003D      5
     144       0       0       1       0                               0D      6
110,0.,0.,0.,12.,0.,0.;                                                 P      1
S      1G      3D      6P      1                                        T      1
`;

export const IG_CSV_SAMPLE = `name,type,kind,cx,cy,cz,sx,sy,sz,r,h,text
hub,surface,plane,6,4,0,12,8,,,,
shroud,surface,plane,6,0,1.2,12,0.05,2.4,,,
bore,surface,cylinder,10,6,1.2,,,,0.35,2.4,
hub-edge,line,curve,,,,,,,,,
title,point,,,,,,,,,,ImpelHub01
`;

export const IG_MARKDOWN_SAMPLE = `# Impeller Hub

name: STRING
type: STRING
kind: STRING

hub | surface | plane
shroud | surface | plane
bore | surface | cylinder
hub-edge | line | curve
title | point | annotation
`;
