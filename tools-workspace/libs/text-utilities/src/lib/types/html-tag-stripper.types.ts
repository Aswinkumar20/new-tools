export interface HtmlTagStripOptions {
  inputText: string;
  preserveLineBreaks: boolean;
}

export interface HtmlTagStripResult {
  output: string;
}

export interface HtmlTagStripSuggestionContext {
  hasInput: boolean;
  hasOutput: boolean;
  preserveLineBreaks: boolean;
  containsHtmlTags: boolean;
  containsHtmlEntities: boolean;
  containsScriptOrStyle: boolean;
}
