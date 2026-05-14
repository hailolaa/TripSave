import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Product } from '../products/product.entity';

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

async function runReset() {
  try {
    await AppDataSource.initialize();
    console.log('DB Connection initialized.');

    const productRepo = AppDataSource.getRepository(Product);
    
    console.log('🗑️  Resetting all Product images to NULL...');
    const result = await productRepo.createQueryBuilder()
      .update(Product)
      .set({ image_url: null })
      .execute();

    console.log(`✅ Reset complete. ${result.affected} products cleared.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  }
}

runReset();
