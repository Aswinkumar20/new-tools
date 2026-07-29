import type { CftRelatedToolLink } from '../shared/cft-tool-suggestion.model';
import type { JavascriptMinifierOptions } from '../types/javascript-minifier.types';

export const JS_MINIFIER_HISTORY_LIMIT = 10;
export const JS_MINIFIER_HISTORY_PREVIEW_LENGTH = 60;

export const JS_MINIFIER_SAMPLE = `// Sample JavaScript for minification
function calculateTotal(items) {
    let total = 0;
    
    // Loop through items
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        total += item.price * item.quantity;
    }
    
    // Apply discount if applicable
    if (total > 100) {
        total = total * 0.9; // 10% discount
    }
    
    console.log('Total calculated:', total);
    return total;
}

// Example usage
const cart = [
    { price: 25.99, quantity: 2 },
    { price: 15.50, quantity: 1 },
    { price: 8.75, quantity: 3 }
];

const finalTotal = calculateTotal(cart);
console.log('Final total:', finalTotal);`;

export const JS_MINIFIER_DEFAULT_OPTIONS: JavascriptMinifierOptions = {
  removeComments: true,
  removeWhitespace: true,
  removeEmptyStatements: true,
  removeUnnecessarySemicolons: true,
  removeConsoleLogs: false,
  removeDebugger: true,
  rememberHistory: true
};

export const JS_MINIFIER_RELATED_TOOLS: ReadonlyArray<CftRelatedToolLink> = [
  {
    label: 'CSS Minifier',
    path: '/code-file-tools/css-minifier',
    description: 'Minify stylesheets alongside scripts'
  },
  {
    label: 'HTML Minifier',
    path: '/code-file-tools/html-minifier',
    description: 'Minify pages that embed this script'
  },
  {
    label: 'Clipboard Viewer',
    path: '/code-file-tools/clipboard-viewer',
    description: 'Inspect JS copied from DevTools'
  },
  {
    label: 'HTML Entity Encoder',
    path: '/code-file-tools/html-entity-encoder',
    description: 'Encode script snippets before embedding'
  }
];
