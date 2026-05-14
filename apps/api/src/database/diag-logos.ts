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

async function runDiag() {
  try {
    await AppDataSource.initialize();
    const chainRepo = AppDataSource.getRepository(StoreChain);
    
    // Find stores that have the specific fallbacks you mentioned
    const fallbacks = await chainRepo.createQueryBuilder('c')
      .where('c.logo_url LIKE :s1 OR c.logo_url LIKE :s2 OR c.logo_url LIKE :s3', 
        { s1: '%instacart.com%', s2: '%gasbuddy.com%', s3: '%goodrx.com%' })
      .getMany();

    console.log(`--- FOUND ${fallbacks.length} FALLBACKS ---`);
    for (const s of fallbacks) {
      console.log(`Store: ${s.name} | Logo: ${s.logo_url}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runDiag();
