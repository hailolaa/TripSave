const fs = require('fs');

const html = fs.readFileSync('instacart_payload.html', 'utf8');

function parseInstacart(html) {
    const products = [];
    const seen = new Set();
    
    // First, try to find blocks that represent an item
    const blocks = html.match(/<li[^>]*data-testid="item_list_item[^>]*>([\s\S]+?)<\/li>/gi) || [];
    
    for (const block of blocks) {
        // Find price using screen reader text
        const priceMatch = block.match(/Current price: \$(\d+\.\d{2})/);
        let price = 0;
        if (priceMatch) {
            price = parseFloat(priceMatch[1]);
        } else {
            // Check for original price if current price is missing (unlikely but possible)
            const origPriceMatch = block.match(/Original Price: \$(\d+\.\d{2})/);
            if (origPriceMatch) price = parseFloat(origPriceMatch[1]);
        }
        
        // Find name using image alt text or heading
        let nameMatch = block.match(/alt="([^"]+)"/);
        let name = '';
        if (nameMatch && nameMatch[1] && !nameMatch[1].includes('logo')) {
             name = nameMatch[1];
        } else {
            // fallback to heading
            const headingMatch = block.match(/<div[^>]*role="heading"[^>]*>([^<]+)<\/div>/);
            if (headingMatch) name = headingMatch[1];
        }
        
        // Find store name from the store logo or link
        let storeMatch = block.match(/alt="([^"]+) logo"/);
        let store = storeMatch ? storeMatch[1] : 'Instacart';
        
        if (price > 0 && name && !seen.has(name)) {
            seen.add(name);
            products.push({ store, product: name, price });
        }
    }
    
    // Fallback if blocks aren't found
    if (products.length === 0) {
        const looseRegex = /Current price: \$(\d+\.\d{2})[\s\S]{0,500}?(?:alt="([^"]+)"|role="heading"[^>]*>([^<]+)<\/div>)/gi;
        let match;
        while ((match = looseRegex.exec(html)) !== null) {
            const price = parseFloat(match[1]);
            const name = (match[2] || match[3] || '').trim();
            if (name && !name.includes('logo') && !seen.has(name)) {
                 seen.add(name);
                 products.push({ store: 'Instacart', product: name, price });
            }
        }
    }
    
    return products;
}

const results = parseInstacart(html);
console.log(`Found ${results.length} products:`);
results.forEach(r => console.log(`${r.store}: ${r.product} - $${r.price}`));
