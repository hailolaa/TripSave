import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { StoreChain } from '../stores/store-chain.entity';
import { Store } from '../stores/store.entity';

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

function cleanName(name: string): string {
  if (!name) return name;
  
  let cleaned = name;
  
  // 1. Remove everything after $ (price info)
  cleaned = cleaned.split('$')[0];
  
  // 2. Remove address/phone info after specific separators
  const separators = [' - ', ' · ', ' | ', ' @ '];
  for (const sep of separators) {
    cleaned = cleaned.split(sep)[0];
  }
  
  // 3. Remove "Regular", "Premium", "Gas Station" suffixes if they are messy
  cleaned = cleaned.replace(/\s(Regular|Premium|Diesel|Gas Station|Gas Stop).*$/i, '');
  
  // 4. Remove any trailing punctuation or junk
  cleaned = cleaned.trim().replace(/[*"']$/, '').trim();
  
  return cleaned;
}

async function runCleanup() {
  try {
    await AppDataSource.initialize();
    console.log('DB Connection initialized.');

    const chainRepo = AppDataSource.getRepository(StoreChain);
    const storeRepo = AppDataSource.getRepository(Store);

    // 1. Clean StoreChains
    const chains = await chainRepo.find();
    console.log(`Cleaning ${chains.length} Store Chains...`);
    for (const chain of chains) {
      const newName = cleanName(chain.name);
      if (newName !== chain.name) {
        await chainRepo.update(chain.id, { name: newName });
        console.log(`✨ Chain: "${chain.name}" -> "${newName}"`);
      }
    }

    // 2. Clean Stores
    const stores = await storeRepo.find();
    console.log(`\nCleaning ${stores.length} Stores...`);
    for (const store of stores) {
      const newName = cleanName(store.name);
      if (newName !== store.name) {
        await storeRepo.update(store.id, { name: newName });
        console.log(`✨ Store: "${store.name}" -> "${newName}"`);
      }
    }

    console.log('\n✅ Cleanup complete! 🚀');
    process.exit(0);
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  }
}

runCleanup();
