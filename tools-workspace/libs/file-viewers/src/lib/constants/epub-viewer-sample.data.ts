/** Synthetic ShopRanker EPUB snippets (education / research). */

export const EP_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "title": "ShopRanker Handbook",
  "creator": "EasyToolHub",
  "language": "en",
  "epubVer": "3.0",
  "chapters": [
    {
      "name": "ch1",
      "title": "Introduction",
      "href": "ch1.xhtml",
      "text": "ShopRanker is a local handbook for the shop floor. The slab is twelve by eight metres."
    },
    {
      "name": "ch2",
      "title": "Shop floor",
      "href": "ch2.xhtml",
      "text": "A column stands at ten, six. Keep the aisle clear along the centre line."
    }
  ],
  "toc": [
    { "label": "Introduction", "href": "ch1.xhtml", "chapter": "ch1" },
    { "label": "Shop floor", "href": "ch2.xhtml", "chapter": "ch2" }
  ],
  "meta": [
    { "name": "title", "value": "ShopRanker Handbook" },
    { "name": "creator", "value": "EasyToolHub" },
    { "name": "language", "value": "en" }
  ]
}
`;

export const EP_ASCII_SAMPLE = `EPUB dump ShopRanker 3.0
META title ShopRanker Handbook
META creator EasyToolHub
META language en
TOC ch1 Introduction
TOC ch2 Shop floor
CHAPTER ch1 Introduction
ShopRanker is a local handbook for the shop floor. The slab is twelve by eight metres.
CHAPTER ch2 Shop floor
A column stands at ten, six. Keep the aisle clear along the centre line.
`;

export const EP_CSV_SAMPLE = `name,type,kind,chapter,toc,value
title,meta,,title,,ShopRanker Handbook
creator,meta,,creator,,EasyToolHub
language,meta,,language,,en
Introduction,toc,,ch1,Introduction,ch1
Shop floor,toc,,ch2,Shop floor,ch2
ch1,chapter,,ch1,Introduction,ShopRanker is a local handbook
ch2,chapter,,ch2,Shop floor,A column stands at ten
`;

export const EP_MARKDOWN_SAMPLE = `# ShopRanker Handbook

name: STRING
type: STRING
kind: STRING

title | meta | handbook
creator | meta | EasyToolHub
Introduction | toc | ch1
Shop floor | toc | ch2
ch1 | chapter | Introduction
ch2 | chapter | Shop floor
`;
