import { Routes } from '@angular/router';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';

export const TEXT_UTILITIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'character-counter',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/wordsAndCharacterCounter/wordsAndCharacterCounter.component').then(m => m.WordsAndCharacterCounterComponent),
  },
  {
    path: 'text-case-convertor',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/textCaseConvertor/text-case-convertor').then(m => m.TextCaseConvertorComponent),
  },
  {
    path: 'text-to-ascii',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/textToASCII/text-to-ASCII').then(m => m.TextToASCIIComponent),
  },
  {
    path: 'remove-duplicate-lines',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/removeDuplicateLines/remove-duplicate-lines').then(m => m.RemoveDuplicateLinesComponent),
  },
  {
    path: 'text-reversal-and-palindrome-checker',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/textReverserAndPalindromeChecker/text-reversal-and-palindrome-checker').then(m => m.TextReversalAndPalindromeCheckerComponent),
  },
  {
    path: 'base64-encode-and-decode',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/base64EncodeAndDecode/base64-encode-and-decode').then(m => m.Base64EncodeAndDecodeComponent),
  },
  {
    path: 'slug-generator',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/slugGenerator/slug-generator').then(m => m.SlugGeneratorComponent),
  },
  {
    path: 'text-difference',
    providers: [provideMonacoEditor({ baseUrl: 'assets/monaco-editor/min/vs' })],
    loadComponent: () =>
      import('@tools-workspace/text-utilities/textDifferrence/text-difference').then(m => m.TextDifferenceComponent),
  },
  {
    path: 'code-merge',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/codeMerge/code-merge').then(m => m.CodeMergeComponent),
  },
  {
    path: 'url-encode-and-decode',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/urlEncodeAndDecode/url-encode-and-decode').then(m => m.UrlEncodeAndDecodeComponent),
  },
  {
    path: 'unicode-escape-unescape',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/unicodeEscapeUnescape/unicode-escape-unescape').then(m => m.UnicodeEscapeUnescapeComponent),
  },
  {
    path: 'html-tag-stripper',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/htmlTagStripper/html-tag-stripper').then(m => m.HtmlTagStripperComponent),
  },
  {
    path: 'sort-lines',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/sortLines/sort-lines').then(m => m.SortLinesComponent),
  },
  {
    path: 'trim-normalize-whitespace',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/trimNormalizeWhitespace/trim-normalize-whitespace').then(m => m.TrimNormalizeWhitespaceComponent),
  },
  {
    path: 'find-and-replace',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/findAndReplace/find-and-replace').then(m => m.FindAndReplaceComponent),
  },
  {
    path: 'line-number-tool',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/lineNumberTool/line-number-tool').then(m => m.LineNumberToolComponent),
  },
  {
    path: 'split-join-text',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/splitJoinText/split-join-text').then(m => m.SplitJoinTextComponent),
  },
  {
    path: 'regex-tester',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/regexTester/regex-tester').then(m => m.RegexTesterComponent),
  },
  {
    path: 'text-similarity',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/textSimilarity/text-similarity').then(m => m.TextSimilarityComponent),
  },
  {
    path: 'invisible-character-detector',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/invisibleCharacterDetector/invisible-character-detector').then(m => m.InvisibleCharacterDetectorComponent),
  },
  {
    path: 'word-wrap-unwrap',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/wordWrapUnwrap/word-wrap-unwrap').then(m => m.WordWrapUnwrapComponent),
  },
  {
    path: 'extract-emails-urls',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/extractEmailsUrls/extract-emails-urls').then(m => m.ExtractEmailsUrlsComponent),
  },
  {
    path: 'json-string-escape-unescape',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/jsonStringEscapeUnescape/json-string-escape-unescape').then(m => m.JsonStringEscapeUnescapeComponent),
  },
  {
    path: 'hex-encode-decode',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/hexEncodeDecode/hex-encode-decode').then(m => m.HexEncodeDecodeComponent),
  },
  {
    path: 'rot13-cipher',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/rot13Cipher/rot13-cipher').then(m => m.Rot13CipherComponent),
  },
  {
    path: 'binary-text-converter',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/binaryTextConverter/binary-text-converter').then(m => m.BinaryTextConverterComponent),
  },
  {
    path: 'morse-code-converter',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/morseCodeConverter/morse-code-converter').then(m => m.MorseCodeConverterComponent),
  },
  {
    path: 'readability-analyzer',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/readabilityAnalyzer/readability-analyzer').then(m => m.ReadabilityAnalyzerComponent),
  },
  {
    path: 'keyword-density',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/keywordDensity/keyword-density').then(m => m.KeywordDensityComponent),
  },
  {
    path: 'pako-encode-and-decode',
    loadComponent: () =>
      import('@tools-workspace/text-utilities/pakoEncodeAndDecode/pako-encode-and-decode').then(m => m.PakoEncodeAndDecodeComponent),
  },
];
