import { classifySearchIntent, isBlocklisted, scoreProductRelevance } from './relevance.util';

describe('Relevance Utilities', () => {
  describe('classifySearchIntent', () => {
    it('should identify generic staples', () => {
      expect(classifySearchIntent('milk')).toEqual({ type: 'exact_staple', canonical: 'milk' });
      expect(classifySearchIntent('EGGS')).toEqual({ type: 'exact_staple', canonical: 'eggs' });
      expect(classifySearchIntent('egg')).toEqual({ type: 'exact_staple', canonical: 'eggs' });
    });

    it('should return null for non-staples', () => {
      expect(classifySearchIntent('laptop')).toBeNull();
      expect(classifySearchIntent('milk chocolate')).toBeNull(); // it matches exact 'milk' so this is null
    });
  });

  describe('isBlocklisted', () => {
    it('should block known bad patterns for a query', () => {
      expect(isBlocklisted('Milk Chocolate Bar 3.5oz', 'milk')).toBe(true);
      expect(isBlocklisted('Milk of Magnesia 12oz', 'milk')).toBe(true);
      expect(isBlocklisted('Almond Milk Cookie', 'milk')).toBe(true);
      expect(isBlocklisted('Milkshake Powder Mix', 'milk')).toBe(true); // milkshake added to blocklist
      expect(isBlocklisted('Egg Rolls 6pk', 'egg')).toBe(true); // check variant blocks
    });

    it('should not block valid items', () => {
      expect(isBlocklisted('Whole Milk 1 Gallon', 'milk')).toBe(false);
      expect(isBlocklisted('Chocolate Milk 12oz', 'milk')).toBe(false); 
    });
  });

  describe('scoreProductRelevance', () => {
    it('should score "Whole Milk 1 Gallon" >= 40', () => {
      // Actually, "Whole Milk 1 Gallon" has "milk" as a whole word, not the first word.
      // So score should be 40.
      expect(scoreProductRelevance('Whole Milk 1 Gallon', 'milk')).toBe(40);
    });

    it('should score "2% Reduced Fat Milk" >= 40', () => {
      expect(scoreProductRelevance('2% Reduced Fat Milk', 'milk')).toBe(40);
    });

    it('should score "Organic Milk Half Gallon" >= 40', () => {
      expect(scoreProductRelevance('Organic Milk Half Gallon', 'milk')).toBe(40);
    });

    it('should score "Chocolate Milk 12oz" >= 40', () => {
      expect(scoreProductRelevance('Chocolate Milk 12oz', 'milk')).toBe(40);
    });

    it('should score "Milk Chocolate Bar 3.5oz" as 100/90 or 40? Actually, it starts with Milk so it gets 100 or 90.', () => {
      // Wait, "Milk Chocolate" starts with "Milk", so it gets 100! 
      // BUT it is caught by the blocklist! That's why blocklist is needed.
      expect(scoreProductRelevance('Milk Chocolate Bar 3.5oz', 'milk')).toBeGreaterThanOrEqual(90);
    });

    it('should score "Milkshake Powder Mix" < 40', () => {
      expect(scoreProductRelevance('Milkshake Powder Mix', 'milk')).toBe(10); // "milk" inside "milkshake"
    });
    
    it('should score exact matches as 100', () => {
      expect(scoreProductRelevance('Milk', 'milk')).toBe(100);
      expect(scoreProductRelevance('Milk 1 Gallon', 'milk')).toBe(100);
      expect(scoreProductRelevance('Eggs 12ct', 'egg')).toBe(100); // Plural variant match
      expect(scoreProductRelevance('Egg Large Grade A', 'eggs')).toBe(100); // Singular variant match
    });

    it('should reject unrelated category matches like avocado shampoo', () => {
      expect(scoreProductRelevance('Avocado Shampoo', 'avocado')).toBe(0);
      expect(scoreProductRelevance('Avocado Conditioner', 'avocado')).toBe(0);
      expect(scoreProductRelevance('Avocado Shampoo', 'shampoo')).toBe(100);
    });
  });
});
