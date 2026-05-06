import { DataSource } from 'typeorm';
import { StoreChain, StoreChainType } from '../stores/store-chain.entity';
import { Store, DataSource as StoreSource } from '../stores/store.entity';
import { Product, ProductCategory } from '../products/product.entity';
import { StoreProduct } from '../products/store-product.entity';
import * as dotenv from 'dotenv';

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

async function runSeeder() {
  await AppDataSource.initialize();
  console.log('DB Connection initialized. Cleaning existing data...');

  // Clear existing data to allow re-seeding
  const entities = ['store_products', 'products', 'stores', 'store_chains'];
  for (const entity of entities) {
    await AppDataSource.query(`DELETE FROM ${entity}`);
  }
  console.log('Database cleaned. Seeding...');

  // 1. Seed Chains
  const chainRepo = AppDataSource.getRepository(StoreChain);
  
  // Grocery
  const walmartInfo = chainRepo.create({ name: 'Walmart', slug: 'walmart', type: StoreChainType.GROCERY, logo_url: 'https://logo.clearbit.com/walmart.com' });
  const krogerInfo = chainRepo.create({ name: 'Kroger', slug: 'kroger', type: StoreChainType.GROCERY, logo_url: 'https://logo.clearbit.com/kroger.com' });
  const hebInfo = chainRepo.create({ name: 'H-E-B', slug: 'heb', type: StoreChainType.GROCERY, logo_url: 'https://logo.clearbit.com/heb.com' });
  
  // Pharmacy
  const cvsInfo = chainRepo.create({ name: 'CVS Pharmacy', slug: 'cvs', type: StoreChainType.PHARMACY, logo_url: 'https://logo.clearbit.com/cvs.com' });
  const walgreensInfo = chainRepo.create({ name: 'Walgreens', slug: 'walgreens', type: StoreChainType.PHARMACY, logo_url: 'https://logo.clearbit.com/walgreens.com' });

  // Gas
  const shellInfo = chainRepo.create({ name: 'Shell', slug: 'shell', type: StoreChainType.GAS, logo_url: 'https://logo.clearbit.com/shell.com' });
  const exxonInfo = chainRepo.create({ name: 'Exxon', slug: 'exxon', type: StoreChainType.GAS, logo_url: 'https://logo.clearbit.com/exxon.com' });
  
  await chainRepo.save([walmartInfo, krogerInfo, hebInfo, cvsInfo, walgreensInfo, shellInfo, exxonInfo]);
  console.log('Chains seeded.');

  // 2. Seed Stores (Dallas Area)
  const storeRepo = AppDataSource.getRepository(Store);
  const stores = [
    // Grocery
    storeRepo.create({
      chain_id: walmartInfo.id,
      name: 'Walmart Supercenter',
      city: 'Dallas',
      state: 'TX',
      lat: 32.7767,
      lng: -96.7970,
      source: StoreSource.MANUAL
    }),
    storeRepo.create({
      chain_id: krogerInfo.id,
      name: 'Kroger Marketplace',
      city: 'Dallas',
      state: 'TX',
      lat: 32.8100,
      lng: -96.7800,
      source: StoreSource.MANUAL
    }),
    // Pharmacy
    storeRepo.create({
      chain_id: cvsInfo.id,
      name: 'CVS Pharmacy',
      city: 'Dallas',
      state: 'TX',
      lat: 32.7850,
      lng: -96.8000,
      source: StoreSource.MANUAL
    }),
    // Gas Stations
    storeRepo.create({
      chain_id: shellInfo.id,
      name: 'Shell Gas Station',
      city: 'Dallas',
      state: 'TX',
      lat: 32.7700,
      lng: -96.8100,
      source: StoreSource.MANUAL
    }),
    storeRepo.create({
      chain_id: exxonInfo.id,
      name: 'Exxon Mobil',
      city: 'Dallas',
      state: 'TX',
      lat: 32.7900,
      lng: -96.7700,
      source: StoreSource.MANUAL
    })
  ];
  await storeRepo.save(stores);
  console.log('Stores, Pharmacies, and Gas Stations seeded.');

  // 3. Seed Products
  const productRepo = AppDataSource.getRepository(Product);
  const products = [
    // Grocery
    productRepo.create({ name: 'Whole Milk 1 Gallon', category: ProductCategory.DAIRY, brand: 'Store Brand', normalized_name: 'milk whole gallon' }),
    productRepo.create({ name: 'Large Eggs 12 Count', category: ProductCategory.DAIRY, brand: 'Farm Fresh', normalized_name: 'eggs large 12' }),
    productRepo.create({ name: 'White Bread', category: ProductCategory.BAKERY, brand: 'Wonder', normalized_name: 'bread white' }),
    productRepo.create({ name: 'Coca-Cola 12 Pack', category: ProductCategory.BEVERAGES, brand: 'Coke', normalized_name: 'coke soda 12 pack' }),
    
    // Pharmacy
    productRepo.create({ name: 'Tylenol Extra Strength', category: ProductCategory.MEDICINE, brand: 'Tylenol', normalized_name: 'tylenol acetaminophen' }),
    productRepo.create({ name: 'Advil Liqui-Gels', category: ProductCategory.MEDICINE, brand: 'Advil', normalized_name: 'advil ibuprofen' }),
    
    // Gas (Represented as a product for price comparison)
    productRepo.create({ name: 'Regular Unleaded Gas', category: ProductCategory.GAS, brand: 'Fuel', normalized_name: 'gas fuel regular' })
  ];
  await productRepo.save(products);
  console.log('Products seeded.');

  // 4. Seed Store Products (Prices)
  const storeProductRepo = AppDataSource.getRepository(StoreProduct);
  const productPrices = [];

  // Walmart prices (cheaper)
  productPrices.push(
    storeProductRepo.create({ store_id: stores[0].id, product_id: products[0].id, price: 2.89, source: StoreSource.MANUAL }),
    storeProductRepo.create({ store_id: stores[0].id, product_id: products[1].id, price: 1.99, source: StoreSource.MANUAL }),
    storeProductRepo.create({ store_id: stores[0].id, product_id: products[3].id, price: 5.48, source: StoreSource.MANUAL }),
  );
  
  // Kroger prices (mid)
  productPrices.push(
    storeProductRepo.create({ store_id: stores[1].id, product_id: products[0].id, price: 3.19, source: StoreSource.MANUAL }),
    storeProductRepo.create({ store_id: stores[1].id, product_id: products[2].id, price: 2.99, source: StoreSource.MANUAL }),
    storeProductRepo.create({ store_id: stores[1].id, product_id: products[3].id, price: 6.99, source: StoreSource.MANUAL }),
  );

  // CVS prices (more expensive for groceries, but has pharmacy)
  productPrices.push(
    storeProductRepo.create({ store_id: stores[2].id, product_id: products[3].id, price: 8.49, source: StoreSource.MANUAL }),
    storeProductRepo.create({ store_id: stores[2].id, product_id: products[4].id, price: 12.99, source: StoreSource.MANUAL }),
    storeProductRepo.create({ store_id: stores[2].id, product_id: products[5].id, price: 14.49, source: StoreSource.MANUAL }),
  );

  // Shell Gas
  productPrices.push(
    storeProductRepo.create({ store_id: stores[3].id, product_id: products[6].id, price: 3.45, source: StoreSource.MANUAL }),
  );

  // Exxon Gas
  productPrices.push(
    storeProductRepo.create({ store_id: stores[4].id, product_id: products[6].id, price: 3.39, source: StoreSource.MANUAL }),
  );

  await storeProductRepo.save(productPrices);
  console.log('Price comparisons seeded.');
  console.log('Seeding COMPLETE 🌱');
  process.exit(0);
}

runSeeder().catch(err => {
  console.error("Seeding failed", err);
  process.exit(1);
});
