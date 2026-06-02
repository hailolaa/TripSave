import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn', 'debug'] });
  try {
    const productsService = app.get('ProductsService') as any;
    if (!productsService || typeof productsService.backfillMissingImages !== 'function') {
      console.error('ProductsService.backfillMissingImages not available');
      process.exit(1);
    }

    const updated = await productsService.backfillMissingImages(200);
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
