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
    
    // Check a few known "skipped" ones from the user's log
    const samples = await chainRepo.createQueryBuilder('c')
      .where('c.name LIKE :s1 OR c.name LIKE :s2 OR c.name LIKE :s3', { s1: '%Walmart%', s2: '%Shell%', s3: '%Exxon%' })
      .getMany();

    console.log('--- DIAGNOSTICS ---');
    for (const s of samples) {
      console.log(`Store: ${s.name} | Logo: ${s.logo_url}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runDiag();
