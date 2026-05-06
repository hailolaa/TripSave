const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('d:\\Project\\TripSave\\apps\\api\\scratch\\google_maps_response.html', 'utf8');
const $ = cheerio.load(html);

const stations = [];
$('.VkpGBb').each((i, el) => {
  const element = $(el);
  const name = element.find('.dbg0pd').text().trim();
  const address = element.find('.rllt__details div:nth-child(3)').text().trim();
  const priceAttr = element.find('.f3Ucuc').attr('aria-label') || '';
  const priceText = element.find('.f3Ucuc').text().trim();
  
  // Extract price from aria-label (e.g. "Regular gasoline costs $3.85 per gallon")
  const priceMatch = priceAttr.match(/\$([0-9]\.[0-9]{2})/) || priceText.match(/\$([0-9]\.[0-9]{2})/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : null;

  if (name) {
    stations.push({ name, address, price });
  }
});

console.log(JSON.stringify(stations, null, 2));
