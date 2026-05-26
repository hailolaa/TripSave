export const CATEGORY_BLOCKLIST: Record<string, string[]> = {
  milk: [
    'milk chocolate', 'milk of magnesia',
    'almond milk cookie', 'milk bath', 'milk cleanser',
    'coconut milk candy', 'milk makeup', 'milk paint',
    'condensed milk cake', 'evaporated milk dessert',
    'milkshake', 'yogurt', 'yoghurt', 'shampoo', 'conditioner', 
    'lotion', 'cheese', 'coffee', 'latte', 'lassi', 'ice cream', 
    'creamer', 'protein shake', 'body wash', 'body scrub', 
    'hair mask', 'facial cleanser', 'protein powder', 'cereal'
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

/**
 * Generate plural/singular variants of a query so that
 * "egg" matches "eggs", "berry" matches "berries", etc.
 */
export function getQueryVariants(query: string): string[] {
  const q = query.toLowerCase().trim();
  const variants = new Set<string>([q]);

  // Singular → Plural
  if (q.endsWith('y') && !['a','e','i','o','u'].includes(q[q.length - 2])) {
    variants.add(q.slice(0, -1) + 'ies');        // berry → berries
  } else if (q.endsWith('s') || q.endsWith('sh') || q.endsWith('ch') || q.endsWith('x') || q.endsWith('z')) {
    variants.add(q + 'es');                        // dish → dishes
  } else {
    variants.add(q + 's');                         // egg → eggs
  }

  // Plural → Singular
  if (q.endsWith('ies')) {
    variants.add(q.slice(0, -3) + 'y');            // berries → berry
  } else if (q.endsWith('es')) {
    variants.add(q.slice(0, -2));                  // dishes → dish
    variants.add(q.slice(0, -1));                  // tomatoes → tomato (via -es → -e is wrong, but -es → '' is right)
  } else if (q.endsWith('s') && !q.endsWith('ss')) {
    variants.add(q.slice(0, -1));                  // eggs → egg
  }

  return [...variants];
}

export function classifySearchIntent(query: string): { type: string; canonical: string } | null {
  const q = query.toLowerCase().trim();
  const staples = ['milk', 'eggs', 'bread', 'chicken', 'rice', 'water', 'butter', 'cheese'];

  // Direct match
  if (staples.includes(q)) {
    return { type: 'exact_staple', canonical: q };
  }

  // Check variants (e.g., "egg" → try "eggs")
  const variants = getQueryVariants(q);
  for (const v of variants) {
    if (staples.includes(v)) {
      return { type: 'exact_staple', canonical: v };
    }
  }

  return null;
}

export function isBlocklisted(productName: string, query: string): boolean {
  const q = query.toLowerCase().trim();
  const name = productName.toLowerCase();

  // Check blocklist for the query itself and all its variants
  const variants = getQueryVariants(q);
  for (const variant of variants) {
    const patterns = CATEGORY_BLOCKLIST[variant] ?? [];
    if (patterns.some(pattern => name.includes(pattern))) {
      return true;
    }
  }
  return false;
}

export function scoreProductRelevance(productName: string, query: string): number {
  const name = productName.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  const variants = getQueryVariants(q);

  let bestScore = 0;

  for (const variant of variants) {
    let score = 0;

    // Exact match or starts with variant + space
    if (name === variant || name.startsWith(variant + ' ')) {
      score = 100;
    }
    // Variant is a whole word at the start
    else if (new RegExp(`^${variant}\\b`).test(name)) {
      score = 90;
    }
    // Variant is a whole word anywhere
    else if (new RegExp(`\\b${variant}\\b`).test(name)) {
      const firstWord = name.split(' ')[0];
      score = (firstWord === variant) ? 70 : 40;
    }
    // Variant appears but not as a standalone word (e.g. "milkshake")
    else if (name.includes(variant)) {
      score = 10;
    }

    if (score > bestScore) bestScore = score;
  }

  return bestScore;
}

