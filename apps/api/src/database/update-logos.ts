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
  { slug: 'walmart', logo: 'https://logo.clearbit.com/walmart.com' },
  { slug: 'target', logo: 'https://logo.clearbit.com/target.com' },
  { slug: 'aldi', logo: 'https://logo.clearbit.com/aldi.us' },
  { slug: 'costco', logo: 'https://logo.clearbit.com/costco.com' },
  { slug: 'kroger', logo: 'https://logo.clearbit.com/kroger.com' },
  { slug: 'wholefoods', logo: 'https://logo.clearbit.com/wholefoodsmarket.com' },
  { slug: 'publix', logo: 'https://logo.clearbit.com/publix.com' },
  { slug: 'heb', logo: 'https://logo.clearbit.com/heb.com' },
  { slug: 'cvs', logo: 'https://logo.clearbit.com/cvs.com' },
  { slug: 'walgreens', logo: 'https://logo.clearbit.com/walgreens.com' },
  { slug: 'shell', logo: 'https://logo.clearbit.com/shell.com' },
  { slug: 'exxon', logo: 'https://logo.clearbit.com/exxon.com' },
];

async function runUpdate() {
  try {
    await AppDataSource.initialize();
    console.log('DB Connection initialized.');

    const chainRepo = AppDataSource.getRepository(StoreChain);
    
    console.log('Updating logo URLs...');
    
    for (const mapping of logoMappings) {
      const result = await chainRepo.update(
        { slug: mapping.slug },
        { logo_url: mapping.logo }
      );
      
      if (result.affected && result.affected > 0) {
        console.log(`✅ Updated logo for: ${mapping.slug}`);
      } else {
        console.log(`ℹ️ No chain found with slug: ${mapping.slug} (skipping)`);
      }
    }

    console.log('Update COMPLETE 🚀');
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err);
    process.exit(1);
  }
}

runUpdate();
