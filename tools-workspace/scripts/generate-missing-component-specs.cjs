#!/usr/bin/env node
/**
 * Generate smoke unit specs for any libs component folder missing a .spec.ts file.
 * Safe, idempotent — never overwrites existing specs.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIBS = path.join(ROOT, 'libs');

function toPascal(kebab) {
  return kebab
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function classNameFromFile(filePath, fallbackStem) {
  const src = fs.readFileSync(filePath, 'utf8');
  const match = src.match(/export class\s+(\w+)/);
  return match ? match[1] : `${toPascal(fallbackStem)}Component`;
}

function buildPdfSpec(className, stem) {
  return `import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { ${className} } from './${stem}';

describe('${className}', () => {
  let fixture: ComponentFixture<${className}>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [${className}],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(${className});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
`;
}

function buildClassSpec(className, stem) {
  return `import { ${className} } from './${stem}';

describe('${className}', () => {
  it('exposes the component class for routing', () => {
    expect(${className}).toBeTruthy();
  });
});
`;
}

let created = 0;
let skipped = 0;

for (const lib of fs.readdirSync(LIBS)) {
  const componentRoot = path.join(LIBS, lib, 'src/lib/component');
  if (!fs.existsSync(componentRoot)) continue;

  for (const dirName of fs.readdirSync(componentRoot)) {
    const dir = path.join(componentRoot, dirName);
    if (!fs.statSync(dir).isDirectory()) continue;

    const tsFiles = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && f !== 'index.ts');

    for (const file of tsFiles) {
      const stem = file.replace(/\.ts$/, '');
      const tsPath = path.join(dir, file);
      const specPath = path.join(dir, `${stem}.spec.ts`);
      if (fs.existsSync(specPath)) {
        skipped++;
        continue;
      }

      const src = fs.readFileSync(tsPath, 'utf8');
      if (!src.includes('@Component')) {
        skipped++;
        continue;
      }

      const className = classNameFromFile(tsPath, stem);
      const content =
        lib === 'pdf-tools'
          ? buildPdfSpec(className, stem)
          : buildClassSpec(className, stem);

      fs.writeFileSync(specPath, content);
      created++;
      console.log(`+ ${path.relative(ROOT, specPath)}`);
    }
  }
}

console.log(`Created ${created} missing specs (skipped existing/non-components: ${skipped}).`);
