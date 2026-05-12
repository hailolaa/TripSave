import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { StoreChain } from '../stores/store-chain.entity';

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

const logoMappings = [
  { key: 'walmart', logo: 'https://logo.clearbit.com/walmart.com' },
  { key: 'target', logo: 'https://logo.clearbit.com/target.com' },
  { key: 'aldi', logo: 'https://logo.clearbit.com/aldi.us' },
  { key: 'costco', logo: 'https://logo.clearbit.com/costco.com' },
  { key: 'kroger', logo: 'https://logo.clearbit.com/kroger.com' },
  { key: 'wholefoods', logo: 'https://logo.clearbit.com/wholefoodsmarket.com' },
  { key: 'publix', logo: 'https://logo.clearbit.com/publix.com' },
  { key: 'heb', logo: 'https://logo.clearbit.com/heb.com' },
  { key: 'cvs', logo: 'https://logo.clearbit.com/cvs.com' },
  { key: 'walgreens', logo: 'https://logo.clearbit.com/walgreens.com' },
  { key: 'shell', logo: 'https://logo.clearbit.com/shell.com' },
  { key: 'exxon', logo: 'https://logo.clearbit.com/exxon.com' },
];

async function runUpdate() {
  try {
    await AppDataSource.initialize();
    console.log('DB Connection initialized.');

    const chainRepo = AppDataSource.getRepository(StoreChain);
    const allChains = await chainRepo.find();
    
    console.log(`Found ${allChains.length} total chains. Starting fuzzy match update...`);
    
    let updatedCount = 0;

    for (const mapping of logoMappings) {
      // Find all chains that contain the key in their name or slug
      const matches = allChains.filter(c => 
        c.slug.toLowerCase().includes(mapping.key) || 
        c.name.toLowerCase().includes(mapping.key)
      );
      
      for (const match of matches) {
        await chainRepo.update(match.id, { logo_url: mapping.logo });
        console.log(`✅ Updated: ${match.name} (Slug: ${match.slug}) -> ${mapping.logo}`);
        updatedCount++;
      }
    }

    console.log(`\nUpdate COMPLETE 🚀 | Total updated: ${updatedCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err);
    process.exit(1);
  }
}

runUpdate();
