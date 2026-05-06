const fs = require('fs');
const html = fs.readFileSync('kroger_test.html', 'utf8');

const prefix = "window.__INITIAL_STATE__ = JSON.parse('";
const idx = html.indexOf(prefix);
if (idx !== -1) {
    const start = idx + prefix.length;
    let end = html.indexOf("');", start);
    // Be careful with escaped quotes in the string
    while (html.charAt(end - 1) === '\\') {
       end = html.indexOf("');", end + 1);
    }
    
    if (end !== -1) {
       let jsonStr = html.substring(start, end);
       jsonStr = jsonStr.replace(/\\\\/g, '\\').replace(/\\'/g, "'");
       try {
           const data = JSON.parse(jsonStr);
           // recursive search for products
           let found = false;
           function search(obj, path) {
              if (obj && Array.isArray(obj.products) && obj.products.length > 0) {
                 console.log("Found products at:", path);
                 console.log("Product count:", obj.products.length);
                 console.log("First product:", obj.products[0].description, obj.products[0].price);
                 found = true;
              }
              if (obj && typeof obj === 'object') {
                 for (let k in obj) {
                    if (obj.hasOwnProperty(k)) {
                       search(obj[k], path ? path + "." + k : k);
                    }
                 }
              }
           }
           search(data, "");
           if(!found) console.log("Parsed JSON, but no 'products' array found.");
       } catch(e) {
           console.log("JSON parse error:", e.message);
       }
    } else {
        console.log("Could not find end of string");
    }
} else {
    console.log("Could not find prefix");
}
