/** Synthetic shop package graphs (education / research). */

export const DEP_SAMPLE = `{
  "name": "shop",
  "lockfileVersion": 3,
  "packages": {
    "": {
      "name": "shop",
      "dependencies": {
        "express": "^4.18.2",
        "lib-a": "^1.0.0"
      }
    },
    "node_modules/express": {
      "version": "4.18.2",
      "dependencies": {
        "debug": "^4.3.4",
        "qs": "^6.11.0"
      }
    },
    "node_modules/debug": {
      "version": "4.3.4",
      "dependencies": { "ms": "^2.1.2" }
    },
    "node_modules/ms": { "version": "2.1.3" },
    "node_modules/qs": { "version": "6.11.0" },
    "node_modules/lib-a": {
      "version": "1.0.0",
      "dependencies": { "lib-b": "^1.0.0" }
    },
    "node_modules/lib-b": {
      "version": "1.0.0",
      "dependencies": { "lib-a": "^1.0.0" }
    }
  }
}
`;

export const DEP_JSON_SAMPLE = `{
  "name": "shop",
  "packages": [
    { "id": "shop", "name": "shop", "version": "1.0.0", "kind": "root" },
    { "id": "express", "name": "express", "version": "4.18.2" }
  ],
  "edges": [
    { "source": "shop", "target": "express", "spec": "^4.18.2" }
  ]
}
`;

export const DEP_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<dependencies name="Shop">
  <package id="shop" name="shop" version="1.0.0" kind="root"/>
  <package id="express" name="express" version="4.18.2"/>
  <edge source="shop" target="express" spec="^4.18.2"/>
</dependencies>
`;

export const DEP_MARKDOWN_SAMPLE = `# Shop

\`\`\`
shop -> express
express -> debug
\`\`\`
`;

export const DEP_YARN_SAMPLE = `# yarn lockfile v1

express@^4.18.2:
  version "4.18.2"
  dependencies:
    debug "^4.3.4"

debug@^4.3.4:
  version "4.3.4"
`;
