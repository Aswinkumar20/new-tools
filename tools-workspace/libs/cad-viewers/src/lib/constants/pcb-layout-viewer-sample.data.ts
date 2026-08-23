/** Sensor board PCB snippets PCB snippets (education / research). */

export const PB_ASCII_SAMPLE = `PCB dump Sensor-Board v1
LAYER TOP_SILK silk 0
LAYER TOP_MASK mask 1
LAYER TOP_COPPER copper 2
LAYER INNER1 copper 3
LAYER BOTTOM_COPPER copper 4
NET GND ground
NET VCC power
NET SDA signal
TRACK south TOP_COPPER GND 0 0 12 0 0.2
TRACK east TOP_COPPER GND 7 0 7 5 0.2
TRACK north TOP_COPPER GND 7 5 0 5 0.2
TRACK west TOP_COPPER GND 0 5 0 0 0.2
TRACK aisle TOP_COPPER VCC 6 1 6 7 0.15
ZONE counter TOP_COPPER GND 1,1 4,1 4,2.2 1,2.2 1,1
VIA via1 GND 10 6 0.35
PAD vcc-pad VCC TOP_COPPER 2 2 0.4
TEXT title TOP_SILK 4.2 4.2 SENSOR-BOARD
`;

export const PB_JSON_SAMPLE = `{
  "name": "Sensor Board",
  "boardVer": "v1",
  "units": "mm",
  "layers": [
    { "name": "TOP_SILK", "function": "silk", "stackIndex": 0, "color": 7 },
    { "name": "TOP_MASK", "function": "mask", "stackIndex": 1, "color": 3 },
    { "name": "TOP_COPPER", "function": "copper", "stackIndex": 2, "color": 4 },
    { "name": "INNER1", "function": "copper", "stackIndex": 3, "color": 1 },
    { "name": "BOTTOM_COPPER", "function": "copper", "stackIndex": 4, "color": 5 }
  ],
  "nets": [
    { "name": "GND", "netClass": "ground" },
    { "name": "VCC", "netClass": "power" },
    { "name": "SDA", "netClass": "signal" }
  ],
  "traces": [
    { "name": "south", "type": "track", "layer": "TOP_COPPER", "net": "GND", "x": 0, "y": 0, "x2": 7, "y2": 0, "width": 0.2 },
    { "name": "east", "type": "track", "layer": "TOP_COPPER", "net": "GND", "x": 7, "y": 0, "x2": 7, "y2": 5, "width": 0.2 },
    { "name": "north", "type": "track", "layer": "TOP_COPPER", "net": "GND", "x": 7, "y": 8, "x2": 0, "y2": 5, "width": 0.2 },
    { "name": "west", "type": "track", "layer": "TOP_COPPER", "net": "GND", "x": 0, "y": 5, "x2": 0, "y2": 0, "width": 0.2 },
    { "name": "aisle", "type": "track", "layer": "TOP_COPPER", "net": "VCC", "x": 6, "y": 1, "x2": 6, "y2": 7, "width": 0.15 },
    { "name": "counter", "type": "zone", "layer": "TOP_COPPER", "net": "GND", "points": [[1,1],[4,1],[4,2.2],[1,2.2],[1,1]] },
    { "name": "via1", "type": "via", "layer": "TOP_COPPER", "net": "GND", "x": 10, "y": 6, "r": 0.35 },
    { "name": "vcc-pad", "type": "pad", "layer": "TOP_COPPER", "net": "VCC", "x": 2, "y": 2, "r": 0.4 },
    { "name": "title", "type": "text", "layer": "TOP_SILK", "net": "", "x": 4.2, "y": 4.2, "text": "SENSOR-BOARD" }
  ]
}
`;

export const PB_CSV_SAMPLE = `name,type,layer,net,x,y,x2,y2,r,text
TOP_COPPER,layer,TOP_COPPER,,,,,,
GND,net,,GND,,,,,
south,track,TOP_COPPER,GND,0,0,7,0,,
via1,via,TOP_COPPER,GND,10,6,,,0.35,
vcc-pad,pad,TOP_COPPER,VCC,2,2,,,0.4,
title,text,TOP_SILK,,4.2,4.2,,,,SENSOR-BOARD
`;

export const PB_MARKDOWN_SAMPLE = `# Sensor Board

name: STRING
type: STRING
layer: STRING
net: STRING

TOP_COPPER | layer | TOP_COPPER
GND | net | | GND
south | track | TOP_COPPER | GND
via1 | via | TOP_COPPER | GND
title | text | TOP_SILK
`;
