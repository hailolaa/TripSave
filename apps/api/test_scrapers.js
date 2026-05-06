const axios = require('axios');
const fs = require('fs');
require('dotenv').config({ path: 'd:/Project/TripSave/apps/api/.env' });

const username = process.env.OXYLABS_USERNAME;
const password = process.env.OXYLABS_PASSWORD;

if (!username || !password) {
  console.error("Missing Oxylabs credentials in .env");
  process.exit(1);
}

const client = axios.create({
  baseURL: 'https://realtime.oxylabs.io/v1/queries',
  auth: { username, password },
  headers: { 'Content-Type': 'application/json' },
});

async function testScraper(name, url) {
  console.log(`Testing ${name} scraper with URL: ${url}`);
  try {
    const response = await client.post('', {
      source: 'universal',
      url: url,
      render: 'html',
      geo_location: 'US-10001',
    });

    const results = response.data?.results;
    if (!results || results.length === 0) {
      console.log(`${name} failed: No results from Oxylabs`);
      return;
    }

    const content = results[0].content || '';
    console.log(`${name} returned ${content.length} bytes of HTML.`);
    
    // Save the raw HTML so we can inspect it to fix the parsers
    fs.writeFileSync(`d:/Project/TripSave/apps/api/${name.toLowerCase()}_test.html`, content);
    console.log(`Saved HTML to ${name.toLowerCase()}_test.html`);
    
    // Quick heuristic checks
    if (name === 'Kroger') {
      const hasNextData = content.includes('__NEXT_DATA__');
      const hasProducts = content.includes('"products":[');
      console.log(`Kroger hints: __NEXT_DATA__ = ${hasNextData}, "products":[ = ${hasProducts}`);
    } else if (name === 'Instacart') {
      const hasNextData = content.includes('__NEXT_DATA__');
      const hasApollo = content.includes('__APOLLO_STATE__');
      const hasItemCard = content.includes('data-testid="item-card"');
      console.log(`Instacart hints: __NEXT_DATA__ = ${hasNextData}, __APOLLO_STATE__ = ${hasApollo}, item-card = ${hasItemCard}`);
    }
  } catch (err) {
    console.error(`${name} request failed:`, err.response?.data || err.message);
  }
}

async function main() {
  await testScraper('Kroger', 'https://www.kroger.com/search?query=milk&searchType=default_search');
  await testScraper('Instacart', 'https://www.instacart.com/store/s?k=milk');
}

main();
