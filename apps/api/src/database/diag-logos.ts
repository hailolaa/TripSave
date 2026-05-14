import { DataSource, Like } from 'typeorm';
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

async function runDiag() {
  try {
    await AppDataSource.initialize();
    const chainRepo = AppDataSource.getRepository(StoreChain);
    
    // Find all entries for Walmart in both StoreChain and Store tables
    const majors = await chainRepo.createQueryBuilder('c')
      .where('c.name LIKE :s1', { s1: '%Walmart%' })
      .getMany();

    console.log(`--- FOUND ${majors.length} WALMART STORE CHAINS ---`);
    for (const s of majors) {
      console.log(`Chain: ${s.name} | Logo: ${s.logo_url}`);
    }

    // Check the Store table and its links
    try {
      const stores = await AppDataSource.getRepository(Store).find({
        where: { name: Like('%Walmart%') },
        relations: ['chain']
      });
      
      console.log(`--- FOUND ${stores.length} WALMART STORES ---`);
      for (const s of stores) {
        console.log(`Store: ${s.name} | Linked Chain: ${s.chain?.name || 'NONE'} | Chain Logo: ${s.chain?.logo_url || 'NONE'}`);
      }
    } catch (e) {
      console.log('Note: Store relation check failed:', e.message);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runDiag();
