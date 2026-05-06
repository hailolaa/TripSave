/**
 * String similarity utilities for product matching and normalization.
 * No external dependencies — all algorithms implemented from scratch.
 */

/**
 * Calculate Dice coefficient (bigram similarity) between two strings.
 * Returns a value between 0 (no similarity) and 1 (identical).
 *
 * @example diceCoefficient("milk whole", "whole milk") → ~1.0
 * @example diceCoefficient("milk", "bread") → ~0.0
 */
export function diceCoefficient(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersectionCount = 0;
  const bigrams2Copy = new Map(bigrams2);

  for (const [bigram, count] of bigrams1) {
    const count2 = bigrams2Copy.get(bigram) || 0;
    if (count2 > 0) {
      intersectionCount += Math.min(count, count2);
      bigrams2Copy.set(bigram, count2 - Math.min(count, count2));
    }
  }

  const totalBigrams = sum(bigrams1) + sum(bigrams2);
  return (2 * intersectionCount) / totalBigrams;
}

/**
 * Token-based similarity: compares individual words between two strings.
 * Returns the ratio of shared tokens to total unique tokens.
 *
 * @example tokenSimilarity("whole milk 1 gallon", "milk whole gallon") → 0.75
 */
export function tokenSimilarity(a: string, b: string): number {
  const tokens1 = new Set(tokenize(a));
  const tokens2 = new Set(tokenize(b));

  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) intersection++;
  }

  const union = new Set([...tokens1, ...tokens2]).size;
  return intersection / union;
}

/**
 * Combined similarity score using both Dice coefficient and token similarity.
 * Weighted: 40% Dice + 60% token-based (tokens handle reordering better).
 */
export function combinedSimilarity(a: string, b: string): number {
  return 0.4 * diceCoefficient(a, b) + 0.6 * tokenSimilarity(a, b);
}

/**
 * Clean and normalize a product name for comparison:
 * - Lowercase
 * - Remove special characters
 * - Normalize whitespace
 * - Remove common filler words
 */
export function cleanProductName(name: string): string {
  const fillerWords = new Set(['the', 'a', 'an', 'of', 'with', 'and', '&', 'or', 'in', 'for']);

  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && !fillerWords.has(w))
    .join(' ')
    .trim();
}

/**
 * Normalize unit strings for comparison:
 * "1L" → "1000ml", "1 gal" → "3785ml", "16oz" → "16oz"
 */
export function normalizeUnit(unit: string): string {
  if (!unit) return '';
  const s = unit.toLowerCase().trim();

  // Liters to ml
  const literMatch = s.match(/^(\d+(?:\.\d+)?)\s*l(?:iter)?s?$/);
  if (literMatch) return `${parseFloat(literMatch[1]) * 1000}ml`;

  // Gallons to ml
  const galMatch = s.match(/^(\d+(?:\.\d+)?)\s*gal(?:lon)?s?$/);
  if (galMatch) return `${Math.round(parseFloat(galMatch[1]) * 3785.41)}ml`;

  // Already in ml or oz — keep as-is
  return s.replace(/\s+/g, '');
}

// --- Internal helpers ---

function getBigrams(str: string): Map<string, number> {
  const bigrams = new Map<string, number>();
  for (let i = 0; i < str.length - 1; i++) {
    const bigram = str.substring(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }
  return bigrams;
}

function sum(map: Map<string, number>): number {
  let total = 0;
  for (const count of map.values()) total += count;
  return total;
}

function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 0);
}
