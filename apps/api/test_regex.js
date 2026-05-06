const fs = require('fs');

function testKroger() {
  const html = fs.readFileSync('kroger_test.html', 'utf8');
  console.log("--- Kroger ---");
  // Try to find products array
  const productsMatch = html.match(/"products":\[(.*?)\]/);
  if (productsMatch) {
    const productsStr = productsMatch[0];
    const items = [...productsStr.matchAll(/{"description":"([^"]+)".*?"price":{.*?regular":(\d+\.\d{2})/g)];
    console.log(`Found ${items.length} products using regex 1`);
    if(items.length > 0) console.log(items[0][1], items[0][2]);
  } else {
    // Let's try matching descriptions and prices anywhere
    const items = [...html.matchAll(/"description":"([^"]+)".*?"price":.*?"regular":(\d+\.\d{2})/g)];
    console.log(`Found ${items.length} products using regex 2`);
    if(items.length > 0) console.log(items[0][1], items[0][2]);
  }
}

function testInstacart() {
  const html = fs.readFileSync('instacart_test.html', 'utf8');
  console.log("--- Instacart ---");
  // Instacart might be redirecting or blocking
  console.log("Title:", html.match(/<title[^>]*>([^<]+)<\/title>/)?.[1]);
  if (html.includes('captcha') || html.includes('challenge')) {
    console.log("Instacart is showing a captcha/challenge page.");
  }
}

testKroger();
testInstacart();
