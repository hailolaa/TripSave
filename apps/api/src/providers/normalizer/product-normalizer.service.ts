import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Product, ProductCategory } from '../../products/product.entity';
import { NormalizedProduct } from '../../common/interfaces/normalized-product.interface';
import { cleanProductName, combinedSimilarity } from '../../utils/string-similarity.util';

/** Minimum similarity score to consider two product names as the same product */
const MATCH_THRESHOLD = 0.65;

/** Keyword → ProductCategory mapping for category inference */
const CATEGORY_KEYWORDS: Record<string, ProductCategory> = {
  milk: ProductCategory.DAIRY, cheese: ProductCategory.DAIRY, yogurt: ProductCategory.DAIRY,
  butter: ProductCategory.DAIRY, cream: ProductCategory.DAIRY, egg: ProductCategory.DAIRY,
  chicken: ProductCategory.MEAT, beef: ProductCategory.MEAT, pork: ProductCategory.MEAT,
  steak: ProductCategory.MEAT, turkey: ProductCategory.MEAT, sausage: ProductCategory.MEAT,
  apple: ProductCategory.PRODUCE, banana: ProductCategory.PRODUCE, lettuce: ProductCategory.PRODUCE,
  tomato: ProductCategory.PRODUCE, onion: ProductCategory.PRODUCE, potato: ProductCategory.PRODUCE,
  bread: ProductCategory.BAKERY, bagel: ProductCategory.BAKERY, muffin: ProductCategory.BAKERY,
  water: ProductCategory.BEVERAGES, juice: ProductCategory.BEVERAGES, soda: ProductCategory.BEVERAGES,
  cola: ProductCategory.BEVERAGES, coffee: ProductCategory.BEVERAGES, tea: ProductCategory.BEVERAGES,
  chips: ProductCategory.SNACKS, cookie: ProductCategory.SNACKS, cracker: ProductCategory.SNACKS,
  frozen: ProductCategory.FROZEN, pizza: ProductCategory.FROZEN, ice: ProductCategory.FROZEN,
  soup: ProductCategory.CANNED, bean: ProductCategory.CANNED, tuna: ProductCategory.CANNED,
  ketchup: ProductCategory.CONDIMENTS, mustard: ProductCategory.CONDIMENTS, sauce: ProductCategory.CONDIMENTS,
  detergent: ProductCategory.CLEANING, bleach: ProductCategory.CLEANING, soap: ProductCategory.CLEANING,
  diaper: ProductCategory.BABY, formula: ProductCategory.BABY, wipes: ProductCategory.BABY,
  tylenol: ProductCategory.MEDICINE, advil: ProductCategory.MEDICINE, vitamin: ProductCategory.MEDICINE,
  shampoo: ProductCategory.PERSONAL_CARE, toothpaste: ProductCategory.PERSONAL_CARE,
  paper: ProductCategory.HOUSEHOLD, towel: ProductCategory.HOUSEHOLD, trash: ProductCategory.HOUSEHOLD,
  dog: ProductCategory.PET, cat: ProductCategory.PET, pet: ProductCategory.PET,
  gas: ProductCategory.GAS, fuel: ProductCategory.GAS, diesel: ProductCategory.GAS,
};

/**
 * Product normalization service.
 * Matches external product names against existing DB products using string similarity.
 * Creates new products when no close match is found.
 */
@Injectable()
export class ProductNormalizerService {
  private readonly logger = new Logger(ProductNormalizerService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Find or create a Product entity that matches the given external product data.
   * Uses string similarity to avoid duplicate products from different sources.
   */
  async findOrCreateProduct(externalProduct: NormalizedProduct): Promise<Product> {
    const cleanedName = cleanProductName(externalProduct.name);

    // 1. Try exact normalized_name match first (fast path)
    const exactMatch = await this.productRepository.findOne({
      where: { normalized_name: cleanedName },
    });
    if (exactMatch) return exactMatch;

    // 2. Try fuzzy matching against existing products in the same category
    const category = this.inferCategory(externalProduct);
    const candidates = await this.productRepository.find({
      where: category ? { category } : undefined,
      take: 200,
    });

    let bestMatch: Product | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const candidateClean = candidate.normalized_name || cleanProductName(candidate.name);
      const score = combinedSimilarity(cleanedName, candidateClean);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    if (bestMatch && bestScore >= MATCH_THRESHOLD) {
      this.logger.debug(`Matched "${externalProduct.name}" → "${bestMatch.name}" (score: ${bestScore.toFixed(2)})`);
      return bestMatch;
    }

    // 3. No match found — create new product
    this.logger.log(`Creating new product: "${externalProduct.name}" (no match above ${MATCH_THRESHOLD})`);
    const newProductData: any = {
      name: externalProduct.name,
      normalized_name: cleanedName,
      category: category || ProductCategory.OTHER,
      brand: externalProduct.brand,
      image_url: externalProduct.imageUrl,
    };
    const newProduct = this.productRepository.create(newProductData as Product);

    return this.productRepository.save(newProduct);
  }

  /**
   * Infer ProductCategory from product name and external category.
   */
  inferCategory(product: NormalizedProduct): ProductCategory | null {
    // Try the external category first
    if (product.category) {
      const extCat = product.category.toLowerCase();
      for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
        if (extCat.includes(keyword)) return category;
      }
    }

    // Fall back to product name keyword matching
    const nameLower = product.name.toLowerCase();
    for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
      if (nameLower.includes(keyword)) return category;
    }

    return null;
  }

  /**
   * Normalize a product name for storage and comparison.
   */
  normalizeName(name: string): string {
    return cleanProductName(name);
  }
}
