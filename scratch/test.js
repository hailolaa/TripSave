const html = `
<div data-testid="auto-grid-cell" class="AutoGrid-cell min-w-0" style="margin:8px;flex-basis:16.2rem;width:auto">
  <div data-citrus-component="Card" data-testid="product-card-0" aria-label="Vital Farms® Pasture-Raised Large Brown Eggs" class="citrus-Card ProductCard border color-border-neutral-tertiary border-solid flex flex-col w-full overflow-hidden px-8 pt-8 rounded-large hover:shadow-2">
    <div class="mb-4 mx-auto mt-24 text-center h-152 w-152" data-testid="product-image" data-qa="product-image">
      <a data-citrus-component="CXLink" aria-label="Vital Farms® Pasture-Raised Large Brown Eggs" aria-hidden="true" tabindex="-1" class="citrus-Link citrus-Link--inherit brand " href="/p/vital-farms-pasture-raised-large-brown-eggs/0086174500001?fulfillment=PICKUP">
        <div class="citrus-Image-container h-full w-full items-center justify-center" aria-busy="true" data-citrus-component="Image">
          <img role="presentation" data-testid="product-image-loaded" aria-label="Image of Vital Farms® Pasture-Raised Large Brown Eggs" src="https://www.kroger.com/product/images/medium/front/0086174500001" alt="Vital Farms® Pasture-Raised Large Brown Eggs" loading="lazy" class="citrus-Image-img" height="11" width="0"/>
        </div>
      </a>
    </div>
    <div class="flex flex-col mb-8">
      <data value="6.99" typeof="Price" class="kds-Price kds-Price--alternate" aria-label="Sale: $6.99 discounted from $7.39" data-qa="cart-page-item-price" data-testid="product-item-unit-price">
        <meta name="priceCurrency" content="USD"/>
        <mark class="kds-Price-promotional kds-Price-promotional--decorated">
          <sup class="kds-Price-superscript">$</sup><span class="kds-Price-promotional-dropCaps">6</span><sup class="kds-Price-superscript"><span class="screen-reader">.</span>99</sup>
        </mark>
      </data>
    </div>
  </div>
</div>
`;

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
    products.push({ store: 'Kroger', product: name.trim(), price });
  }
}
console.log('DOM Parsed:', products.length);
if (products.length > 0) console.log(products.slice(0,2));
