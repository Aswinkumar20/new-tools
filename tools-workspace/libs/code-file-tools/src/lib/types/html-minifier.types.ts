export interface HtmlMinifierOptions {
  removeComments: boolean;
  collapseWhitespace: boolean;
  removeAttributeQuotes: boolean;
  removeOptionalTags: boolean;
  removeEmptyAttributes: boolean;
  caseSensitive: boolean;
  minifyCSS: boolean;
  minifyJS: boolean;
  rememberHistory: boolean;
}
