import { TOOL_CATEGORIES } from '../config/tools-catalog.generated';
import { ToolSearchEngine, resetToolSearchEngine } from './engine';
import { detectIntent } from './intent';

describe('ToolSearchEngine (client-side semantic search)', () => {
  let engine: ToolSearchEngine;

  beforeEach(() => {
    resetToolSearchEngine();
    engine = new ToolSearchEngine(TOOL_CATEGORIES);
  });

  afterEach(() => {
    resetToolSearchEngine();
  });

  function topPath(query: string): string | undefined {
    return engine.search(query).results[0]?.path;
  }

  function topName(query: string): string | undefined {
    return engine.search(query).results[0]?.name;
  }

  describe('exact / keyword queries', () => {
    it('finds Image Compressor by name', () => {
      expect(topPath('image compressor')).toBe('/image-color-tools/image-compressor');
    });

    it('finds Merge PDFs by name', () => {
      expect(topPath('merge pdfs')).toBe('/pdf-tools/merge-pdfs');
    });

    it('finds JSON formatter', () => {
      expect(topPath('json formatter')).toBe('/data-converters/json-formatter-beautifier-validator');
    });
  });

  describe('natural-language / synonym queries', () => {
    it('maps "make photo smaller" to Image Compressor', () => {
      expect(topPath('make photo smaller')).toBe('/image-color-tools/image-compressor');
    });

    it('maps "shrink photo" to Image Compressor', () => {
      expect(topPath('shrink photo')).toBe('/image-color-tools/image-compressor');
    });

    it('maps "reduce jpg size" to Image Compressor', () => {
      expect(topPath('reduce jpg size')).toBe('/image-color-tools/image-compressor');
    });

    it('maps "combine multiple pdf files" to Merge PDFs', () => {
      expect(topPath('combine multiple pdf files')).toBe('/pdf-tools/merge-pdfs');
    });

    it('maps "join pdfs" to Merge PDFs', () => {
      expect(topPath('join pdfs')).toBe('/pdf-tools/merge-pdfs');
    });

    it('maps "make pdf smaller" to Compress PDF', () => {
      expect(topPath('make pdf smaller')).toBe('/pdf-tools/compress-pdf');
    });

    it('maps "my pdf is too large to email" to Compress PDF', () => {
      expect(topPath('my pdf is too large to email')).toBe('/pdf-tools/compress-pdf');
    });

    it('maps "make a qr code for my website" to QR Code Generator', () => {
      expect(topPath('make a qr code for my website')).toBe('/fun-tools/qr-code-generator');
    });

    it('maps "make json readable" to JSON Formatter', () => {
      expect(topPath('make json readable')).toBe('/data-converters/json-formatter-beautifier-validator');
    });

    it('maps "how many words are in this text" to Word Counter', () => {
      expect(topPath('how many words are in this text')).toBe('/text-utilities/character-counter');
    });

    it('maps "count words" to Word Counter', () => {
      expect(topPath('count words')).toBe('/text-utilities/character-counter');
    });
  });

  describe('object + action disambiguation', () => {
    it('does not rank PDF Compressor first for "compress image"', () => {
      const top = topPath('compress image');
      expect(top).toBe('/image-color-tools/image-compressor');
      expect(top).not.toBe('/pdf-tools/compress-pdf');
    });

    it('does not rank Image Compressor first for "compress pdf"', () => {
      expect(topPath('compress pdf')).toBe('/pdf-tools/compress-pdf');
    });
  });

  describe('fuzzy / misspellings', () => {
    it('handles "imge compressor"', () => {
      expect(topPath('imge compressor')).toBe('/image-color-tools/image-compressor');
    });

    it('handles "pdf comprssor"', () => {
      expect(topPath('pdf comprssor')).toBe('/pdf-tools/compress-pdf');
    });
  });

  describe('ambiguous queries', () => {
    it('offers clarification for bare "compress"', () => {
      const response = engine.search('compress');
      expect(response.clarification?.question.toLowerCase()).toContain('compress');
      expect(response.clarification?.options.length).toBeGreaterThan(1);
    });
  });

  describe('related tools', () => {
    it('suggests related image tools for compress image', () => {
      const response = engine.search('compress image');
      expect(response.results[0]?.path).toBe('/image-color-tools/image-compressor');
      const relatedPaths = response.related.map((item) => item.path);
      expect(relatedPaths.some((path) => path.includes('image'))).toBe(true);
      expect(relatedPaths).not.toContain('/pdf-tools/compress-pdf');
    });
  });

  describe('intent detection', () => {
    it('detects compress + image intent', () => {
      const intent = detectIntent('I need to send a photo over email but it is too big');
      expect(intent.action).toBe('compress');
      expect(intent.object).toBe('image');
      expect(intent.goal).toBe('reduce_file_size');
    });

    it('detects convert formats', () => {
      const intent = detectIntent('turn jpg into png');
      expect(intent.action).toBe('convert');
      expect(intent.inputFormat).toBe('jpg');
      expect(intent.outputFormat).toBe('png');
    });
  });

  describe('edge cases', () => {
    it('handles nonsense without crashing', () => {
      const response = engine.search('asdfghjkl');
      expect(response.query).toBe('asdfghjkl');
      expect(Array.isArray(response.results)).toBe(true);
    });

    it('truncates extremely long queries', () => {
      const longQuery = 'make photo smaller '.repeat(40);
      const response = engine.search(longQuery);
      expect(response.query.length).toBeLessThanOrEqual(200);
      expect(topName('make photo smaller')).toBeTruthy();
    });

    it('autocomplete returns tool suggestions quickly', () => {
      const suggestions = engine.autocomplete('compress');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((item) => item.label.toLowerCase().includes('compress'))).toBe(true);
    });
  });
});
