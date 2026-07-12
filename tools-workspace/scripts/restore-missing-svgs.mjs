import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'libs/features-home/src/lib/component/myComponent/assets/tool-icons');
const destDir = path.join(root, 'apps/tools-site/assets/icons/categories');
const assetsDir = path.join(root, 'apps/tools-site/assets');

const aliases = {
  'log-file-viewer-analyzer.svg': 'log-file-viewer-and-analyzer.svg',
  'json-formatter-validator.svg': 'json-formatter-and-validator.svg',
  'json-linter-viewer.svg': 'json-linter-and-viewer.svg',
  'tables-charts-to-pdf.svg': 'tables-and-charts-to-pdf.svg',
  'resume-invoice-generator.svg': 'resume-and-invoice-generator.svg',
  'email-url-ip-checker.svg': 'email-url-and-ip-checker.svg',
  'text-encrypt-decrypt.svg': 'text-encrypt-and-decrypt.svg',
  'stopwatch-timer.svg': 'stopwatch-and-timer.svg',
  'coin-toss-dice-roller.svg': 'coin-toss-and-dice-roller.svg',
};

const myComp = fs.readFileSync(
  path.join(root, 'libs/features-home/src/lib/component/myComponent/my-component.ts'),
  'utf8'
);
const categoryIconFiles = {};
const catBlock = myComp.match(/categoryIconFiles: Record<string, string> = \{([\s\S]*?)\};/);
for (const m of catBlock[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) {
  categoryIconFiles[m[1]] = m[2];
}
const toolNames = [...myComp.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);

const needed = new Set();
for (const name of toolNames) {
  if (categoryIconFiles[name]) {
    needed.add(categoryIconFiles[name]);
    continue;
  }
  const slug = name.toLowerCase().match(/[a-z0-9]+/g)?.join('-') ?? 'icon';
  needed.add(`${slug}.svg`);
}

const homeIcons = new Set(fs.readdirSync(srcDir).filter((f) => f.endsWith('.svg')));
let copied = 0;
let aliased = 0;
let skipped = 0;

for (const file of needed) {
  const dest = path.join(destDir, file);
  if (fs.existsSync(dest)) {
    skipped++;
    continue;
  }
  const srcFile = path.join(srcDir, file);
  if (homeIcons.has(file) && fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, dest);
    copied++;
    continue;
  }
  const aliasSource = aliases[file];
  if (aliasSource) {
    const aliasPath = path.join(srcDir, aliasSource);
    if (fs.existsSync(aliasPath)) {
      fs.copyFileSync(aliasPath, dest);
      aliased++;
      continue;
    }
  }
  console.warn(`Still missing source for: ${file}`);
}

// og-image referenced as /assets/og-image.svg
const ogPublic = path.join(root, 'apps/tools-site/public/og-image.svg');
const ogAssets = path.join(assetsDir, 'og-image.svg');
if (fs.existsSync(ogPublic) && !fs.existsSync(ogAssets)) {
  fs.copyFileSync(ogPublic, ogAssets);
  console.log('Copied og-image.svg to assets/');
}

console.log(`Category icons: copied=${copied}, aliased=${aliased}, skipped=${skipped}`);
