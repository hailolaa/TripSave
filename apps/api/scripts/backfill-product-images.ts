import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ProductsService } from '../src/products/products.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn', 'debug'] });
  try {
    const productsService = app.get(ProductsService);
    if (!productsService || typeof productsService.backfillMissingImages !== 'function') {
      console.error('ProductsService.backfillMissingImages not available');
      process.exit(1);
    }

    const forceAll = process.argv.includes('--all') || process.argv.includes('--force');
    const replaceRealImages = process.argv.includes('--replace-real');
    const batchArgIndex = process.argv.findIndex((arg) => arg === '--batch');
    const batchSize = batchArgIndex >= 0 ? parseInt(process.argv[batchArgIndex + 1] || '200', 10) : 200;
    const updated = await productsService.backfillMissingImages(batchSize, forceAll, replaceRealImages);
    console.log(`Backfill finished. Updated ${updated} products.`);
  } catch (err) {
    console.error('Backfill failed:', err);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
