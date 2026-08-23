import { compareCatalogNames, sortCatalogByName, toHomeToolCategories } from './tools-catalog.helpers';
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

  it('keeps home categories in ascending order', () => {
    const homeCategories = toHomeToolCategories(catalog);
    expect(homeCategories.map((category) => category.name)).toEqual([
      'CAD & Engineering Viewers',
      'PDF Tools',
      'Text & Utilities',
    ]);
  });
});
