import { DataSource, IsNull } from 'typeorm';
import * as dotenv from 'dotenv';
import { StoreChain, StoreChainType } from '../stores/store-chain.entity';

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
  // Grocery
  { key: 'walmart', logo: `https://img.logo.dev/walmart.com?token=${token}` },
  { key: 'target', logo: `https://img.logo.dev/target.com?token=${token}` },
  { key: 'aldi', logo: `https://img.logo.dev/aldi.us?token=${token}` },
  { key: 'costco', logo: `https://img.logo.dev/costco.com?token=${token}` },
  { key: 'kroger', logo: `https://img.logo.dev/kroger.com?token=${token}` },
  { key: 'wholefoods', logo: `https://img.logo.dev/wholefoodsmarket.com?token=${token}` },
  { key: 'publix', logo: `https://img.logo.dev/publix.com?token=${token}` },
  { key: 'heb', logo: `https://img.logo.dev/heb.com?token=${token}` },
  { key: 'sprouts', logo: `https://img.logo.dev/sprouts.com?token=${token}` },
  { key: 'trader joes', logo: `https://img.logo.dev/traderjoes.com?token=${token}` },
  { key: 'albertsons', logo: `https://img.logo.dev/albertsons.com?token=${token}` },
  { key: 'tom thumb', logo: `https://img.logo.dev/tomthumb.com?token=${token}` },
  { key: 'sams club', logo: `https://img.logo.dev/samsclub.com?token=${token}` },
  
  // Pharmacies
  { key: 'cvs', logo: `https://img.logo.dev/cvs.com?token=${token}` },
  { key: 'walgreens', logo: `https://img.logo.dev/walgreens.com?token=${token}` },
  { key: 'rite aid', logo: `https://img.logo.dev/riteaid.com?token=${token}` },
  
  // Gas Stations
  { key: 'shell', logo: `https://img.logo.dev/shell.com?token=${token}` },
  { key: 'exxon', logo: `https://img.logo.dev/exxon.com?token=${token}` },
  { key: 'chevron', logo: `https://img.logo.dev/chevron.com?token=${token}` },
  { key: 'mobil', logo: `https://img.logo.dev/mobil.com?token=${token}` },
  { key: 'valero', logo: `https://img.logo.dev/valero.com?token=${token}` },
  { key: 'quiktrip', logo: `https://img.logo.dev/quiktrip.com?token=${token}` },
  { key: '7-eleven', logo: `https://img.logo.dev/7-eleven.com?token=${token}` },
  { key: 'racetrac', logo: `https://img.logo.dev/racetrac.com?token=${token}` },
  { key: 'circle k', logo: `https://img.logo.dev/circlek.com?token=${token}` },
  { key: 'murphy usa', logo: `https://img.logo.dev/murphyusa.com?token=${token}` },
  
  // Other Stores
  { key: 'dollar general', logo: `https://img.logo.dev/dollargeneral.com?token=${token}` },
  { key: 'family dollar', logo: `https://img.logo.dev/familydollar.com?token=${token}` },
  { key: 'dollar tree', logo: `https://img.logo.dev/dollartree.com?token=${token}` },
];

async function runUpdate() {
  try {
    await AppDataSource.initialize();
    console.log('DB Connection initialized.');

    const chainRepo = AppDataSource.getRepository(StoreChain);
    const allChains = await chainRepo.find();
    
    console.log(`Found ${allChains.length} total chains. Starting fuzzy match update...`);
    
    let updatedCount = 0;
    let fallbackCount = 0;

    // Pass 1: Specific mappings based on name/slug
    for (const mapping of logoMappings) {
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

    // Pass 2: Generic fallbacks for stores that still don't have a logo
    const remainingChains = await chainRepo.find({ where: { logo_url: IsNull() } });
    console.log(`\nStarting fallback pass for ${remainingChains.length} chains...`);

    const genericLogos = {
      [StoreChainType.GAS]: `https://img.logo.dev/gasbuddy.com?token=${token}`, 
      [StoreChainType.PHARMACY]: `https://img.logo.dev/goodrx.com?token=${token}`, 
      [StoreChainType.GROCERY]: `https://img.logo.dev/instacart.com?token=${token}`, 
      [StoreChainType.WAREHOUSE]: `https://img.logo.dev/storage.com?token=${token}`, 
      [StoreChainType.GENERAL]: `https://img.logo.dev/store.com?token=${token}`, 
    };

    for (const chain of remainingChains) {
      const logo = genericLogos[chain.type];
      if (logo) {
        await chainRepo.update(chain.id, { logo_url: logo });
        console.log(`ℹ️ Fallback: ${chain.name} (${chain.type}) -> ${logo}`);
        fallbackCount++;
      }
    }

    console.log(`\nUpdate COMPLETE 🚀`);
    console.log(`Specific updates: ${updatedCount}`);
    console.log(`Fallback updates: ${fallbackCount}`);
    console.log(`Total updated: ${updatedCount + fallbackCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err);
    process.exit(1);
  }
}

runUpdate();
