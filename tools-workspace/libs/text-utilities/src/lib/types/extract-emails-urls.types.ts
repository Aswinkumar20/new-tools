export type ExtractEmailsUrlsType = 'emails' | 'urls' | 'both';

export interface ExtractEmailsUrlsOption {
  value: ExtractEmailsUrlsType;
  label: string;
}

export interface ExtractEmailsUrlsResult {
  items: string[];
  emailCount: number;
  urlCount: number;
  outputText: string;
}

export interface ExtractEmailsUrlsSuggestionContext {
  hasInput: boolean;
  extractType: ExtractEmailsUrlsType;
  extractedCount: number;
  emailCount: number;
  urlCount: number;
}
