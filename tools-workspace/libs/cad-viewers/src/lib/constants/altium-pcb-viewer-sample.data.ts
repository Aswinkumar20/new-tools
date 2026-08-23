/** Power module Altium snippets Altium snippets (education / research). */

export const AL_ASCII_SAMPLE = `Altium dump Power-Module 24.0
LAYER TopLayer copper 0
LAYER BottomLayer copper 1
LAYER TopOverlay silk 2
LAYER TopSolder mask 3
NET GND ground
NET VIN power
NET VOUT signal
TRACK south TopLayer GND 0 0 12 0 0.2
TRACK east TopLayer GND 9 0 9 6 0.2
TRACK north TopLayer GND 9 6 0 6 0.2
TRACK west TopLayer GND 0 6 0 0 0.2
TRACK aisle TopLayer VIN 6 1 6 7 0.15
ZONE counter TopLayer GND 1,1 4,1 4,2.2 1,2.2 1,1
VIA via1 GND 10 6 0.35
PAD vin-pad VIN TopLayer 2 2 0.4
DESIGNATOR U1 TopOverlay 4.2 4.2 U1
TEXT title TopOverlay 4.2 4.2 POWER-MODULE
COMPONENT U1 VOUT 2 6
`;

export const AL_ASCII_COPPER_SAMPLE = `CopperLayer TopLayer
Track south GND 0 0 12 0 0.2
Track aisle VIN 6 1 6 7 0.15
Via via1 GND 10 6 0.35
Designator U1 4.2 4.2 U1
Text title 4.2 4.2 POWER-MODULE
`;

export const AL_JSON_SAMPLE = `{
  "name": "Power Module",
  "altiumVer": "24.0",
  "units": "mm",
  "layers": [
    { "name": "TopLayer", "function": "copper", "stackIndex": 0, "color": 4 },
    { "name": "BottomLayer", "function": "copper", "stackIndex": 1, "color": 5 },
    { "name": "TopOverlay", "function": "silk", "stackIndex": 2, "color": 7 },
    { "name": "TopSolder", "function": "mask", "stackIndex": 3, "color": 3 }
  ],
  "nets": [
    { "name": "GND", "netClass": "ground" },
    { "name": "VIN", "netClass": "power" },
    { "name": "VOUT", "netClass": "signal" }
  ],
  "coppers": [
    { "name": "south", "type": "track", "layer": "TopLayer", "net": "GND", "x": 0, "y": 0, "x2": 9, "y2": 0, "width": 0.2 },
    { "name": "east", "type": "track", "layer": "TopLayer", "net": "GND", "x": 9, "y": 0, "x2": 9, "y2": 6, "width": 0.2 },
    { "name": "north", "type": "track", "layer": "TopLayer", "net": "GND", "x": 9, "y": 8, "x2": 0, "y2": 6, "width": 0.2 },
    { "name": "west", "type": "track", "layer": "TopLayer", "net": "GND", "x": 0, "y": 6, "x2": 0, "y2": 0, "width": 0.2 },
    { "name": "aisle", "type": "track", "layer": "TopLayer", "net": "VIN", "x": 6, "y": 1, "x2": 6, "y2": 7, "width": 0.15 },
    { "name": "counter", "type": "zone", "layer": "TopLayer", "net": "GND", "points": [[1,1],[4,1],[4,2.2],[1,2.2],[1,1]] },
    { "name": "via1", "type": "via", "layer": "TopLayer", "net": "GND", "x": 10, "y": 6, "r": 0.35 },
    { "name": "vin-pad", "type": "pad", "layer": "TopLayer", "net": "VIN", "x": 2, "y": 2, "r": 0.4 }
  ],
  "designators": [
    { "name": "U1", "type": "designator", "layer": "TopOverlay", "net": "VOUT", "x": 4.2, "y": 4.2, "text": "U1" },
    { "name": "title", "type": "text", "layer": "TopOverlay", "x": 4.2, "y": 4.2, "text": "POWER-MODULE" },
    { "name": "U1", "type": "component", "net": "VOUT", "x": 2, "y": 6, "text": "U1" }
  ]
}
`;

export const AL_CSV_SAMPLE = `name,type,layer,net,domain,x,y,x2,y2,r,text
TopLayer,layer,TopLayer,,,,,,,
GND,net,,GND,,,,,,
south,track,TopLayer,GND,copper,0,0,9,0,,
via1,via,TopLayer,GND,copper,10,6,,,0.35,
U1,designator,TopOverlay,VOUT,designator,4.2,4.2,,,,U1
title,text,TopOverlay,,designator,4.2,4.2,,,,POWER-MODULE
`;

export const AL_MARKDOWN_SAMPLE = `# Power Module

name: STRING
type: STRING
layer: STRING
net: STRING
domain: STRING

TopLayer | layer | TopLayer
GND | net | | GND
south | track | TopLayer | GND | copper
via1 | via | TopLayer | GND | copper
U1 | designator | TopOverlay | VOUT | designator
title | text | TopOverlay | | designator
`;
