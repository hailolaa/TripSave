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

const token = process.env.LOGO_DEV_TOKEN || 'pk_UUfT4NowQ-GmCHtVoknvfg';

const logoMappings = [
  { key: 'walmart', logo: `https://img.logo.dev/walmart.com?token=${token}` },
  { key: 'target', logo: `https://img.logo.dev/target.com?token=${token}` },
  { key: 'aldi', logo: `https://img.logo.dev/aldi.us?token=${token}` },
  { key: 'costco', logo: `https://img.logo.dev/costco.com?token=${token}` },
  { key: 'kroger', logo: `https://img.logo.dev/kroger.com?token=${token}` },
  { key: 'wholefoods', logo: `https://img.logo.dev/wholefoodsmarket.com?token=${token}` },
  { key: 'publix', logo: `https://img.logo.dev/publix.com?token=${token}` },
  { key: 'heb', logo: `https://img.logo.dev/heb.com?token=${token}` },
  { key: 'cvs', logo: `https://img.logo.dev/cvs.com?token=${token}` },
  { key: 'walgreens', logo: `https://img.logo.dev/walgreens.com?token=${token}` },
  { key: 'shell', logo: `https://img.logo.dev/shell.com?token=${token}` },
  { key: 'exxon', logo: `https://img.logo.dev/exxon.com?token=${token}` },
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
