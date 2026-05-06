const fs = require('fs');

const html = fs.readFileSync('kroger_test.html', 'utf8');

// Find window.__INITIAL_STATE__
const match = html.match(/window\.__INITIAL_STATE__ = JSON\.parse\('([\s\S]+?)'\);/);

if (match) {
  try {
    // Need to unescape the JS string
    const jsonStr = match[1].replace(/\\\\/g, '\\').replace(/\\'/g, "'");
    const data = JSON.parse(jsonStr);
    
    // Look for where products might be
    console.log("Top level keys:", Object.keys(data));
    
    if (data.searchList && data.searchList.products) {
       console.log("Found products in searchList!", data.searchList.products.length);
       if (data.searchList.products.length > 0) {
          const p = data.searchList.products[0];
          console.log("Sample product:", p.description, p.price);
       }
    } else {
       // Search recursively for "products" array
       function findProducts(obj, path = "") {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj.products) && obj.products.length > 0) {
             console.log(`Found ${obj.products.length} products at path: ${path}.products`);
             const p = obj.products[0];
             console.log(`Sample: ${p.description || p.name} - Price: ${JSON.stringify(p.price)}`);
          }
          for (const key of Object.keys(obj)) {
             findProducts(obj[key], path ? `${path}.${key}` : key);
          }
       }
       findProducts(data);
    }
  } catch(e) {
    console.error("Failed to parse JSON:", e.message);
  }
} else {
  console.log("Could not find __INITIAL_STATE__");
}
