const fs = require('fs');
const html = fs.readFileSync('kroger_test.html', 'utf8');

// Find all matches of price
const priceMatches = [...html.matchAll(/"price":\{([^}]+)\}/g)];
console.log(`Found ${priceMatches.length} "price":{...} objects`);

if (priceMatches.length > 0) {
  console.log("Samples:");
  priceMatches.slice(0, 5).forEach(m => console.log(m[0]));
}

// Check for other common keywords
const names = [...html.matchAll(/"description":"([^"]+)"/g)];
console.log(`Found ${names.length} "description" fields`);
if (names.length > 0) {
    names.slice(0, 5).forEach(m => console.log(m[0]));
}

// Find brand or generic name
const genericNames = [...html.matchAll(/"name":"([^"]+)"/g)];
console.log(`Found ${genericNames.length} "name" fields`);
if (genericNames.length > 0) {
    genericNames.slice(0, 5).forEach(m => console.log(m[0]));
}
