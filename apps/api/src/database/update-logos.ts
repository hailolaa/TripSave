import { DataSource } from 'typeorm';
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
  { key: 'meijer', logo: `https://img.logo.dev/meijer.com?token=${token}` },
  { key: 'winco', logo: `https://img.logo.dev/winfofoods.com?token=${token}` },
  { key: 'wegmans', logo: `https://img.logo.dev/wegmans.com?token=${token}` },
  { key: 'hy-vee', logo: `https://img.logo.dev/hy-vee.com?token=${token}` },
  { key: 'shoprite', logo: `https://img.logo.dev/shoprite.com?token=${token}` },
  { key: 'giant', logo: `https://img.logo.dev/giantfood.com?token=${token}` },
  { key: 'safeway', logo: `https://img.logo.dev/safeway.com?token=${token}` },
  { key: 'vons', logo: `https://img.logo.dev/vons.com?token=${token}` },
  { key: 'jewel-osco', logo: `https://img.logo.dev/jewelosco.com?token=${token}` },
  { key: 'acme', logo: `https://img.logo.dev/acmemarkets.com?token=${token}` },
  { key: 'food lion', logo: `https://img.logo.dev/foodlion.com?token=${token}` },
  { key: 'stop & shop', logo: `https://img.logo.dev/stopandshop.com?token=${token}` },
  { key: 'hannaford', logo: `https://img.logo.dev/hannaford.com?token=${token}` },
  { key: 'harris teeter', logo: `https://img.logo.dev/harristeeter.com?token=${token}` },
  { key: 'ralphs', logo: `https://img.logo.dev/ralphs.com?token=${token}` },
  { key: 'frys', logo: `https://img.logo.dev/frys.com?token=${token}` },
  { key: 'fred meyer', logo: `https://img.logo.dev/fredmeyer.com?token=${token}` },
  { key: 'smiths', logo: `https://img.logo.dev/smithsfoodanddrug.com?token=${token}` },
  { key: 'king soopers', logo: `https://img.logo.dev/kingsoopers.com?token=${token}` },
  { key: 'stater bros', logo: `https://img.logo.dev/staterbros.com?token=${token}` },
  { key: 'smart & final', logo: `https://img.logo.dev/smartandfinal.com?token=${token}` },
  { key: 'gelsons', logo: `https://img.logo.dev/gelsons.com?token=${token}` },
  { key: 'pavilions', logo: `https://img.logo.dev/pavilions.com?token=${token}` },
  { key: 'save mart', logo: `https://img.logo.dev/savemart.com?token=${token}` },
  { key: 'lucky', logo: `https://img.logo.dev/luckysupermarkets.com?token=${token}` },
  { key: 'grocery outlet', logo: `https://img.logo.dev/groceryoutlet.com?token=${token}` },
  { key: 'raleys', logo: `https://img.logo.dev/raleys.com?token=${token}` },
  { key: 'bashas', logo: `https://img.logo.dev/bashas.com?token=${token}` },
  { key: 'brookshires', logo: `https://img.logo.dev/brookshires.com?token=${token}` },
  { key: 'market basket', logo: `https://img.logo.dev/shopmarketbasket.com?token=${token}` },
  { key: 'price chopper', logo: `https://img.logo.dev/pricechopper.com?token=${token}` },
  { key: 'weis', logo: `https://img.logo.dev/weismarkets.com?token=${token}` },
  { key: 'tops', logo: `https://img.logo.dev/topsmarkets.com?token=${token}` },
  { key: 'big y', logo: `https://img.logo.dev/bigy.com?token=${token}` },
  { key: 'woodmans', logo: `https://img.logo.dev/woodmans-food.com?token=${token}` },
  { key: 'festival foods', logo: `https://img.logo.dev/festfoods.com?token=${token}` },
  
  // Pharmacies
  { key: 'cvs', logo: `https://img.logo.dev/cvs.com?token=${token}` },
  { key: 'walgreens', logo: `https://img.logo.dev/walgreens.com?token=${token}` },
  { key: 'rite aid', logo: `https://img.logo.dev/riteaid.com?token=${token}` },
  { key: 'health mart', logo: `https://img.logo.dev/healthmart.com?token=${token}` },
  { key: 'good neighbor', logo: `https://img.logo.dev/mygnp.com?token=${token}` },
  { key: 'kinney drugs', logo: `https://img.logo.dev/kinneydrugs.com?token=${token}` },
  { key: 'discount drug mart', logo: `https://img.logo.dev/discount-drugmart.com?token=${token}` },
  
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
  { key: 'bp', logo: `https://img.logo.dev/bp.com?token=${token}` },
  { key: 'arco', logo: `https://img.logo.dev/arco.com?token=${token}` },
  { key: 'speedway', logo: `https://img.logo.dev/speedway.com?token=${token}` },
  { key: 'caseys', logo: `https://img.logo.dev/caseys.com?token=${token}` },
  { key: 'wawa', logo: `https://img.logo.dev/wawa.com?token=${token}` },
  { key: 'sheetz', logo: `https://img.logo.dev/sheetz.com?token=${token}` },
  { key: 'buc-ees', logo: `https://img.logo.dev/buc-ees.com?token=${token}` },
  { key: 'sunoco', logo: `https://img.logo.dev/sunoco.com?token=${token}` },
  { key: 'texaco', logo: `https://img.logo.dev/texaco.com?token=${token}` },
  { key: 'phillips 66', logo: `https://img.logo.dev/phillips66.com?token=${token}` },
  { key: 'conoco', logo: `https://img.logo.dev/conoco.com?token=${token}` },
  { key: '76', logo: `https://img.logo.dev/76.com?token=${token}` },
  { key: 'marathon', logo: `https://img.logo.dev/marathonpetroleum.com?token=${token}` },
  { key: 'citgo', logo: `https://img.logo.dev/citgo.com?token=${token}` },
  { key: 'irving', logo: `https://img.logo.dev/irvingoil.com?token=${token}` },
  { key: 'cumberland farms', logo: `https://img.logo.dev/cumberlandfarms.com?token=${token}` },
  { key: 'stewarts', logo: `https://img.logo.dev/stewartsshops.com?token=${token}` },
  { key: 'royal farms', logo: `https://img.logo.dev/royalfarms.com?token=${token}` },
  
  // Other Stores
  { key: 'dollar general', logo: `https://img.logo.dev/dollargeneral.com?token=${token}` },
  { key: 'family dollar', logo: `https://img.logo.dev/familydollar.com?token=${token}` },
  { key: 'dollar tree', logo: `https://img.logo.dev/dollartree.com?token=${token}` },
  { key: 'big lots', logo: `https://img.logo.dev/biglots.com?token=${token}` },
  { key: 'five below', logo: `https://img.logo.dev/fivebelow.com?token=${token}` },
  { key: 'petco', logo: `https://img.logo.dev/petco.com?token=${token}` },
  { key: 'petsmart', logo: `https://img.logo.dev/petsmart.com?token=${token}` },

  // New mappings from diagnostics
  { key: 'pilot', logo: `https://img.logo.dev/pilotflyingj.com?token=${token}` },
  { key: 'flying j', logo: `https://img.logo.dev/pilotflyingj.com?token=${token}` },
  { key: 'loves', logo: `https://img.logo.dev/loves.com?token=${token}` },
  { key: 'michaels', logo: `https://img.logo.dev/michaels.com?token=${token}` },
  { key: 'restaurant depot', logo: `https://img.logo.dev/restaurantdepot.com?token=${token}` },
  { key: 'yesway', logo: `https://img.logo.dev/yesway.com?token=${token}` },
  { key: 'allsups', logo: `https://img.logo.dev/allsups.com?token=${token}` },
  { key: 'clean energy', logo: `https://img.logo.dev/cleanenergyfuels.com?token=${token}` },
  { key: 'dk', logo: `https://img.logo.dev/dk.com?token=${token}` },
  { key: 'alon', logo: `https://img.logo.dev/alon.com?token=${token}` },
];

// Normalize strings for better fuzzy matching
function normalize(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Known generic/fallback logo URLs — chains with these should be
// upgraded to a specific logo when a mapping exists.
const genericFallbackPatterns = [
  'instacart.com',
  'gasbuddy.com',
  'goodrx.com',
  'storage.com',
  'store.com',
];

function isMissingOrFallback(logoUrl: string | null | undefined): boolean {
  if (!logoUrl || logoUrl.trim() === '') return true;
  return genericFallbackPatterns.some(p => logoUrl.includes(p));
}

async function runUpdate() {
  try {
    await AppDataSource.initialize();
    console.log('DB Connection initialized.');

    const chainRepo = AppDataSource.getRepository(StoreChain);
    const allChains = await chainRepo.find();
    
    console.log(`Found ${allChains.length} total chains. Starting update...`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let fallbackCount = 0;

    // Pass 1: Specific mappings — only update chains that are missing a logo
    //         or currently have a generic fallback logo.
    for (const mapping of logoMappings) {
      const normalizedKey = normalize(mapping.key);
      const matches = allChains.filter(c => 
        normalize(c.slug).includes(normalizedKey) || 
        normalize(c.name).includes(normalizedKey)
      );
      
      for (const match of matches) {
        if (!isMissingOrFallback(match.logo_url)) {
          // If the store ALREADY has a logo that is NOT a fallback, skip it
          // BUT if the store is Shell and we have a Shell logo, it might be the same one.
          // For now, if it's not a fallback, we keep what's there.
          skippedCount++;
          continue;
        }
        await chainRepo.update(match.id, { logo_url: mapping.logo });
        console.log(`✅ Updated: ${match.name} (Slug: ${match.slug}) -> ${mapping.logo}`);
        updatedCount++;
      }
    }

    // Pass 2: Generic fallbacks for stores that still don't have ANY logo
    //         (null or empty string — never overwrite a real logo).
    const remainingChains = (await chainRepo.find()).filter(c => isMissingOrFallback(c.logo_url));
    console.log(`\nStarting fallback pass for ${remainingChains.length} chains without a specific logo...`);

    const genericLogos = {
      [StoreChainType.GAS]: `https://img.logo.dev/gasbuddy.com?token=${token}`, 
      [StoreChainType.PHARMACY]: `https://img.logo.dev/goodrx.com?token=${token}`, 
      [StoreChainType.GROCERY]: `https://img.logo.dev/instacart.com?token=${token}`, 
      [StoreChainType.WAREHOUSE]: `https://img.logo.dev/storage.com?token=${token}`, 
      [StoreChainType.GENERAL]: `https://img.logo.dev/store.com?token=${token}`, 
    };

    for (const chain of remainingChains) {
      let logo = genericLogos[chain.type] || genericLogos[StoreChainType.GENERAL];
      
      // Special logic: Warehouse and Grocery both use Instacart
      if (chain.type === StoreChainType.WAREHOUSE) {
        logo = genericLogos[StoreChainType.GROCERY];
      }

      await chainRepo.update(chain.id, { logo_url: logo });
      console.log(`📡 Fallback (${chain.type}): ${chain.name} -> ${logo}`);
      fallbackCount++;
    }

    console.log(`\nUpdate COMPLETE 🚀`);
    console.log(`Specific updates: ${updatedCount}`);
    console.log(`Skipped (kept existing): ${skippedCount}`);
    console.log(`Fallback updates: ${fallbackCount}`);
    console.log(`Total updated: ${updatedCount + fallbackCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', err);
    process.exit(1);
  }
}

runUpdate();
