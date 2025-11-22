import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

interface Quote {
  text: string;
  author: string;
  id: string;
}

interface QuoteHistory {
  quote: Quote;
  timestamp: number;
}

const MOTIVATIONAL_QUOTES: Quote[] = [
  { id: '1', text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { id: '2', text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
  { id: '3', text: 'Life is what happens to you while you\'re busy making other plans.', author: 'John Lennon' },
  { id: '4', text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
  { id: '5', text: 'It is during our darkest moments that we must focus to see the light.', author: 'Aristotle' },
  { id: '6', text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
  { id: '7', text: 'Don\'t let yesterday take up too much of today.', author: 'Will Rogers' },
  { id: '8', text: 'You learn more from failure than from success.', author: 'Unknown' },
  { id: '9', text: 'If you are working on something exciting that you really care about, you don\'t have to be pushed. The vision pulls you.', author: 'Steve Jobs' },
  { id: '10', text: 'People who are crazy enough to think they can change the world, are the ones who do.', author: 'Rob Siltanen' },
  { id: '11', text: 'Failure will never overtake me if my determination to succeed is strong enough.', author: 'Og Mandino' },
  { id: '12', text: 'We may encounter many defeats but we must not be defeated.', author: 'Maya Angelou' },
  { id: '13', text: 'Knowing is not enough; we must apply. Wishing is not enough; we must do.', author: 'Johann Wolfgang von Goethe' },
  { id: '14', text: 'Imagine your life is perfect in every respect; what would it look like?', author: 'Brian Tracy' },
  { id: '15', text: 'We generate fears while we sit. We overcome them by action.', author: 'Dr. Henry Link' },
  { id: '16', text: 'Whether you think you can or think you can\'t, you\'re right.', author: 'Henry Ford' },
  { id: '17', text: 'The person who says it cannot be done should not interrupt the person who is doing it.', author: 'Chinese Proverb' },
  { id: '18', text: 'There are no traffic jams along the extra mile.', author: 'Roger Staubach' },
  { id: '19', text: 'It is never too late to be what you might have been.', author: 'George Eliot' },
  { id: '20', text: 'You become what you believe.', author: 'Oprah Winfrey' },
  { id: '21', text: 'I would rather die of passion than of boredom.', author: 'Vincent van Gogh' },
  { id: '22', text: 'A person who never made a mistake never tried anything new.', author: 'Albert Einstein' },
  { id: '23', text: 'If you can dream it, you can do it.', author: 'Walt Disney' },
  { id: '24', text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { id: '25', text: 'If you want to lift yourself up, lift up someone else.', author: 'Booker T. Washington' },
  { id: '26', text: 'Certain things catch your eye, but pursue only those that capture your heart.', author: 'Ancient Indian Proverb' },
  { id: '27', text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
  { id: '28', text: 'Everything you\'ve ever wanted is on the other side of fear.', author: 'George Addair' },
  { id: '29', text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
  { id: '30', text: 'Fall seven times and stand up eight.', author: 'Japanese Proverb' },
  { id: '31', text: 'The two most important days in your life are the day you are born and the day you find out why.', author: 'Mark Twain' },
  { id: '32', text: 'When you reach the end of your rope, tie a knot in it and hang on.', author: 'Franklin D. Roosevelt' },
  { id: '33', text: 'You must be the change you wish to see in the world.', author: 'Mahatma Gandhi' },
  { id: '34', text: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', author: 'Ralph Waldo Emerson' },
  { id: '35', text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { id: '36', text: 'An unexamined life is not worth living.', author: 'Socrates' },
  { id: '37', text: 'Twenty years from now you will be more disappointed by the things that you didn\'t do than by the ones you did do.', author: 'Mark Twain' },
  { id: '38', text: 'The only person you are destined to become is the person you decide to be.', author: 'Ralph Waldo Emerson' },
  { id: '39', text: 'Go confidently in the direction of your dreams. Live the life you have imagined.', author: 'Henry David Thoreau' },
  { id: '40', text: 'When I stand before God at the end of my life, I would hope that I would not have a single bit of talent left and could say, I used everything you gave me.', author: 'Erma Bombeck' }
];

@Component({
  selector: 'lib-motivational-quote-generator',
  standalone: true,
  templateUrl: './motivational-quote-generator.html',
  styleUrls: ['./motivational-quote-generator.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MotivationalQuoteGeneratorComponent {
  readonly currentQuote = signal<Quote | null>(null);
  readonly quoteHistory = signal<QuoteHistory[]>([]);
  readonly favorites = signal<string[]>([]);

  readonly hasCurrentQuote = computed(() => this.currentQuote() !== null);
  readonly hasHistory = computed(() => this.quoteHistory().length > 0);
  readonly isFavorite = computed(() => {
    const quote = this.currentQuote();
    return quote ? this.favorites().includes(quote.id) : false;
  });

  readonly stats = computed(() => {
    const history = this.quoteHistory();
    const uniqueQuotes = new Set(history.map((h) => h.quote.id)).size;
    return {
      totalGenerated: history.length,
      uniqueQuotes,
      favorites: this.favorites().length
    };
  });

  constructor() {
    // Generate initial quote
    this.generateQuote();
  }

  generateQuote(): void {
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    const quote = MOTIVATIONAL_QUOTES[randomIndex];

    this.currentQuote.set(quote);
    this.quoteHistory.update((history) => [
      { quote, timestamp: Date.now() },
      ...history
    ].slice(0, 50));
  }

  toggleFavorite(): void {
    const quote = this.currentQuote();
    if (!quote) {
      return;
    }

    this.favorites.update((favs) => {
      if (favs.includes(quote.id)) {
        return favs.filter((id) => id !== quote.id);
      } else {
        return [...favs, quote.id];
      }
    });
  }

  copyQuote(): void {
    const quote = this.currentQuote();
    if (!quote) {
      return;
    }

    const text = `"${quote.text}" - ${quote.author}`;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Success - could show a toast notification
      })
      .catch(() => {
        // Error handling
      });
  }

  clearHistory(): void {
    this.quoteHistory.set([]);
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
}
