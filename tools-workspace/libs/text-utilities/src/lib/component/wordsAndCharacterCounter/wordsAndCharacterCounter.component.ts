import { Component, OnInit, OnDestroy, HostListener, inject, ViewChild, ElementRef } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navigation, ToastService, AssetService, TooltipDirective } from '@tools-workspace/features-home';
import { READING_WPM, SPEAKING_WPM, STOP_WORDS } from './wordsAndCharacterCounter.constants';

// Import Google Analytics Service - use optional injection to avoid errors if not available
// In a library, we need to check if the service exists
declare const window: any;

// Simple GA tracking function that works even if service isn't available
function trackGAEvent(eventName: string, params?: any): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
}

type InsightTab = 'frequency' | 'phrases' | 'breakdown' | 'readability';

type TextBreakdown = {
  letters: number;
  digits: number;
  punctuation: number;
  spaces: number;
  uppercase: number;
  lowercase: number;
  other: number;
};

type FreqItem = { word: string; count: number };
type PhraseItem = { phrase: string; count: number };
type DensityItem = { word: string; count: number; density: number };
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
  @ViewChild('textInput') textInputRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('highlightBackdrop') highlightBackdropRef?: ElementRef<HTMLDivElement>;

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
  lineCount = 0;
  uniqueWordCount = 0;
  fleschKincaidGrade = 0;
  wordFrequency: FreqItem[] = [];
  phraseFrequency2: PhraseItem[] = [];
  phraseFrequency3: PhraseItem[] = [];
  textBreakdown: TextBreakdown = { letters: 0, digits: 0, punctuation: 0, spaces: 0, uppercase: 0, lowercase: 0, other: 0 };
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
  private isRestoringHistory = false;
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
  isReadingFile = false;
  isDragOver = false;
  excludeStopWords = false;
  activePhraseSize: 2 | 3 = 2;
  highlightedWord: string | null = null;
  highlightMatchCount = 0;
  activeInsightTab: InsightTab = 'frequency';
  /** Max upload size — 10 MB */
  readonly maxUploadBytes = 10 * 1024 * 1024;
  private fileInput?: HTMLInputElement;
  /** Max rows in the frequency table — keeps DOM light for long pasted text */
  readonly frequencyDisplayLimit = 100;
  /** Max tags in the word cloud */
  readonly tagCloudLimit = 30;
  /** Max word-frequency rows in PDF export — avoids browser hang on huge texts */
  readonly pdfFrequencyLimit = 300;
  readonly phraseDisplayLimit = 50;

  get readingTimeLabel(): string {
    return this.formatDuration(this.wordCount / READING_WPM);
  }

  get speakingTimeLabel(): string {
    return this.formatDuration(this.wordCount / SPEAKING_WPM);
  }

  get filteredWordFrequency(): FreqItem[] {
    if (!this.excludeStopWords) {
      return this.wordFrequency;
    }
    return this.wordFrequency.filter((item) => !STOP_WORDS.has(item.word));
  }

  get displayWordFrequency(): FreqItem[] {
    return this.filteredWordFrequency.slice(0, this.frequencyDisplayLimit);
  }

  get keywordDensityList(): DensityItem[] {
    return this.displayWordFrequency.map((item) => ({
      word: item.word,
      count: item.count,
      density: this.wordCount ? Math.round((item.count / this.wordCount) * 10000) / 100 : 0,
    }));
  }

  get tagCloudWords(): FreqItem[] {
    return this.filteredWordFrequency.slice(0, this.tagCloudLimit);
  }

  get totalUniqueWords(): number {
    return this.uniqueWordCount;
  }

  get filteredUniqueCount(): number {
    return this.filteredWordFrequency.length;
  }

  get hasMoreFrequencyRows(): boolean {
    return this.filteredWordFrequency.length > this.frequencyDisplayLimit;
  }

  get activePhraseList(): PhraseItem[] {
    const list = this.activePhraseSize === 2 ? this.phraseFrequency2 : this.phraseFrequency3;
    return list.slice(0, this.phraseDisplayLimit);
  }

  get hasMorePhraseRows(): boolean {
    const list = this.activePhraseSize === 2 ? this.phraseFrequency2 : this.phraseFrequency3;
    return list.length > this.phraseDisplayLimit;
  }

  get totalPhraseCount(): number {
    return this.activePhraseSize === 2 ? this.phraseFrequency2.length : this.phraseFrequency3.length;
  }

  get highlightedBackdropHtml(): string {
    const text = this.paragraphControl.value || '';
    if (!this.highlightedWord || !text) {
      return this.escapeHtml(text) + '\n';
    }
    const pattern = new RegExp(`\\b(${this.escapeRegex(this.highlightedWord)})\\b`, 'gi');
    return this.escapeHtml(text).replace(pattern, '<mark>$1</mark>') + '\n';
  }

  get breakdownItems(): { label: string; value: number; pct: number }[] {
    const total = this.charCount || 1;
    const b = this.textBreakdown;
    return [
      { label: 'Letters', value: b.letters, pct: Math.round((b.letters / total) * 1000) / 10 },
      { label: 'Digits', value: b.digits, pct: Math.round((b.digits / total) * 1000) / 10 },
      { label: 'Punctuation', value: b.punctuation, pct: Math.round((b.punctuation / total) * 1000) / 10 },
      { label: 'Spaces', value: b.spaces, pct: Math.round((b.spaces / total) * 1000) / 10 },
      { label: 'Uppercase', value: b.uppercase, pct: Math.round((b.uppercase / total) * 1000) / 10 },
      { label: 'Lowercase', value: b.lowercase, pct: Math.round((b.lowercase / total) * 1000) / 10 },
      { label: 'Other', value: b.other, pct: Math.round((b.other / total) * 1000) / 10 },
    ];
  }

  setInsightTab(tab: InsightTab): void {
    this.activeInsightTab = tab;
  }

  setPhraseSize(size: 2 | 3): void {
    this.activePhraseSize = size;
  }

  toggleStopWords(): void {
    this.excludeStopWords = !this.excludeStopWords;
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
    this.seedHistory(this.paragraphControl.value || '');
  }

  private seedHistory(text: string): void {
    this.history = [text];
    this.historyIndex = 0;
  }

  ngOnDestroy(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    if (this.analysisWorker) {
      this.analysisWorker.terminate();
      this.analysisWorker = undefined;
    }
    this.fileInput?.remove();
    this.fileInput = undefined;

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
      if (this.isRestoringHistory) {
        this.updateTimer = null;
        return;
      }
      this.updateCounts(this.pendingText);
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
      this.resetMetrics();
      this.lastTextHash = null;
      this.lastWordFrequencyHash = null;
      return;
    }

    // Char limit
    this.charLimitExceeded = text.length > this.charLimit;

    // Words
    const words = trimmed.split(/\s+/).filter(Boolean);
    this.wordCount = words.length;

    // Characters
    this.charCount = text.length;
    this.charCountNoSpaces = this.countCharsNoSpaces(text);
    this.lineCount = this.countLines(text);
    this.textBreakdown = this.calculateTextBreakdown(text);

    // Sentences
    const sentences = trimmed.split(/[\.\!\?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
    this.sentenceCount = sentences.length;

    // Paragraphs
    const paragraphs = trimmed.split(/\n{2,}/).filter((p) => p.trim().length > 0);
    this.paragraphCount = paragraphs.length;

    if (this.highlightedWord) {
      this.highlightMatchCount = this.countWordMatches(text, this.highlightedWord);
    }

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
        this.phraseFrequency2 = this.calculateNGrams(words, 2);
        this.phraseFrequency3 = this.calculateNGrams(words, 3);
        this.runWorkerAnalysis(words, text);
      } else {
        this.applyFullAnalysis(words, trimmed);
      }
    }

  }

  private resetMetrics(): void {
    this.wordCount = 0;
    this.charCount = 0;
    this.charCountNoSpaces = 0;
    this.sentenceCount = 0;
    this.paragraphCount = 0;
    this.lineCount = 0;
    this.uniqueWordCount = 0;
    this.readabilityScore = 0;
    this.fleschKincaidGrade = 0;
    this.gunningFog = 0;
    this.smogIndex = 0;
    this.colemanLiau = 0;
    this.averageSentenceLength = 0;
    this.wordFrequency = [];
    this.phraseFrequency2 = [];
    this.phraseFrequency3 = [];
    this.textBreakdown = { letters: 0, digits: 0, punctuation: 0, spaces: 0, uppercase: 0, lowercase: 0, other: 0 };
    this.readabilityInterpretation = '—';
    this.sentenceLengths = [];
    this.highlightMatchCount = 0;
  }

  private applyFullAnalysis(words: string[], trimmed: string): void {
    this.wordFrequency = this.calculateWordFrequency(words);
    this.uniqueWordCount = this.wordFrequency.length;
    this.phraseFrequency2 = this.calculateNGrams(words, 2);
    this.phraseFrequency3 = this.calculateNGrams(words, 3);
    const syllableCount = this.countSyllables(words);
    this.readabilityScore = this.calculateFleschReadingEase(this.wordCount, this.sentenceCount, syllableCount);
    this.fleschKincaidGrade = this.calculateFleschKincaidGrade(this.wordCount, this.sentenceCount, syllableCount);

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

  private applyWorkerResults(data: WorkerMessage, syllableCount: number): void {
    this.wordFrequency = data.wordFrequency || [];
    this.uniqueWordCount = this.wordFrequency.length;
    this.readabilityScore = this.calculateFleschReadingEase(this.wordCount, this.sentenceCount, syllableCount);
    this.fleschKincaidGrade = this.calculateFleschKincaidGrade(this.wordCount, this.sentenceCount, syllableCount);
    this.gunningFog = this.roundMetric(data.advanced?.gunningFog || 0);
    this.smogIndex = this.roundMetric(data.advanced?.smog || 0);
    this.colemanLiau = this.roundMetric(data.advanced?.colemanLiau || 0);
    this.readabilityInterpretation = this.interpretScore(this.readabilityScore);
    this.sentenceLengths = data.sentenceLengths || [];
    this.averageSentenceLength = this.sentenceLengths.length
      ? Math.round((this.sentenceLengths.reduce((a, b) => a + b, 0) / this.sentenceLengths.length) * 10) / 10
      : 0;
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
          const data: WorkerMessage = ev.data as WorkerMessage;
          const syllableCount = data.syllables || 0;
          this.applyWorkerResults(data, syllableCount);
        };
      } catch (err) {
        console.warn('Worker not available, falling back to main thread analysis', err);
      }
    }
    if (this.analysisWorker) {
      this.analysisWorker.postMessage({ text });
    }
  }

  private countCharsNoSpaces(text: string): number {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code !== 32 && code !== 9 && code !== 10 && code !== 13) {
        count++;
      }
    }
    return count;
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
    const pdfFreqList = freqList.slice(0, this.pdfFrequencyLimit);
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
        const rows = pdfFreqList.map((w) => [w.word, String(w.count), totalWords ? ((w.count / totalWords) * 100).toFixed(2) + '%' : '0.00%']);
        const freqHead = freqList.length > this.pdfFrequencyLimit
          ? [[`Word frequency (top ${this.pdfFrequencyLimit} of ${freqList.length} unique words)`]]
          : [];

        if (freqHead.length) {
          doc.setFontSize(10);
          doc.text(freqHead[0][0], margin, y);
          y += 14;
        }

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
    if (!this.isEditorFocused()) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const key = evt.key.toLowerCase();
    const undoKey = isMac
      ? evt.metaKey && key === 'z' && !evt.shiftKey
      : evt.ctrlKey && key === 'z' && !evt.shiftKey;
    const redoKey = isMac
      ? evt.metaKey && (key === 'y' || (evt.shiftKey && key === 'z'))
      : evt.ctrlKey && (key === 'y' || (evt.shiftKey && key === 'z'));

    if (undoKey) {
      evt.preventDefault();
      this.undo();
    } else if (redoKey) {
      evt.preventDefault();
      this.redo();
    }
  }

  private isEditorFocused(): boolean {
    const textarea = this.textInputRef?.nativeElement;
    return !!textarea && document.activeElement === textarea;
  }

  // Undo/Redo
  pushHistory(text: string) {
    if (this.isRestoringHistory) {
      return;
    }

    const lastEntry = this.history[this.historyIndex];
    if (lastEntry !== undefined && text === lastEntry) {
      return;
    }

    // If current index not at end, drop future states
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    let toStore = text;
    if (toStore.length > this.maxStoredEntryLength) {
      toStore = toStore.slice(0, this.maxStoredEntryLength) + '\n\n... (truncated)';
    }

    this.history.push(toStore);

    if (this.history.length > this.maxHistoryEntries) {
      this.history.shift();
      this.historyIndex = Math.max(0, this.historyIndex - 1);
    }

    this.historyIndex = this.history.length - 1;
  }

  private applyHistoryState(text: string): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    this.pendingText = text;
    this.isRestoringHistory = true;
    this.lastTextHash = null;
    this.lastWordFrequencyHash = null;
    this.paragraphControl.setValue(text, { emitEvent: false });
    this.updateCounts(text);
    this.isRestoringHistory = false;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.applyHistoryState(this.history[this.historyIndex]);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.applyHistoryState(this.history[this.historyIndex]);
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

  calculateFleschKincaidGrade(words: number, sentences: number, syllables: number): number {
    if (words === 0 || sentences === 0) return 0;
    const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
    return Math.round(grade * 10) / 10;
  }

  private countLines(text: string): number {
    if (!text) return 0;
    return text.split(/\r\n|\r|\n/).length;
  }

  private calculateTextBreakdown(text: string): TextBreakdown {
    const breakdown: TextBreakdown = { letters: 0, digits: 0, punctuation: 0, spaces: 0, uppercase: 0, lowercase: 0, other: 0 };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const code = ch.charCodeAt(0);
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        breakdown.letters++;
        if (code >= 65 && code <= 90) breakdown.uppercase++;
        else breakdown.lowercase++;
      } else if (code >= 48 && code <= 57) {
        breakdown.digits++;
      } else if (code === 32 || code === 9 || code === 10 || code === 13) {
        breakdown.spaces++;
      } else if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(ch)) {
        breakdown.punctuation++;
      } else {
        breakdown.other++;
      }
    }
    return breakdown;
  }

  private calculateNGrams(words: string[], n: number): PhraseItem[] {
    if (words.length < n) return [];
    const normalized = words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/gi, '')).filter(Boolean);
    if (normalized.length < n) return [];
    const freqMap: Record<string, number> = {};
    for (let i = 0; i <= normalized.length - n; i++) {
      const slice = normalized.slice(i, i + n);
      if (slice.length < n || slice.some((part) => !part)) continue;
      const phrase = slice.join(' ');
      freqMap[phrase] = (freqMap[phrase] || 0) + 1;
    }
    return Object.entries(freqMap)
      .map(([phrase, count]) => ({ phrase, count }))
      .sort((a, b) => b.count - a.count);
  }

  private formatDuration(minutes: number): string {
    if (!this.wordCount) return '—';
    if (minutes < 1) return `${Math.max(1, Math.round(minutes * 60))} sec`;
    if (minutes < 60) return `${Math.round(minutes * 10) / 10} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private countWordMatches(text: string, word: string): number {
    if (!text || !word) return 0;
    const pattern = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
    return (text.match(pattern) || []).length;
  }

  highlightWord(word: string): void {
    const text = this.paragraphControl.value || '';
    this.highlightedWord = word;
    this.highlightMatchCount = this.countWordMatches(text, word);
    this.scrollToWord(word);
    this.trackEvent('tool_action', {
      event_category: this.TOOL_CATEGORY,
      event_label: this.TOOL_NAME,
      action_type: 'highlight_word',
      match_count: this.highlightMatchCount,
    });
  }

  clearHighlight(): void {
    this.highlightedWord = null;
    this.highlightMatchCount = 0;
  }

  scrollToWord(word: string): void {
    const textarea = this.textInputRef?.nativeElement;
    if (!textarea || !word) return;
    const text = textarea.value;
    const pattern = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
    const match = pattern.exec(text);
    if (!match || match.index === undefined) return;
    textarea.focus();
    textarea.setSelectionRange(match.index, match.index + match[0].length);
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 24;
    const linesBefore = text.slice(0, match.index).split('\n').length - 1;
    textarea.scrollTop = Math.max(0, linesBefore * lineHeight - textarea.clientHeight / 3);
    this.syncHighlightScroll();
  }

  onTextareaScroll(): void {
    this.syncHighlightScroll();
  }

  private syncHighlightScroll(): void {
    const textarea = this.textInputRef?.nativeElement;
    const backdrop = this.highlightBackdropRef?.nativeElement;
    if (!textarea || !backdrop) return;
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleUploadedFile(file);
    }
  }

  exportFrequencyCsv(): void {
    if (!this.hasContent) return;
    this.trackEvent('click', {
      event_category: 'ui_interaction',
      event_label: 'export-frequency-csv',
      element_type: 'button',
      location: this.TOOL_NAME,
    });
    const rows = [['Word', 'Count', 'Density %']];
    const exportList = this.excludeStopWords ? this.filteredWordFrequency : this.wordFrequency;
    const limit = Math.min(exportList.length, 500);
    for (let i = 0; i < limit; i++) {
      const item = exportList[i];
      const density = this.wordCount ? ((item.count / this.wordCount) * 100).toFixed(2) : '0.00';
      rows.push([item.word, String(item.count), density]);
    }
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'word-frequency.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    this.toastService.info('Word frequency exported as CSV');
  }

  phraseDensity(count: number): number {
    return this.wordCount ? Math.round((count / this.wordCount) * 10000) / 100 : 0;
  }

  uploadTextFile(): void {
    this.trackEvent('click', {
      event_category: 'ui_interaction',
      event_label: 'upload-text-file',
      element_type: 'button',
      location: this.TOOL_NAME,
    });

    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.style.display = 'none';
      this.fileInput.addEventListener('change', () => {
        const file = this.fileInput?.files?.[0];
        if (file) {
          this.handleUploadedFile(file);
        }
        if (this.fileInput) {
          this.fileInput.value = '';
        }
      });
      document.body.appendChild(this.fileInput);
    }

    this.fileInput.accept =
      '.txt,.text,.md,.markdown,.csv,.json,.xml,.html,.htm,.log,.yaml,.yml,.rtf,.tsv,.ini,.cfg,.conf,text/*,application/json,application/xml';
    this.fileInput.click();
  }

  private handleUploadedFile(file: File): void {
    if (file.size > this.maxUploadBytes) {
      this.toastService.error(`File is too large. Maximum size is ${Math.round(this.maxUploadBytes / (1024 * 1024))} MB.`);
      return;
    }

    if (!this.isLikelyTextFile(file)) {
      this.toastService.error('Please upload a text-based file (.txt, .md, .csv, .json, etc.).');
      return;
    }

    this.isReadingFile = true;
    const reader = new FileReader();

    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
        this.updateTimer = null;
      }
      this.applyHistoryState(text);
      this.pushHistory(text);
      this.isReadingFile = false;
      this.toastService.info(`Loaded "${file.name}"`);
      this.trackEvent('tool_action', {
        event_category: this.TOOL_CATEGORY,
        event_label: this.TOOL_NAME,
        action_type: 'upload_text_file',
        file_size: file.size,
        text_length: text.length,
      });
    };

    reader.onerror = () => {
      this.isReadingFile = false;
      this.toastService.error('Could not read the file. Please try another text file.');
    };

    reader.readAsText(file);
  }

  private isLikelyTextFile(file: File): boolean {
    const blockedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'application/zip', 'application/x-zip-compressed'];
    if (file.type && blockedTypes.some((prefix) => file.type.startsWith(prefix) || file.type === prefix)) {
      return false;
    }

    if (!file.type || file.type.startsWith('text/')) {
      return true;
    }

    const allowedTypes = new Set([
      'application/json',
      'application/xml',
      'application/javascript',
      'application/x-yaml',
      'application/yaml',
      'application/csv',
      'application/rtf',
      'application/octet-stream',
    ]);
    if (allowedTypes.has(file.type)) {
      return true;
    }

    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    const textExtensions = new Set([
      'txt', 'text', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm', 'log',
      'yaml', 'yml', 'rtf', 'tsv', 'ini', 'cfg', 'conf', 'js', 'ts', 'css', 'scss',
    ]);
    return textExtensions.has(ext);
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
    const stats = `Words: ${this.wordCount}\nUnique words: ${this.uniqueWordCount}\nCharacters: ${this.charCount}\nCharacters (no spaces): ${this.charCountNoSpaces}\nLines: ${this.lineCount}\nSentences: ${this.sentenceCount}\nParagraphs: ${this.paragraphCount}\nReading time: ${this.readingTimeLabel}\nSpeaking time: ${this.speakingTimeLabel}\nReadability (Flesch): ${this.readabilityScore}\nFlesch-Kincaid grade: ${this.fleschKincaidGrade}\nGunning Fog: ${this.gunningFog}\nSMOG: ${this.smogIndex}\nColeman-Liau: ${this.colemanLiau}`;
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
    this.clearHighlight();
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    this.applyHistoryState('');
    this.pushHistory('');
    this.toastService.info('Text cleared');
  }
}
