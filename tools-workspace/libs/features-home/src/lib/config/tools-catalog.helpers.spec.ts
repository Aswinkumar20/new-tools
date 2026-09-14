import {
  compareCatalogNames,
  pickGlobalPopularTools,
  sortCatalogByName,
  sortToolsByPopularity,
  splitHomeCategories,
  toHomeToolCategories,
} from './tools-catalog.helpers';
import { ToolCategoryCatalog } from './tools-catalog.generated';

describe('tools-catalog.helpers', () => {
  const catalog: ToolCategoryCatalog[] = [
    {
      name: 'Text & Utilities',
      description: 'Text tools',
      path: 'text-utilities',
      faIcon: 'fas fa-font',
      materialIcon: 'text_fields',
      subCategories: [
        { name: 'Slug Generator', description: 'Slugs', path: '/text-utilities/slug-generator' },
        { name: 'Base64 Encode & Decode', description: 'Base64', path: '/text-utilities/base64' },
      ],
    },
    {
      name: 'PDF Tools',
      description: 'PDF tools',
      path: 'pdf-tools',
      faIcon: 'fas fa-file-pdf',
      materialIcon: 'picture_as_pdf',
      subCategories: [
        { name: 'Merge PDFs', description: 'Merge', path: '/pdf-tools/merge-pdfs' },
        { name: 'Compress PDF', description: 'Compress', path: '/pdf-tools/compress-pdf' },
      ],
    },
    {
      name: 'CAD & Engineering Viewers',
      description: 'CAD tools',
      path: 'cad-viewers',
      faIcon: 'fas fa-drafting-compass',
      materialIcon: 'architecture',
      subCategories: [
        { name: 'DXF Viewer', description: 'DXF', path: '/cad-viewers/dxf-viewer' },
        { name: 'DWG Viewer', description: 'DWG', path: '/cad-viewers/dwg-viewer' },
      ],
    },
  ];

  it('compares names in ascending, case-insensitive order', () => {
    expect(compareCatalogNames('PDF Tools', 'CAD & Engineering Viewers')).toBeGreaterThan(0);
    expect(compareCatalogNames('cad', 'CAD')).toBe(0);
  });

  it('sorts categories and tools ascending by name', () => {
    const sorted = sortCatalogByName(catalog);

    expect(sorted.map((category) => category.name)).toEqual([
      'CAD & Engineering Viewers',
      'PDF Tools',
      'Text & Utilities',
    ]);
    expect(sorted[0].subCategories?.map((tool) => tool.name)).toEqual([
      'DWG Viewer',
      'DXF Viewer',
    ]);
    expect(sorted[1].subCategories?.map((tool) => tool.name)).toEqual([
      'Compress PDF',
      'Merge PDFs',
    ]);
  });

  it('sorts home categories and tools by popularity', () => {
    const homeCategories = toHomeToolCategories(catalog);

    expect(homeCategories.map((category) => category.path)).toEqual([
      'pdf-tools',
      'text-utilities',
      'cad-viewers',
    ]);
    expect(homeCategories[0].subCategories?.map((tool) => tool.path)).toEqual([
      '/pdf-tools/merge-pdfs',
      '/pdf-tools/compress-pdf',
    ]);
    expect(homeCategories[1].subCategories?.map((tool) => tool.path)).toEqual([
      '/text-utilities/slug-generator',
      '/text-utilities/base64',
    ]);
  });

  it('sorts tools within a category by popularity then name', () => {
    const pdfTools = sortToolsByPopularity('pdf-tools', catalog[1].subCategories ?? []);
    expect(pdfTools.map((tool) => tool.path)).toEqual([
      '/pdf-tools/merge-pdfs',
      '/pdf-tools/compress-pdf',
    ]);
  });

  it('picks global popular tools in configured order', () => {
    const all = catalog.flatMap((category) =>
      category.subCategories.map((tool) => ({
        name: tool.name,
        path: tool.path,
        category: category.name,
      }))
    );
    const popular = pickGlobalPopularTools(all, 2);
    expect(popular.map((tool) => tool.path)).toEqual(['/pdf-tools/merge-pdfs', '/pdf-tools/compress-pdf']);
  });

  it('splits home categories into everyday and specialist groups', () => {
    const homeCategories = toHomeToolCategories(catalog);
    const { primary, specialist } = splitHomeCategories(homeCategories);

    expect(primary.map((category) => category.path)).toEqual(['pdf-tools', 'text-utilities']);
    expect(specialist.map((category) => category.path)).toEqual(['cad-viewers']);
  });
});
