import { DataSource } from 'typeorm';
import { Store } from '../stores/store.entity';
import { Product } from '../products/product.entity';
import { StoreProduct } from '../products/store-product.entity';
import { GasPrice } from '../gas/gas-price.entity';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tripsave',
  entities: [Store, Product, StoreProduct, GasPrice, __dirname + '/../**/*.entity{.ts,.js}'],
});

async function diagnose() {
  await AppDataSource.initialize();
  console.log('--- DIAGNOSTIC START ---');

  const storeCount = await AppDataSource.getRepository(Store).count();
  const productCount = await AppDataSource.getRepository(Product).count();
  const spCount = await AppDataSource.getRepository(StoreProduct).count();
  const gpCount = await AppDataSource.getRepository(GasPrice).count();

  console.log(`Stores: ${storeCount}`);
  console.log(`Products: ${productCount}`);
  console.log(`StoreProducts (Prices): ${spCount}`);
  console.log(`GasPrices: ${gpCount}`);

  if (storeCount > 0) {
    const stores = await AppDataSource.getRepository(Store).find({ take: 5, relations: ['chain'] });
    console.log('\nSample Stores:');
    stores.forEach(s => console.log(`- ${s.name} (${s.lat}, ${s.lng}) Chain: ${s.chain?.name} Type: ${s.chain?.type}`));
  }

  if (productCount > 0) {
    const products = await AppDataSource.getRepository(Product).find({ take: 5 });
    console.log('\nSample Products:');
    products.forEach(p => console.log(`- ${p.name} (Normalized: ${p.normalized_name})`));
  }

  if (spCount > 0) {
      const sps = await AppDataSource.getRepository(StoreProduct).find({ take: 5, relations: ['store', 'product'] });
      console.log('\nSample StoreProducts:');
      sps.forEach(sp => console.log(`- Store: ${sp.store?.name} Product: ${sp.product?.name} Price: ${sp.price}`));
  }

  process.exit(0);
}

diagnose().catch(err => {
  console.error(err);
  process.exit(1);
});
