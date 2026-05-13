import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Product, ProductCategory } from '../products/product.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tripsave',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
});

const categoryImages = {
  [ProductCategory.PRODUCE]: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.MEAT]: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.DAIRY]: 'https://images.unsplash.com/photo-1550583724-125581f77833?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.BAKERY]: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.BEVERAGES]: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.SNACKS]: 'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.MEDICINE]: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.CLEANING]: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.PET]: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.BABY]: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.PERSONAL_CARE]: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.HOUSEHOLD]: 'https://images.unsplash.com/photo-1528740561666-dc2479bd08bc?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.GAS]: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.OTHER]: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.CANNED]: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.CONDIMENTS]: 'https://images.unsplash.com/photo-1607604668248-f0143ad3964f?auto=format&fit=crop&q=80&w=400',
  [ProductCategory.FROZEN]: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=400',
};

function resolveCategory(name: string): ProductCategory {
  const n = name.toLowerCase();
  if (n.includes('milk') || n.includes('cheese') || n.includes('yogurt') || n.includes('butter') || n.includes('dairy')) return ProductCategory.DAIRY;
  if (n.includes('meat') || n.includes('beef') || n.includes('chicken') || n.includes('pork') || n.includes('steak') || n.includes('turkey')) return ProductCategory.MEAT;
  if (n.includes('fruit') || n.includes('veg') || n.includes('apple') || n.includes('banana') || n.includes('carrot') || n.includes('tomato') || n.includes('produce')) return ProductCategory.PRODUCE;
  if (n.includes('bread') || n.includes('bakery') || n.includes('cake') || n.includes('muffin') || n.includes('bagel')) return ProductCategory.BAKERY;
  if (n.includes('water') || n.includes('drink') || n.includes('juice') || n.includes('soda') || n.includes('beverage') || n.includes('coke') || n.includes('pepsi')) return ProductCategory.BEVERAGES;
  if (n.includes('snack') || n.includes('chip') || n.includes('cookie') || n.includes('candy') || n.includes('chocolate')) return ProductCategory.SNACKS;
  if (n.includes('frozen') || n.includes('ice cream') || n.includes('pizza')) return ProductCategory.FROZEN;
  if (n.includes('med') || n.includes('pill') || n.includes('drug') || n.includes('vitamin') || n.includes('tylenol') || n.includes('pharmacy')) return ProductCategory.MEDICINE;
  if (n.includes('clean') || n.includes('soap') || n.includes('wash') || n.includes('detergent')) return ProductCategory.CLEANING;
  if (n.includes('baby') || n.includes('diaper') || n.includes('infant')) return ProductCategory.BABY;
  if (n.includes('dog') || n.includes('cat') || n.includes('pet') || n.includes('bird')) return ProductCategory.PET;
  if (n.includes('fuel') || n.includes('gas') || n.includes('unleaded') || n.includes('diesel')) return ProductCategory.GAS;
  
  return ProductCategory.OTHER;
}

async function runUpdate() {
  try {
    await AppDataSource.initialize();
    console.log('DB Connection initialized.');

    const productRepo = AppDataSource.getRepository(Product);
    const products = await productRepo.find();

    console.log(`Processing ${products.length} products for backfill...`);
    
    let updatedCount = 0;

    for (const product of products) {
      let needsUpdate = false;
      const updateData: any = {};

      if (product.category === ProductCategory.OTHER) {
        const newCategory = resolveCategory(product.name);
        if (newCategory !== ProductCategory.OTHER) {
          updateData.category = newCategory;
          needsUpdate = true;
        }
      }

      if (!product.image_url) {
        const category = updateData.category || product.category;
        updateData.image_url = categoryImages[category] || categoryImages[ProductCategory.OTHER];
        needsUpdate = true;
      }

      if (needsUpdate) {
        await productRepo.update(product.id, updateData);
        updatedCount++;
      }
      
      if (updatedCount > 0 && updatedCount % 100 === 0) {
        console.log(`Updated ${updatedCount} products...`);
      }
    }

    console.log(`\nBackfill COMPLETE 🚀 | Total updated: ${updatedCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err);
    process.exit(1);
  }
}

runUpdate();
