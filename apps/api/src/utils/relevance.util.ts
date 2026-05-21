export const CATEGORY_BLOCKLIST: Record<string, string[]> = {
  milk: [
    'milk chocolate', 'milk of magnesia',
    'almond milk cookie', 'milk bath', 'milk cleanser',
    'coconut milk candy', 'milk makeup', 'milk paint',
    'condensed milk cake', 'evaporated milk dessert',
    'milkshake'
  ],
  eggs: [
    'egg rolls', 'egg noodles', 'egg drop soup mix',
    'easter egg', 'egg shampoo', 'egg chair'
  ],
  water: [
    'water gun', 'water balloon', 'watermelon', 'water color',
    'water filter pitcher'
  ],
  bread: [
    'bread maker', 'bread basket', 'bread board', 'cornbread mix'
  ],
  chicken: [
    'chicken broth powder', 'chicken flavored ramen',
    'rubber chicken', 'chicken wire'
  ],
};

export function classifySearchIntent(query: string): { type: string; canonical: string } | null {
  const q = query.toLowerCase().trim();
  const staples = ['milk', 'eggs', 'bread', 'chicken', 'rice', 'water', 'butter', 'cheese'];
  
  if (staples.includes(q)) {
    return { type: 'exact_staple', canonical: q };
  }
  return null;
}

export function isBlocklisted(productName: string, query: string): boolean {
  const q = query.toLowerCase().trim();
  const patterns = CATEGORY_BLOCKLIST[q] ?? [];
  const name = productName.toLowerCase();
  
  return patterns.some(pattern => name.includes(pattern));
}

export function scoreProductRelevance(productName: string, query: string): number {
  const name = productName.toLowerCase().trim();
  const q = query.toLowerCase().trim();

  // Exact match or starts with query + space
  if (name === q || name.startsWith(q + ' ')) return 100;

  // Query is a whole word at the start
  const startsWithWord = new RegExp(`^${q}\\b`);
  if (startsWithWord.test(name)) return 90;

  // Query is a whole word anywhere
  const wholeWord = new RegExp(`\\b${q}\\b`);
  if (wholeWord.test(name)) {
    // Penalize if query word comes after other strong category words
    const firstWord = name.split(' ')[0];
    if (firstWord !== q) return 40;
    return 70;
  }

  // Query appears but not as a standalone word (e.g. "milkshake")
  if (name.includes(q)) return 10;

  return 0;
}
