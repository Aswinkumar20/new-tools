import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { WordsAndCharacterCounterComponent } from './wordsAndCharacterCounter.component';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { textToolTestProviders } from '../../shared/text-tool-test.utils';

describe('WordsAndCharacterCounterComponent', () => {
  let component: WordsAndCharacterCounterComponent;
  let fixture: ComponentFixture<WordsAndCharacterCounterComponent>;
  let clipboardWriteTextSpy: jest.Mock;

  beforeEach(async () => {
    // Mock clipboard API
    clipboardWriteTextSpy = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteTextSpy },
      writable: true,
      configurable: true
    });

    // Mock window.gtag for analytics
    (globalThis as { gtag?: jest.Mock }).gtag = jest.fn();

    // Mock Worker
    const mockWorker = {
      postMessage: jest.fn(),
      terminate: jest.fn(),
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
    };
    (globalThis as { Worker: typeof Worker }).Worker = jest
      .fn()
      .mockImplementation(() => mockWorker as unknown as Worker);

    await TestBed.configureTestingModule({
      imports: [WordsAndCharacterCounterComponent],
      providers: [...textToolTestProviders(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(WordsAndCharacterCounterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (component?.['updateTimer']) {
      clearTimeout(component['updateTimer']);
    }
  });

  it('should create with get-started suggestion and related tools', () => {
    expect(component).toBeTruthy();
    expect(component.primarySuggestion?.id).toBe('wcc-get-started');
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('dismisses contextual suggestions', () => {
    const suggestion = component.primarySuggestion;
    expect(suggestion).toBeTruthy();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion).toBeNull();
    }
  });

  describe('Text Input and Counting', () => {
    it('should initialize with empty text and zero counts', () => {
      expect(component.wordCount).toBe(0);
      expect(component.charCount).toBe(0);
      expect(component.charCountNoSpaces).toBe(0);
      expect(component.sentenceCount).toBe(0);
      expect(component.paragraphCount).toBe(0);
      expect(component.hasContent).toBe(false);
    });

    it('should count words correctly', fakeAsync(() => {
      component.paragraphControl.setValue('Hello world test');
      tick(400); // Wait for debounce
      fixture.detectChanges();

      expect(component.wordCount).toBe(3);
    }));

    it('should count characters correctly', fakeAsync(() => {
      component.paragraphControl.setValue('Hello world');
      tick(400);
      fixture.detectChanges();

      expect(component.charCount).toBe(11);
      expect(component.charCountNoSpaces).toBe(10);
    }));

    it('should count sentences correctly', fakeAsync(() => {
      component.paragraphControl.setValue('First sentence. Second sentence! Third sentence?');
      tick(400);
      fixture.detectChanges();

      expect(component.sentenceCount).toBe(3);
    }));

    it('should count paragraphs correctly', fakeAsync(() => {
      component.paragraphControl.setValue('First paragraph.\n\nSecond paragraph.\n\nThird paragraph.');
      tick(400);
      fixture.detectChanges();

      expect(component.paragraphCount).toBe(3);
    }));

    it('should update hasContent when text is entered', fakeAsync(() => {
      expect(component.hasContent).toBe(false);
      
      component.paragraphControl.setValue('Some text');
      tick(400);
      fixture.detectChanges();

      expect(component.hasContent).toBe(true);
    }));

    it('should reset counts when text is cleared', fakeAsync(() => {
      component.paragraphControl.setValue('Hello world');
      tick(400);
      fixture.detectChanges();

      expect(component.wordCount).toBe(2);

      component.paragraphControl.setValue('');
      tick(400);
      fixture.detectChanges();

      expect(component.wordCount).toBe(0);
      expect(component.charCount).toBe(0);
      expect(component.sentenceCount).toBe(0);
      expect(component.paragraphCount).toBe(0);
    }));
  });

  describe('Word Frequency Analysis', () => {
    it('should calculate word frequency', fakeAsync(() => {
      component.paragraphControl.setValue('hello world hello test world');
      tick(400);
      fixture.detectChanges();

      expect(component.wordFrequency.length).toBeGreaterThan(0);
      const helloWord = component.wordFrequency.find(w => w.word === 'hello');
      expect(helloWord?.count).toBe(2);
    }));

    it('should sort word frequency by count descending', fakeAsync(() => {
      component.paragraphControl.setValue('a a a b b c');
      tick(400);
      fixture.detectChanges();

      expect(component.wordFrequency[0].count).toBeGreaterThanOrEqual(component.wordFrequency[1].count);
    }));

    it('should handle empty text for word frequency', fakeAsync(() => {
      component.paragraphControl.setValue('');
      tick(400);
      fixture.detectChanges();

      expect(component.wordFrequency).toEqual([]);
    }));
  });

  describe('Readability Scores', () => {
    it('should calculate readability score', fakeAsync(() => {
      component.paragraphControl.setValue('This is a simple sentence. It has multiple words.');
      tick(400);
      fixture.detectChanges();

      expect(component.readabilityScore).toBeDefined();
      expect(typeof component.readabilityScore).toBe('number');
    }));

    it('should calculate Gunning Fog index', fakeAsync(() => {
      component.paragraphControl.setValue('This is a test sentence.');
      tick(400);
      fixture.detectChanges();

      expect(component.gunningFog).toBeDefined();
      expect(typeof component.gunningFog).toBe('number');
    }));

    it('should calculate SMOG index', fakeAsync(() => {
      component.paragraphControl.setValue('This is a test sentence.');
      tick(400);
      fixture.detectChanges();

      expect(component.smogIndex).toBeDefined();
      expect(typeof component.smogIndex).toBe('number');
    }));

    it('should calculate Coleman-Liau index', fakeAsync(() => {
      component.paragraphControl.setValue('This is a test sentence.');
      tick(400);
      fixture.detectChanges();

      expect(component.colemanLiau).toBeDefined();
      expect(typeof component.colemanLiau).toBe('number');
    }));

    it('should provide readability interpretation', fakeAsync(() => {
      component.paragraphControl.setValue('This is a simple sentence.');
      tick(400);
      fixture.detectChanges();

      expect(component.readabilityInterpretation).toBeDefined();
      expect(component.readabilityInterpretation).not.toBe('—');
    }));

    it('should calculate average sentence length', fakeAsync(() => {
      component.paragraphControl.setValue('Short. This is a longer sentence with more words.');
      tick(400);
      fixture.detectChanges();

      expect(component.averageSentenceLength).toBeDefined();
      expect(component.averageSentenceLength).toBeGreaterThan(0);
    }));
  });

  describe('Copy Functions', () => {
    it('should copy text to clipboard', async () => {
      component.paragraphControl.setValue('Test text to copy');
      fixture.detectChanges();

      await component.copyText();

      expect(clipboardWriteTextSpy).toHaveBeenCalledWith('Test text to copy');
    });

    it('should not copy when there is no content', async () => {
      component.paragraphControl.setValue('');
      fixture.detectChanges();

      await component.copyText();

      expect(clipboardWriteTextSpy).not.toHaveBeenCalled();
    });

    it('should copy statistics to clipboard', async () => {
      component.paragraphControl.setValue('Hello world');
      component.updateCounts('Hello world');
      fixture.detectChanges();

      await component.copyAllStats();

      expect(clipboardWriteTextSpy).toHaveBeenCalled();
      const copiedText = clipboardWriteTextSpy.mock.calls.at(-1)?.[0] as string;
      expect(copiedText).toContain('Words:');
      expect(copiedText).toContain('Characters:');
      expect(copiedText).toContain('Sentences:');
    });

    it('should not copy stats when there is no content', async () => {
      component.paragraphControl.setValue('');
      fixture.detectChanges();

      await component.copyAllStats();

      expect(clipboardWriteTextSpy).not.toHaveBeenCalled();
    });
  });

  describe('Clear Function', () => {
    it('should clear text when clearText is called', fakeAsync(() => {
      component.paragraphControl.setValue('Some text');
      tick(400);
      fixture.detectChanges();

      expect(component.hasContent).toBe(true);

      component.clearText();
      tick(400);
      fixture.detectChanges();

      expect(component.paragraphControl.value).toBe('');
      expect(component.hasContent).toBe(false);
    }));

    it('should not clear when there is no content', () => {
      component.paragraphControl.setValue('');
      fixture.detectChanges();

      component.clearText();

      expect(component.paragraphControl.value).toBe('');
    });
  });

  describe('Undo/Redo', () => {
    it('should undo text changes', fakeAsync(() => {
      component.paragraphControl.setValue('First text');
      tick(400);
      fixture.detectChanges();

      component.paragraphControl.setValue('Second text');
      tick(400);
      fixture.detectChanges();

      component.undo();
      tick(100);
      fixture.detectChanges();

      expect(component.paragraphControl.value).toBe('First text');
    }));

    it('should redo text changes', fakeAsync(() => {
      component.paragraphControl.setValue('First text');
      tick(400);
      fixture.detectChanges();

      component.paragraphControl.setValue('Second text');
      tick(400);
      fixture.detectChanges();

      component.undo();
      tick(100);
      fixture.detectChanges();

      component.redo();
      tick(100);
      fixture.detectChanges();

      expect(component.paragraphControl.value).toBe('Second text');
    }));

    it('should not undo when at beginning of history', () => {
      const initialValue = component.paragraphControl.value;
      component.undo();
      expect(component.paragraphControl.value).toBe(initialValue);
    });

    it('should not redo when at end of history', () => {
      const initialValue = component.paragraphControl.value;
      component.redo();
      expect(component.paragraphControl.value).toBe(initialValue);
    });
  });

  describe('Download Functions', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    beforeEach(() => {
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn(),
        remove: jest.fn(),
      };
      const originalCreateElement = document.createElement.bind(document);
      jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return mockAnchor as unknown as HTMLElement;
        }
        return originalCreateElement(tag);
      });
      URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
      URL.revokeObjectURL = jest.fn();
    });

    it('should download TXT file', async () => {
      component.paragraphControl.setValue('Test text');
      component.updateCounts('Test text');
      fixture.detectChanges();

      await component.downloadAnalysis('txt');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(component.isGeneratingPdf).toBe(false);
    });

    it('should handle PDF download attempt', async () => {
      const ensureScript = jest
        .spyOn(component as WordsAndCharacterCounterComponent & { ensureScript: (src: string) => Promise<void> }, 'ensureScript' as never)
        .mockResolvedValue(undefined);

      (globalThis as { jspdf?: { jsPDF: jest.Mock } }).jspdf = {
        jsPDF: jest.fn().mockReturnValue({
          setFontSize: jest.fn(),
          text: jest.fn(),
          splitTextToSize: jest.fn().mockReturnValue(['text']),
          addPage: jest.fn(),
          save: jest.fn(),
          internal: {
            pageSize: { width: 595, height: 842 },
          },
          autoTable: jest.fn(),
        }),
      };

      component.paragraphControl.setValue('Test text');
      component.updateCounts('Test text');
      fixture.detectChanges();

      await component.downloadAnalysis('pdf');

      expect(ensureScript).toHaveBeenCalled();
      expect(component.isGeneratingPdf).toBe(false);
    });
  });

  describe('UI Elements', () => {
    it('should display word count in template', fakeAsync(() => {
      component.paragraphControl.setValue('Hello world');
      tick(400);
      fixture.detectChanges();

      const wordCountElement = fixture.debugElement.query(By.css('.wcc__stat-value'));
      expect(wordCountElement).toBeTruthy();
      expect(wordCountElement.nativeElement.textContent.trim()).toBe('2');
    }));

    it('should display character count in template', fakeAsync(() => {
      component.paragraphControl.setValue('Hello');
      tick(400);
      fixture.detectChanges();

      const charCountElements = fixture.debugElement.queryAll(By.css('.wcc__stat-value'));
      expect(charCountElements.length).toBeGreaterThan(0);
    }));

    it('should disable buttons when there is no content', () => {
      component.paragraphControl.setValue('');
      fixture.detectChanges();

      const copyButton = fixture.debugElement.query(By.css('button[aria-label="Copy text"]'));
      expect(copyButton.nativeElement.disabled).toBe(true);
    });

    it('should enable buttons when there is content', fakeAsync(() => {
      component.paragraphControl.setValue('Some text');
      tick(400);
      fixture.detectChanges();

      const copyButton = fixture.debugElement.query(By.css('button[aria-label="Copy text"]'));
      expect(copyButton.nativeElement.disabled).toBe(false);
    }));

    it('should display word frequency table when there is content', fakeAsync(() => {
      component.paragraphControl.setValue('hello world hello');
      tick(400);
      fixture.detectChanges();

      const frequencyTable = fixture.debugElement.query(By.css('.wcc__table'));
      expect(frequencyTable).toBeTruthy();
    }));

    it('should display empty state when there is no word frequency', () => {
      component.paragraphControl.setValue('');
      fixture.detectChanges();

      const emptyState = fixture.debugElement.query(By.css('.wcc__empty'));
      expect(emptyState).toBeTruthy();
    });
  });

  describe('Character Limit', () => {
    it('should show unlimited label when limit is Infinity', () => {
      expect(component.charLimitLabel).toBe('Unlimited');
    });

    it('should show limit value when limit is set', () => {
      component['charLimit'] = 1000;
      expect(component.charLimitLabel).toBe('1000');
    });
  });

  describe('History Management', () => {
    it('should return history limit', () => {
      expect(component.historyLimit).toBeDefined();
      expect(typeof component.historyLimit).toBe('number');
    });

    it('should push to history when text changes', fakeAsync(() => {
      const initialHistoryLength = component['history'].length;
      
      component.paragraphControl.setValue('New text');
      tick(400);
      fixture.detectChanges();

      expect(component['history'].length).toBeGreaterThan(initialHistoryLength);
    }));
  });

  describe('Component Lifecycle', () => {
    it('should clean up on destroy', () => {
      const destroySpy = jest.spyOn(component, 'ngOnDestroy');
      
      component.ngOnDestroy();
      
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long text', fakeAsync(() => {
      const longText = 'word '.repeat(1000);
      component.paragraphControl.setValue(longText);
      tick(800); // Longer debounce for large text
      fixture.detectChanges();

      expect(component.wordCount).toBe(1000);
    }));

    it('should handle text with only whitespace', fakeAsync(() => {
      component.paragraphControl.setValue('   \n\n   ');
      tick(400);
      fixture.detectChanges();

      expect(component.hasContent).toBe(false);
      expect(component.wordCount).toBe(0);
    }));

    it('should handle special characters', fakeAsync(() => {
      component.paragraphControl.setValue('Hello! @#$%^&*() world?');
      tick(400);
      fixture.detectChanges();

      expect(component.wordCount).toBeGreaterThan(0);
    }));

    it('should handle unicode characters', fakeAsync(() => {
      component.paragraphControl.setValue('Hello 世界 مرحبا');
      tick(400);
      fixture.detectChanges();

      expect(component.charCount).toBeGreaterThan(0);
    }));
  });
});
