import {
  buildDataInsightStats,
  entriesFromRecord,
  formatDataFileSize,
  looksLikeMarkdownDump,
  previewRecordLabel
} from './data-file.utils';

describe('data-file.utils', () => {
  describe('formatDataFileSize', () => {
    it('formats bytes, KB, and MB', () => {
      expect(formatDataFileSize(512)).toBe('512 B');
      expect(formatDataFileSize(2048)).toBe('2.0 KB');
      expect(formatDataFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    });
  });

  describe('previewRecordLabel', () => {
    it('uses the first populated fields instead of hardcoded column names', () => {
      expect(previewRecordLabel({ sku: 'TEE-NAVY', qty: '2', note: '' })).toBe('sku=TEE-NAVY · qty=2');
      expect(previewRecordLabel({ name: 'Ada', city: 'Paris' })).toBe('name=Ada · city=Paris');
      expect(previewRecordLabel({ a: '', b: '' }, 'row')).toBe('row');
      expect(previewRecordLabel(null, 'empty')).toBe('empty');
    });

    it('truncates long values', () => {
      const label = previewRecordLabel({ note: 'x'.repeat(50) });
      expect(label.startsWith('note=')).toBe(true);
      expect(label.endsWith('…')).toBe(true);
      expect(label.length).toBeLessThan(50);
    });
  });

  describe('looksLikeMarkdownDump', () => {
    it('recognizes markdown table dumps without treating native formats as markdown', () => {
      expect(looksLikeMarkdownDump('# Shop\n\norderId: NUMBER\n1001 | TEE', 'shop.md')).toBe(true);
      expect(looksLikeMarkdownDump('# Shop\n\norderId: NUMBER\n1001 | TEE', 'shop.yaml', ['yaml', 'yml'])).toBe(false);
      expect(looksLikeMarkdownDump('name: Shop\nactive: true', 'shop.yaml', ['yaml', 'yml'])).toBe(false);
    });
  });

  describe('entriesFromRecord', () => {
    it('returns key/value rows for the selected-record panel', () => {
      expect(entriesFromRecord({ id: '1', name: 'Ada' })).toEqual([
        { key: 'id', value: '1' },
        { key: 'name', value: 'Ada' }
      ]);
      expect(entriesFromRecord(undefined)).toEqual([]);
    });
  });

  describe('buildDataInsightStats', () => {
    it('prefers tables/sections/nodes over columns and sums nested table rows', () => {
      const stats = buildDataInsightStats(
        { tables: [{ rows: [{ a: 1 }, { a: 2 }] }, { numRows: 3 }], columns: [{}, {}, {}] },
        1,
        2048,
        [],
        formatDataFileSize
      );
      expect(stats.files).toBe(1);
      expect(stats.groupLabel).toBe('Tables');
      expect(stats.groupCount).toBe(2);
      expect(stats.itemLabel).toBe('Rows');
      expect(stats.itemCount).toBe(5);
      expect(stats.sizeLabel).toBe('Size');
      expect(stats.sizeValue).toBe('2.0 KB');
    });

    it('uses fields/records for Avro-like payloads', () => {
      const stats = buildDataInsightStats(
        { fields: [{}, {}], records: [{}, {}, {}] },
        2,
        null,
        ['soft'],
        formatDataFileSize
      );
      expect(stats.groupLabel).toBe('Fields');
      expect(stats.groupCount).toBe(2);
      expect(stats.itemLabel).toBe('Records');
      expect(stats.itemCount).toBe(3);
      expect(stats.sizeLabel).toBe('Warnings');
      expect(stats.sizeValue).toBe('1');
      expect(stats.warningCount).toBe(1);
    });
  });
});
