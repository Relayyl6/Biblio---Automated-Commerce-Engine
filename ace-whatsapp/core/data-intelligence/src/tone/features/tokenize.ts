/**
 * Basic pure-TS tokenizer for conversational text.
 */

// Basic emoji regex (matches standard emoji blocks)
export const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;

export interface TokenizedTurn {
  original: string;
  sentences: string[];
  tokens: string[];
  emojis: string[];
}

export function tokenizeTurn(text: string): TokenizedTurn {
  if (!text) return { original: '', sentences: [], tokens: [], emojis: [] };

  // Emojis
  const emojis = (text.match(EMOJI_REGEX) || []);

  // Split into sentences (rudimentary: ., !, ?)
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Tokens (words, ignoring punctuation)
  const tokens = text
    .toLowerCase()
    .replace(EMOJI_REGEX, ' ')
    .replace(/[^\w\s']/g, ' ') // Keep apostrophes for contractions
    .split(/\s+/)
    .filter(t => t.length > 0);

  return {
    original: text,
    sentences,
    tokens,
    emojis
  };
}
