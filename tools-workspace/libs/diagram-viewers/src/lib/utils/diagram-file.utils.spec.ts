import { buildDiagramInsightStats, formatDiagramFileSize, getDiagramFileExtension } from './diagram-file.utils';

describe('buildDiagramInsightStats', () => {
  const formatSize = (n: number) => `${n} B`;

  it('uses boxes and connectors for architecture dumps', () => {
    const stats = buildDiagramInsightStats(
      { boxes: [{}, {}, {}], connectors: [{}, {}] },
      1,
      2048,
      [],
      formatSize
    );
    expect(stats.files).toBe(1);
    expect(stats.groupLabel).toBe('Boxes');
    expect(stats.groupCount).toBe(3);
    expect(stats.itemLabel).toBe('Connectors');
    expect(stats.itemCount).toBe(2);
    expect(stats.sizeLabel).toBe('Size');
    expect(stats.sizeValue).toBe('2048 B');
  });

  it('uses nodes and edges for graph dumps', () => {
    const stats = buildDiagramInsightStats(
      { nodes: [{}, {}], edges: [{}] },
      2,
      null,
      ['soft warning'],
      formatSize
    );
    expect(stats.groupLabel).toBe('Nodes');
    expect(stats.groupCount).toBe(2);
    expect(stats.itemLabel).toBe('Edges');
    expect(stats.itemCount).toBe(1);
    expect(stats.sizeLabel).toBe('Warnings');
    expect(stats.sizeValue).toBe('1');
  });

  it('prefers tables and fks for schema dumps', () => {
    const stats = buildDiagramInsightStats(
      { tables: [{}, {}], fks: [{}] },
      1,
      10,
      [],
      formatSize
    );
    expect(stats.groupLabel).toBe('Tables');
    expect(stats.itemLabel).toBe('FKs');
  });

  it('formats sizes and extensions', () => {
    expect(formatDiagramFileSize(512)).toBe('512 B');
    expect(formatDiagramFileSize(2048)).toBe('2.0 KB');
    expect(getDiagramFileExtension('shop.puml')).toBe('.puml');
    expect(getDiagramFileExtension('README')).toBe('');
  });
});
