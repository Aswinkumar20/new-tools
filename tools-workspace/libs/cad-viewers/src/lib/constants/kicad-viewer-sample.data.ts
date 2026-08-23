/** Nucleo hat KiCad snippets KiCad snippets (education / research). */

export const KC_ASCII_SAMPLE = `KiCad dump Nucleo-Hat 8.0
LAYER F.Cu copper 0
LAYER B.Cu copper 1
LAYER F.SilkS silk 2
LAYER F.Mask mask 3
NET GND ground
NET 3V3 power
NET SPI signal
TRACK south F.Cu GND 0 0 12 0 0.2
TRACK east F.Cu GND 8 0 8 5 0.2
TRACK north F.Cu GND 8 5 0 5 0.2
TRACK west F.Cu GND 0 5 0 0 0.2
TRACK aisle F.Cu 3V3 6 1 6 7 0.15
ZONE counter F.Cu GND 1,1 4,1 4,2.2 1,2.2 1,1
VIA via1 GND 10 6 0.35
PAD 3v3-pad 3V3 F.Cu 2 2 0.4
FOOTPRINT U1 F.Cu 4.2 4.2
TEXT title F.SilkS 4.2 4.2 NUCLEO-HAT
SYMBOL U1 SPI 2 6
WIRE w1 SPI 2 6 6 6
PIN U1-3V3 3V3 2 7
LABEL SPI SPI 6 6
`;

export const KC_SEXPR_SAMPLE = `(kicad_pcb (version 20240108)
  (general (thickness 1.6))
  (net 1 GND)
  (net 2 VCC)
  (segment (start 0 0) (end 12 0) (width 0.2) (layer "F.Cu") (net 1))
  (segment (start 12 0) (end 12 8) (width 0.2) (layer "F.Cu") (net 1))
  (via (at 10 6) (size 0.7) (drill 0.4) (net 1))
  (gr_text "NUCLEO-HAT" (at 4.2 4.2) (layer "F.SilkS"))
)
`;

export const KC_JSON_SAMPLE = `{
  "name": "Nucleo Hat",
  "kicadVer": "8.0",
  "units": "mm",
  "layers": [
    { "name": "F.Cu", "function": "copper", "stackIndex": 0, "color": 4 },
    { "name": "B.Cu", "function": "copper", "stackIndex": 1, "color": 5 },
    { "name": "F.SilkS", "function": "silk", "stackIndex": 2, "color": 7 },
    { "name": "F.Mask", "function": "mask", "stackIndex": 3, "color": 3 }
  ],
  "nets": [
    { "name": "GND", "netClass": "ground" },
    { "name": "3V3", "netClass": "power" },
    { "name": "SPI", "netClass": "signal" }
  ],
  "boardItems": [
    { "name": "south", "type": "track", "layer": "F.Cu", "net": "GND", "x": 0, "y": 0, "x2": 8, "y2": 0, "width": 0.2 },
    { "name": "east", "type": "track", "layer": "F.Cu", "net": "GND", "x": 8, "y": 0, "x2": 8, "y2": 5, "width": 0.2 },
    { "name": "north", "type": "track", "layer": "F.Cu", "net": "GND", "x": 8, "y": 8, "x2": 0, "y2": 5, "width": 0.2 },
    { "name": "west", "type": "track", "layer": "F.Cu", "net": "GND", "x": 0, "y": 5, "x2": 0, "y2": 0, "width": 0.2 },
    { "name": "aisle", "type": "track", "layer": "F.Cu", "net": "3V3", "x": 6, "y": 1, "x2": 6, "y2": 7, "width": 0.15 },
    { "name": "counter", "type": "zone", "layer": "F.Cu", "net": "GND", "points": [[1,1],[4,1],[4,2.2],[1,2.2],[1,1]] },
    { "name": "via1", "type": "via", "layer": "F.Cu", "net": "GND", "x": 10, "y": 6, "r": 0.35 },
    { "name": "3v3-pad", "type": "pad", "layer": "F.Cu", "net": "3V3", "x": 2, "y": 2, "r": 0.4 },
    { "name": "U1", "type": "footprint", "layer": "F.Cu", "x": 4.2, "y": 4.2, "text": "U1" },
    { "name": "title", "type": "text", "layer": "F.SilkS", "x": 4.2, "y": 4.2, "text": "NUCLEO-HAT" }
  ],
  "schItems": [
    { "name": "U1", "type": "symbol", "net": "SPI", "x": 2, "y": 6, "text": "U1" },
    { "name": "w1", "type": "wire", "net": "SPI", "x": 2, "y": 6, "x2": 6, "y2": 6 },
    { "name": "U1-3V3", "type": "pin", "net": "3V3", "x": 2, "y": 7, "r": 0.12 },
    { "name": "SPI", "type": "label", "net": "SPI", "x": 6, "y": 6, "text": "SPI" }
  ]
}
`;

export const KC_CSV_SAMPLE = `name,type,layer,net,domain,x,y,x2,y2,r,text
F.Cu,layer,F.Cu,,,,,,,
GND,net,,GND,,,,,,
south,track,F.Cu,GND,board,0,0,8,0,,
via1,via,F.Cu,GND,board,10,6,,,0.35,
U1,symbol,,SPI,schematic,2,6,,,,U1
w1,wire,,SPI,schematic,2,6,6,6,,
title,text,F.SilkS,,board,4.2,4.2,,,,NUCLEO-HAT
`;

export const KC_MARKDOWN_SAMPLE = `# Nucleo Hat

name: STRING
type: STRING
layer: STRING
net: STRING
domain: STRING

F.Cu | layer | F.Cu
GND | net | | GND
south | track | F.Cu | GND | board
via1 | via | F.Cu | GND | board
U1 | symbol | | SPI | schematic
title | text | F.SilkS | | board
`;
