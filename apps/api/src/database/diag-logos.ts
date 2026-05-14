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
    
    // Find all entries for the major brands to see if any are missing/wrong
    const majors = await chainRepo.createQueryBuilder('c')
      .where('c.name LIKE :s1 OR c.name LIKE :s2 OR c.name LIKE :s3', 
        { s1: '%Walmart%', s2: '%Target%', s3: '%Kroger%' })
      .getMany();

    console.log(`--- FOUND ${majors.length} MAJOR BRAND ENTRIES ---`);
    for (const s of majors) {
      console.log(`Store: ${s.name} | Logo: ${s.logo_url}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runDiag();
