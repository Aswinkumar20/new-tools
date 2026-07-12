import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'apps/tools-site/assets');
const homeAssetsDir = path.join(root, 'libs/features-home/src/lib/component/myComponent/assets');

function walkSvgs(dir, prefix = '') {
  const out = new Set();
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) walkSvgs(path.join(dir, e.name), rel).forEach((x) => out.add(x));
    else if (e.name.endsWith('.svg')) out.add(rel);
  }
  return out;
}

const mainAssets = walkSvgs(assetsDir);
const homeAssets = walkSvgs(homeAssetsDir);

const exts = ['.html', '.ts', '.scss', '.mjs'];
const refs = new Map();

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules', 'dist', '.git'].includes(e.name)) scanDir(full);
    else if (exts.some((x) => e.name.endsWith(x))) {
      const content = fs.readFileSync(full, 'utf8');
      const relFile = path.relative(root, full);
      const patterns = [
        /getAssetPath\(['"]([^'"]+\.svg)['"]\)/g,
        /getAssetPath\(`([^`]+\.svg)`\)/g,
        /getAssetPath\([^)]*\?\s*['"]([^'"]+\.svg)['"]\s*:\s*['"]([^'"]+\.svg)['"]/g,
        /['"](icons\/[^'"]+\.svg)['"]/g,
        /['"](tool-icons\/[^'"]+\.svg)['"]/g,
        /['"](logo[^'"]*\.svg)['"]/g,
        /copyIcon[^=]*=\s*['"]([^'"]+\.svg)['"]/g,
      ];
      for (const p of patterns) {
        let m;
        while ((m = p.exec(content))) {
          for (let i = 1; i < m.length; i++) {
            const ref = m[i];
            if (!ref || ref.includes('${')) continue;
            if (!refs.has(ref)) refs.set(ref, []);
            if (!refs.get(ref).includes(relFile)) refs.get(ref).push(relFile);
          }
        }
      }
      // ternary in getAssetPath
      const ternary = [...content.matchAll(/getAssetPath\([^)]+\?\s*'([^']+\.svg)'\s*:\s*'([^']+\.svg)'\)/g)];
      for (const m of ternary) {
        for (const ref of [m[1], m[2]]) {
          if (!refs.has(ref)) refs.set(ref, []);
          if (!refs.get(ref).includes(relFile)) refs.get(ref).push(relFile);
        }
      }
    }
  }
}

['libs', 'apps', 'scripts'].forEach((d) => scanDir(path.join(root, d)));

const myCompPath = path.join(root, 'libs/features-home/src/lib/component/myComponent/my-component.ts');
const myComp = fs.readFileSync(myCompPath, 'utf8');
const categoryIconFiles = {};
const catBlock = myComp.match(/categoryIconFiles: Record<string, string> = \{([\s\S]*?)\};/);
if (catBlock) {
  for (const m of catBlock[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) {
    categoryIconFiles[m[1]] = m[2];
  }
}

const toolNames = [...myComp.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
const dynamicRefs = new Map();

for (const [, file] of Object.entries(categoryIconFiles)) {
  dynamicRefs.set(`icons/categories/${file}`, ['category mapping']);
}
for (const name of toolNames) {
  if (categoryIconFiles[name]) continue;
  const segments = name.toLowerCase().match(/[a-z0-9]+/g);
  const slug = segments?.join('-') ?? 'icon';
  const p = `icons/categories/${slug}.svg`;
  if (!dynamicRefs.has(p)) dynamicRefs.set(p, []);
  dynamicRefs.get(p).push(name);
}

function missingFrom(map, assetSet) {
  return [...map.entries()]
    .filter(([r]) => !assetSet.has(r))
    .map(([r, sources]) => ({ path: r, sources }));
}

const staticMissing = missingFrom(refs, mainAssets);
const dynamicMissing = missingFrom(dynamicRefs, mainAssets);

console.log('=== STATIC SVG REFERENCES (apps/tools-site/assets) ===');
console.log(`Referenced: ${refs.size}, Missing: ${staticMissing.length}`);
for (const m of staticMissing.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`MISSING: ${m.path}`);
  m.sources.slice(0, 2).forEach((s) => console.log(`  <- ${s}`));
}

console.log('\n=== DYNAMIC HOMEPAGE TOOL ICONS (icons/categories/) ===');
console.log(`Expected: ${dynamicRefs.size}, Missing: ${dynamicMissing.length}`);
for (const m of dynamicMissing.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`MISSING: ${m.path} (${m.sources[0]})`);
}

console.log('\n=== OTHER ===');
console.log(`og-image.svg in assets: ${mainAssets.has('og-image.svg')}`);
console.log(`og-image.svg in public: ${fs.existsSync(path.join(root, 'apps/tools-site/public/og-image.svg'))}`);
console.log(`upload.svg in assets: ${mainAssets.has('icons/upload.svg')}`);
