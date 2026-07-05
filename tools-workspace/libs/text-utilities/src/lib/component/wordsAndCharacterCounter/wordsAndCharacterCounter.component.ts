import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, ToastService, AssetService, TooltipDirective } from '@tools-workspace/features-home';

// Import Google Analytics Service - use optional injection to avoid errors if not available
// In a library, we need to check if the service exists
declare const window: any;

// Simple GA tracking function that works even if service isn't available
function trackGAEvent(eventName: string, params?: any): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
}

// For worker types (will be loaded dynamically)
type WorkerMessage = {
  words: string[];
  syllables: number;
  wordFrequency: { word: string; count: number }[];
  sentenceLengths?: number[];
  advanced?: {
    gunningFog: number;
    smog: number;
    colemanLiau: number;
  };
};

@Component({
  selector: 'lib-words-and-character-counter',
  standalone: true,
  templateUrl: './wordsAndCharacterCounter.component.html',
  styleUrls: ['./wordsAndCharacterCounter.component.scss'],
  imports: [FormsModule, CommonModule, Navigation, ReactiveFormsModule, TooltipDirective],
})
export class WordsAndCharacterCounterComponent implements OnInit, OnDestroy {
  // Tool metadata for tracking
  private readonly TOOL_NAME = 'character-counter';
  private readonly TOOL_CATEGORY = 'text-utilities';
  
  // Tracking state
  private hasTrackedAnalysis = false;
  private textAnalysisCount = 0;
  private readonly sessionStartTime = Date.now();
  
  // Helper method to track events
  private trackEvent(eventName: string, params?: any): void {
    trackGAEvent(eventName, {
      ...params,
      tool_name: this.TOOL_NAME,
      tool_category: this.TOOL_CATEGORY,
    });
  }
  paragraphControl = new FormControl('');

  wordCount = 0;
  charCount = 0;
  charCountNoSpaces = 0;
  sentenceCount = 0;
  paragraphCount = 0;
  wordFrequency: { word: string; count: number }[] = [];
  readabilityScore = 0;
  // Advanced metrics
  gunningFog = 0;
  smogIndex = 0;
  // UI/UX
  darkMode = false;
  colemanLiau = 0;
  readabilityInterpretation = '';
  // No hard character limit — allow arbitrarily large copy/paste
  charLimit = Infinity;
  charLimitExceeded = false;
  
  // Toast service for notifications
  private readonly toastService = inject(ToastService);
  // Asset service for resolving asset paths correctly (public for template use)
  readonly assetService = inject(AssetService);
  get charLimitLabel(): string {
    return this.charLimit === Infinity ? 'Unlimited' : String(this.charLimit);
  }

  // Returns true if there is actual content to analyze
  get hasContent(): boolean {
    const text = this.paragraphControl.value || '';
    return text.trim().length > 0;
  }

  get canUndo(): boolean {
    return this.historyIndex > 0;
  }

  get canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  get historyLimit(): number {
    return this.maxHistoryEntries;
  }
  // History safety caps to avoid memory blowup on huge pasted texts
  private maxHistoryEntries = 30;
  private maxStoredEntryLength = 100000; // store at most 100k chars per history entry
  // Undo/Redo
  private history: string[] = [];
  private historyIndex = -1;
  // Memoization (store lightweight hashes instead of full text to avoid memory blowups)
  private lastTextHash: number | null = null;
  private lastWordFrequencyHash: number | null = null;
  // Web Worker
  private analysisWorker?: Worker;
  useWorkerThreshold = 2000; // characters threshold to start using worker (lowered to offload sooner)
  // Adaptive debounce
  private updateTimer: any = null;
  private pendingText = '';
  // Sentence stats
  averageSentenceLength = 0;
  sentenceLengths: number[] = [];
  copyIcon: string = 'icons/copy-icon.svg';
  // no constructor needed
  isGeneratingPdf = false;
  activeInsightTab: 'frequency' | 'readability' = 'frequency';
  /** Max rows in the frequency table — keeps DOM light for long pasted text */
  readonly frequencyDisplayLimit = 100;
  /** Max tags in the word cloud */
  readonly tagCloudLimit = 30;

  get displayWordFrequency(): { word: string; count: number }[] {
    return this.wordFrequency.slice(0, this.frequencyDisplayLimit);
  }

  get tagCloudWords(): { word: string; count: number }[] {
    return this.wordFrequency.slice(0, this.tagCloudLimit);
  }

  get totalUniqueWords(): number {
    return this.wordFrequency.length;
  }

  get hasMoreFrequencyRows(): boolean {
    return this.wordFrequency.length > this.frequencyDisplayLimit;
  }

  setInsightTab(tab: 'frequency' | 'readability'): void {
    this.activeInsightTab = tab;
  }

  ngOnInit(): void {
    // Track tool usage
    this.trackEvent('tool_usage', {
      event_category: this.TOOL_CATEGORY,
      event_label: this.TOOL_NAME,
      action_type: 'view',
    });
    
    // Subscribe to changes and use adaptive debounce (short for small text, longer for large texts)
    this.paragraphControl.valueChanges.subscribe((text) => {
      this.scheduleUpdate(text || '');
      
      // Track text input engagement (privacy-safe: only length, never content)
      if (text && text.length > 0) {
        this.trackEvent('engagement', {
          event_category: 'user_engagement',
          engagement_type: 'interaction',
          element_name: 'text-input',
        });
      }
    });

    // Initial update
    this.updateCounts(this.paragraphControl.value || '');
  }

  ngOnDestroy(): void {
    // Track session summary when user leaves
    const sessionDuration = Math.round((Date.now() - this.sessionStartTime) / 1000);
    this.trackEvent('tool_session_summary', {
      event_category: this.TOOL_CATEGORY,
      event_label: this.TOOL_NAME,
      session_duration_seconds: sessionDuration,
      text_analyses_count: this.textAnalysisCount,
    });
  }

  private scheduleUpdate(text: string) {
    this.pendingText = text;
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    // adapt debounce based on text size
    const len = text.length || 0;
    let wait = 300;
    if (len > 10000) wait = 800;
    else if (len > 5000) wait = 600;
    else if (len > 2000) wait = 450;

    this.updateTimer = setTimeout(() => {
      this.updateCounts(this.pendingText);
      // push to history after debounced update
      this.pushHistory(this.pendingText);
      this.updateTimer = null;
      
      // Track text analysis (privacy-safe: only metadata)
      if (this.pendingText && this.pendingText.trim().length > 0) {
        this.textAnalysisCount++;
        const textLength = this.pendingText.length;
        
        // Track first analysis
        if (!this.hasTrackedAnalysis) {
          this.hasTrackedAnalysis = true;
          this.trackEvent('tool_first_analysis', {
            event_category: this.TOOL_CATEGORY,
            event_label: this.TOOL_NAME,
            text_length: textLength,
          });
        }
        
        // Track analysis event
        this.trackEvent('text_analysis', {
          event_category: this.TOOL_CATEGORY,
          event_label: this.TOOL_NAME,
          text_length: textLength,
          analysis_count: this.textAnalysisCount,
        });
      }
    }, wait);
  }

  updateCounts(text: string): void {
    const trimmed = text.trim();

    if (!trimmed) {
      // Reset all metrics to 0 when there's no content
      this.wordCount = 0;
      this.charCount = 0;
      this.charCountNoSpaces = 0;
      this.sentenceCount = 0;
      this.paragraphCount = 0;
      this.readabilityScore = 0;
      this.gunningFog = 0;
      this.smogIndex = 0;
      this.colemanLiau = 0;
      this.averageSentenceLength = 0;
      this.wordFrequency = [];
      this.readabilityInterpretation = '—';
      this.sentenceLengths = [];
      return;
    }

    // Char limit
    this.charLimitExceeded = text.length > this.charLimit;

    // Words
    const words = trimmed.split(/\s+/).filter(Boolean);
    this.wordCount = words.length;

    // Characters
    this.charCount = text.length;
    this.charCountNoSpaces = text.replace(/\s/g, '').length;

    // Sentences
    const sentences = trimmed.split(/[\.\!\?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
    this.sentenceCount = sentences.length;

    // Paragraphs
    const paragraphs = trimmed.split(/\n{2,}/).filter((p) => p.trim().length > 0);
    this.paragraphCount = paragraphs.length;

    // Word Frequency
    // Use memoization with hashes: if unchanged, skip heavy calc
    const textHash = this.hashString(text);
    const wordsHash = this.hashWords(words);
    if (this.lastTextHash === textHash && this.lastWordFrequencyHash === wordsHash) {
      // nothing changed
    } else {
      this.lastTextHash = textHash;
      this.lastWordFrequencyHash = wordsHash;
      if (text.length > this.useWorkerThreshold && typeof Worker !== 'undefined') {
        this.runWorkerAnalysis(words, text);
      } else {
        this.wordFrequency = this.calculateWordFrequency(words);
        const syllableCount = this.countSyllables(words);
        this.readabilityScore = this.calculateFleschReadingEase(
          this.wordCount,
          this.sentenceCount,
          syllableCount
        );

        const advanced = this.calculateAdvancedMetrics(words, syllableCount);
        this.gunningFog = advanced.gunningFog;
        this.smogIndex = advanced.smog;
        this.colemanLiau = advanced.colemanLiau;
        this.readabilityInterpretation = this.interpretScore(this.readabilityScore);
        this.sentenceLengths = this.calculateSentenceLengths(trimmed);
        this.averageSentenceLength = this.sentenceLengths.length
          ? Math.round((this.sentenceLengths.reduce((a, b) => a + b, 0) / this.sentenceLengths.length) * 10) / 10
          : 0;
      }
    }

  }

  private runWorkerAnalysis(words: string[], text: string) {
    if (!this.analysisWorker) {
      try {
        // Dynamically load worker
        // Worker file path relative to component build output may vary; using inline blob as fallback.
        const workerCode = `self.onmessage = function(e){
          const text = e.data.text || '';
          const words = text.trim() ? text.trim().split(/\\s+/).filter(Boolean) : [];
          const freqMap = {};
          for(const w of words){
            const key = w.toLowerCase().replace(/[^a-z0-9]/gi,'');
            if(!key) continue;
            freqMap[key] = (freqMap[key]||0)+1;
          }
          const wordFrequency = Object.entries(freqMap).map(function([word,count]){return {word,count}}).sort(function(a,b){return b.count-a.count});
          // syllables
          let syllables=0;
          for(const w of words){
            const clean = w.toLowerCase().replace(/[^a-z]/g,'');
            if(!clean) continue;
            const matches = clean.match(/[aeiouy]{1,2}/g);
            syllables += matches ? matches.length : 1;
          }
          // sentence lengths
          const sentences = text.trim() ? text.trim().split(/[\.\!\?]+(?:\\s|$)/).filter(s=>s.trim().length>0) : [];
          const sentenceLengths = sentences.map(s=>s.trim().split(/\\s+/).filter(Boolean).length);
          // advanced metrics (basic implementations)
          const wordsCount = words.length;
          const sentencesCount = sentences.length||1;
          const L = (text.replace(/[^A-Za-z]/g,'').length/wordsCount)*100 || 0;
          const S = (sentencesCount/wordsCount)*100 || 0;
          const colemanLiau = Math.round((0.0588 * (L) - 0.296 * (S) - 15.8) * 10) / 10;
          const gunningFog = Math.round(0.4 * ((wordsCount/sentencesCount) + 100*(words.filter(w=>w.length>6).length/wordsCount)) * 10) / 10;
          const smog = Math.round((1.0430 * Math.sqrt(words.filter(w=>w.match(/\\w{3,}/)).length * (30/sentencesCount)) + 3.1291) * 10) / 10;
          postMessage({ words, syllables, wordFrequency, sentenceLengths, advanced: { gunningFog, smog, colemanLiau } });
        }`;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.analysisWorker = new Worker(URL.createObjectURL(blob));
        this.analysisWorker.onmessage = (ev: MessageEvent) => {
          const data: WorkerMessage = ev.data as any;
          this.wordFrequency = data.wordFrequency || [];
          const syllableCount = data.syllables || 0;
          this.readabilityScore = this.calculateFleschReadingEase(this.wordCount, this.sentenceCount, syllableCount);
          this.gunningFog = this.roundMetric(data.advanced?.gunningFog || 0);
          this.smogIndex = this.roundMetric(data.advanced?.smog || 0);
          this.colemanLiau = this.roundMetric(data.advanced?.colemanLiau || 0);
          this.readabilityInterpretation = this.interpretScore(this.readabilityScore);
          this.sentenceLengths = data.sentenceLengths || [];
          this.averageSentenceLength = this.sentenceLengths.length
            ? Math.round((this.sentenceLengths.reduce((a, b) => a + b, 0) / this.sentenceLengths.length) * 10) / 10
            : 0;
        };
      } catch (err) {
        console.warn('Worker not available, falling back to main thread analysis', err);
      }
    }
    if (this.analysisWorker) {
      this.analysisWorker.postMessage({ text });
    }
  }

  private calculateSentenceLengths(text: string): number[] {
    const sentences = text ? text.split(/[\.\!\?]+(?:\s|$)/).filter((s) => s.trim().length > 0) : [];
    return sentences.map((s) => s.trim().split(/\s+/).filter(Boolean).length);
  }

  // Lightweight hash for a string. Processes full string but uses a simple algorithm and returns 32-bit int.
  private hashString(s: string): number {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
      h = (h * 33) ^ s.charCodeAt(i);
    }
    return h >>> 0;
  }

  // Hash words array without joining to avoid huge temporary strings
  private hashWords(words: string[]): number {
    let h = 5381;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      for (let j = 0; j < w.length; j++) {
        h = (h * 33) ^ w.charCodeAt(j);
      }
      // separator
      h = (h * 33) ^ 124; // '|'
    }
    return h >>> 0;
  }

  private calculateAdvancedMetrics(words: string[], syllables: number) {
    const wordsCount = words.length || 1;
    const sentencesCount = this.sentenceCount || 1;
    const complexWords = words.filter((w) => w.replace(/[^a-z]/gi, '').length > 6).length;
    const gunningFog = Math.round(0.4 * ((wordsCount / sentencesCount) + 100 * (complexWords / wordsCount)) * 10) / 10;
    const smog = Math.round((1.043 * Math.sqrt((complexWords * (30 / sentencesCount)) || 0) + 3.1291) * 10) / 10;
    const letters = words.join('').replace(/[^A-Za-z]/g, '').length;
    const L = (letters / wordsCount) * 100;
    const S = (sentencesCount / wordsCount) * 100;
    const colemanLiau = Math.round((0.0588 * L - 0.296 * S - 15.8) * 10) / 10;
    return { gunningFog, smog, colemanLiau };
  }
 

  private roundMetric(value: number, decimals = 1): number {
    if (!Number.isFinite(value)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  calculateWordFrequency(words: string[]): { word: string; count: number }[] {
    const freqMap: { [key: string]: number } = {};
    for (const word of words) {
      const w = word.toLowerCase().replace(/[^a-z0-9]/gi, '');
      if (!w) continue;
      freqMap[w] = (freqMap[w] || 0) + 1;
    }
    return Object.entries(freqMap)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);
  }

  countSyllables(words: string[]): number {
    let syllables = 0;
    for (const word of words) {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      if (!clean) continue;

      const matches = clean.match(/[aeiouy]{1,2}/g);
      syllables += matches ? matches.length : 1;
    }
    return syllables;
  }

  interpretScore(score: number) {
    if (score >= 90) return 'Very Easy';
    if (score >= 80) return 'Easy';
    if (score >= 60) return 'Fairly Easy';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
  }


  // Download analysis as PDF (default) or TXT (fallback)
  async downloadAnalysis(as: 'pdf' | 'txt' = 'pdf') {
    const text = this.paragraphControl.value || '';
    
    // Track download action start
    this.trackEvent('click', {
      event_category: 'ui_interaction',
      event_label: `download-${as}`,
      element_type: 'button',
      location: this.TOOL_NAME,
    });
    const downloadStartTime = Date.now();

    // Ensure we have an up-to-date frequency list for the download.
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const freqList = this.calculateWordFrequency(words);
    const totalWords = words.length || 0;

    if (as === 'pdf') {
      try {
        this.isGeneratingPdf = true;
        // Lazy-load jsPDF and autotable from CDN if not already present
        await this.ensureScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
        await this.ensureScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.28/dist/jspdf.plugin.autotable.min.js');

        // Access jsPDF from the UMD bundle
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jspdfLib: any = (window as any).jspdf;
        if (!jspdfLib || !jspdfLib.jsPDF) throw new Error('jsPDF not available');
        const { jsPDF } = jspdfLib;

        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const margin = 40;
        let y = margin;


        // First page: Guidance / Documentation
        doc.setFontSize(18);
        doc.text('Text Analysis Report', margin, y);
        y += 28;

        doc.setFontSize(11);
        const now = new Date().toLocaleString();
        doc.text(`Generated: ${now}`, margin, y);
        y += 18;

        const guidance = [
          'This report contains a word frequency analysis of the supplied text and readability metrics.',
          '',
          'How to read this report:',
          '- Count: number of times the word appears in the text.',
          "- Percentage: the word's share of the total word count (Count / Total Words * 100).",
          '- Original Text: the full input text is included for context. It may contain line breaks.','',
          'Notes:',
          '- Very large texts may take time to generate the PDF. Please be patient while the file is created.',
          '- For extremely large results, consider exporting only the top N words or using the export feature to download data.',
        ];
        const pageWidth = (doc.internal.pageSize as any).width;
        const maxLineWidth = pageWidth - margin * 2;
        const guidanceLines: string[] = [];
        guidance.forEach((p) => {
          const lines = doc.splitTextToSize(p, maxLineWidth);
          guidanceLines.push(...lines);
        });
        doc.setFontSize(10);
        // Paginate guidance lines if needed
        const pageHeight = (doc.internal.pageSize as any).height;
        let lineHeight = 12;
        for (let i = 0; i < guidanceLines.length; i++) {
          const line = guidanceLines[i];
          if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += lineHeight;
        }

        // Start content on the next page
        doc.addPage();
        y = margin;

        // Metadata
        doc.setFontSize(10);
        doc.text(`Total Words: ${totalWords}`, margin, y);
        y += 14;
        doc.text(`Characters: ${this.charCount}`, margin, y);
        y += 14;
        doc.text(`Sentences: ${this.sentenceCount}`, margin, y);
        y += 14;
        doc.text(`Readability (Flesch): ${this.readabilityScore}`, margin, y);
        y += 18;

        // Original text header
        doc.setFontSize(12);
        doc.text('Original Text:', margin, y);
        y += 14;

        // Insert original text (wrap, may span multiple pages)
        doc.setFontSize(10);
        const splitText = doc.splitTextToSize(text || '(empty)', maxLineWidth);
        const pageHeight2 = (doc.internal.pageSize as any).height;
        const lineHeight2 = 12;
        for (let i = 0; i < splitText.length; i++) {
          const line = splitText[i];
          if (y + lineHeight2 > pageHeight2 - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += lineHeight2;
        }
        y += 10;

        // Word frequency table using autotable
        // Prepare rows
        const rows = freqList.map((w) => [w.word, String(w.count), totalWords ? ((w.count / totalWords) * 100).toFixed(2) + '%' : '0.00%']);

        // Add some spacing and then the table
        (doc as any).autoTable({
          startY: y,
          head: [['Word', 'Count', 'Percentage']],
          body: rows,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [37, 99, 235] },
          margin: { left: margin, right: margin },
          theme: 'striped',
        });

        doc.save('text-analysis.pdf');
        this.isGeneratingPdf = false;
        
        // Track successful PDF download
        const downloadDuration = Date.now() - downloadStartTime;
        this.trackEvent('file_download', {
          event_category: this.TOOL_CATEGORY,
          event_label: this.TOOL_NAME,
          file_type: 'pdf',
          action_type: 'download',
        });
        this.trackEvent('tool_completion', {
          event_category: this.TOOL_CATEGORY,
          event_label: this.TOOL_NAME,
          action_type: 'complete',
          operation_type: 'download_pdf',
          duration_ms: downloadDuration,
          word_count: this.wordCount,
          char_count: this.charCount,
        });
        return;
      } catch (err) {
        console.warn('PDF generation failed, falling back to TXT', err);
        // fallthrough to TXT
      }
    }

    // TXT fallback
    const txt = `Text:\n${text}\n\nStats:\nWords: ${this.wordCount}\nCharacters: ${this.charCount}\nSentences: ${this.sentenceCount}\nReadability: ${this.readabilityScore}`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis.txt';
    a.click();
    URL.revokeObjectURL(url);
    this.isGeneratingPdf = false;
    
    // Track successful TXT download
    const downloadDuration = Date.now() - downloadStartTime;
    this.trackEvent('file_download', {
      event_category: this.TOOL_CATEGORY,
      event_label: this.TOOL_NAME,
      file_type: 'txt',
      action_type: 'download',
    });
    this.trackEvent('tool_completion', {
      event_category: this.TOOL_CATEGORY,
      event_label: this.TOOL_NAME,
      action_type: 'complete',
      operation_type: 'download_txt',
      duration_ms: downloadDuration,
      word_count: this.wordCount,
      char_count: this.charCount,
    });
  }

  // Dynamically add script tag and wait for it to load
  private ensureScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // already loaded?
      if (document.querySelector(`script[data-src="${src}"]`) || document.querySelector(`script[src="${src}"]`)) {
        return resolve();
      }
      const s = document.createElement('script');
      s.src = src;
      s.setAttribute('data-src', src);
      s.async = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
  }

  // Keyboard shortcuts for undo/redo
  @HostListener('document:keydown', ['$event'])
  handleKeyboard(evt: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const undoKey = isMac ? evt.metaKey && evt.key === 'z' : evt.ctrlKey && evt.key === 'z';
    const redoKey = isMac ? evt.metaKey && (evt.key === 'y' || (evt.shiftKey && evt.key === 'z')) : evt.ctrlKey && (evt.key === 'y' || (evt.ctrlKey && evt.shiftKey && evt.key === 'z'));
    if (undoKey) {
      evt.preventDefault();
      this.undo();
    } else if (redoKey) {
      evt.preventDefault();
      this.redo();
    }
  }

  // Undo/Redo
  pushHistory(text: string) {
    // If current index not at end, drop future
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    // Truncate very large entries to avoid memory spikes
    let toStore = text;
    if (toStore.length > this.maxStoredEntryLength) {
      toStore = toStore.slice(0, this.maxStoredEntryLength) + '\n\n... (truncated)';
    }
    this.history.push(toStore);
    // cap number of history entries
    if (this.history.length > this.maxHistoryEntries) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const t = this.history[this.historyIndex];
      this.paragraphControl.setValue(t, { emitEvent: false });
      this.updateCounts(t);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const t = this.history[this.historyIndex];
      this.paragraphControl.setValue(t, { emitEvent: false });
      this.updateCounts(t);
    }
  }

  fontSizeForCount(count: number): number {
    const items = this.tagCloudWords;
    if (!items.length) return 12;
    const max = items[0].count;
    const min = items[items.length - 1].count;
    if (max === min) return 14;
    const ratio = (count - min) / (max - min);
    return Math.round(11 + ratio * 7);
  }

  // Charts removed to keep UI minimal. Chart generation methods were removed.

  calculateFleschReadingEase(words: number, sentences: number, syllables: number): number {
    if (words === 0 || sentences === 0) return 0;
    const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    return Math.round(score * 10) / 10;
  }


  copyText(): void {
    // Track copy action
    this.trackEvent('click', {
      event_category: 'ui_interaction',
      event_label: 'copy-text',
      element_type: 'button',
      location: this.TOOL_NAME,
    });
    this.trackEvent('tool_action', {
      event_category: this.TOOL_CATEGORY,
      event_label: this.TOOL_NAME,
      action_type: 'copy_text',
      has_content: this.hasContent,
    });
    if (!this.hasContent) return;
    const text = this.paragraphControl.value || '';
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.info('Text copied to clipboard');
    });
  }

  copyAllStats(): void {
    // Track copy stats action
    this.trackEvent('click', {
      event_category: 'ui_interaction',
      event_label: 'copy-stats',
      element_type: 'button',
      location: this.TOOL_NAME,
    });
    this.trackEvent('tool_action', {
      event_category: this.TOOL_CATEGORY,
      event_label: this.TOOL_NAME,
      action_type: 'copy_stats',
      word_count: this.wordCount,
      char_count: this.charCount,
    });
    if (!this.hasContent) return;
    const stats = `Words: ${this.wordCount}\nCharacters: ${this.charCount}\nCharacters (no spaces): ${this.charCountNoSpaces}\nSentences: ${this.sentenceCount}\nParagraphs: ${this.paragraphCount}\nReadability (Flesch): ${this.readabilityScore}\nGunning Fog: ${this.gunningFog}\nSMOG: ${this.smogIndex}\nColeman-Liau: ${this.colemanLiau}`;
    navigator.clipboard.writeText(stats).then(() => {
      this.toastService.info('Statistics copied to clipboard');
    });
  }

  clearText(): void {
    // Track clear action
    this.trackEvent('click', {
      event_category: 'ui_interaction',
      event_label: 'clear-text',
      element_type: 'button',
      location: this.TOOL_NAME,
    });
    this.trackEvent('tool_action', {
      event_category: this.TOOL_CATEGORY,
      event_label: this.TOOL_NAME,
      action_type: 'clear_text',
    });
    if (!this.hasContent) return;
    this.paragraphControl.setValue('');
    this.toastService.info('Text cleared');
  }
}
