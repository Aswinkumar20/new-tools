export interface MotivationalQuote {
  text: string;
  author: string;
  id: string;
}

export interface QuoteHistoryEntry {
  quote: MotivationalQuote;
  timestamp: number;
}

export interface QuoteGeneratorStats {
  totalGenerated: number;
  uniqueQuotes: number;
  favorites: number;
}
