/**
 * Quick test: Kroger scraping via Oxylabs universal source
 * Tests the fix: switching from deprecated kroger_search to universal
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const username = process.env.OXYLABS_USERNAME;
const password = process.env.OXYLABS_PASSWORD;

if (!username || !password) {
  console.error('❌ Missing OXYLABS_USERNAME or OXYLABS_PASSWORD in .env');
  process.exit(1);
}

async function testKrogerScrape() {
  const query = 'milk';
  const zip = '75201';
  const url = `https://www.kroger.com/search?query=${encodeURIComponent(query)}&searchType=default_search`;

  console.log(`🔍 Testing Kroger scrape for "${query}" in ZIP ${zip}...`);
  console.log(`   URL: ${url}`);
  console.log(`   Source: universal (was: kroger_search)`);
  console.log('');

  const payload = {
    source: 'universal',
    url,
    render: 'html',
    geo_location: zip,
  };

  console.log('📦 Payload:', JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const start = Date.now();
    const response = await axios.post('https://realtime.oxylabs.io/v1/queries', payload, {
      auth: { username, password },
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    });

    const elapsed = Date.now() - start;
    const html = response.data?.results?.[0]?.content || '';
    console.log(`✅ Oxylabs responded in ${elapsed}ms`);
    console.log(`   HTML length: ${html.length} chars`);
    console.log('');

    // Parse products (same logic as kroger-scraper.service.ts)
    const products = [];
    const cells = html.split('data-testid="auto-grid-cell"');
    const seen = new Set();

    for (let i = 1; i < cells.length; i++) {
      if (products.length >= 15) break;
      const cell = cells[i];
      if (cell.includes('NonProductCard')) continue;

      const priceMatch = cell.match(/<data value="(\d+\.\d{2})"/);
      let price = 0;
      if (priceMatch) price = parseFloat(priceMatch[1]);

      let nameMatch = cell.match(/<img[^>]*alt="([^"]+)"/);
      let name = '';
      if (nameMatch && nameMatch[1] && !nameMatch[1].includes('Image of')) {
        name = nameMatch[1];
      } else {
        const titleMatch = cell.match(/data-testid="cart-page-item-description"[^>]*>([^<]+)</);
        if (titleMatch) name = titleMatch[1];
      }

      if (price > 0 && name && !seen.has(name)) {
        seen.add(name);
        products.push({ name: name.trim(), price });
      }
    }

    // Fallback: JSON chunks
    if (products.length === 0) {
      console.log('   ⚠️  No DOM products found, trying JSON regex fallback...');
      const looseRegex = /"description":"([^"]{5,80})"[^}]*?"(?:price|regular|promo)":(\d+\.\d{2})/gi;
      let match;
      while ((match = looseRegex.exec(html)) !== null && products.length < 15) {
        const name = match[1].replace(/\\u[0-9A-Fa-f]{4}/g, '').trim();
        if (!seen.has(name) && !name.includes('Policy') && !name.includes('Center')) {
          seen.add(name);
          products.push({ name, price: parseFloat(match[2]) });
        }
      }
    }

    console.log(`🛒 Parsed ${products.length} products:`);
    products.forEach((p, i) => {
      console.log(`   ${i + 1}. $${p.price.toFixed(2)} — ${p.name}`);
    });

    if (products.length === 0) {
      console.log('');
      console.log('⚠️  0 products parsed. Dumping first 2000 chars of HTML for debugging:');
      console.log(html.substring(0, 2000));
    }
  } catch (err) {
    console.error(`❌ Request failed: ${err.message}`);
    if (err.response) {
      console.error(`   Status: ${err.response.status}`);
      console.error(`   Data:`, JSON.stringify(err.response.data).substring(0, 500));
    }
  }
}

testKrogerScrape();
