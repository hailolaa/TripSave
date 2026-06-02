import { ComparisonService } from './comparison.service';

describe('ComparisonService integration-style image fallback', () => {
  it('ensures every product has a non-empty image (uses resolver fallback)', async () => {
    // Minimal mocks for dependencies used by formatScrapedForUI
    const osrmService: any = {};

    const nearbyStore = {
      store: {
        id: 'store-1',
        name: 'Test Store',
        lat: 32.7767,
        lng: -96.7970,
        chain: { name: 'Test Chain', type: 'grocery', logo_url: '' },
        address: '1 Test St',
      },
      distance: 1,
    };

    const storesService: any = {
      findNearbyStores: jest.fn().mockResolvedValue([nearbyStore]),
    };

    const aggregatorService: any = {
      determineCategory: jest.fn().mockReturnValue('grocery'),
    };

    const productsService: any = {};

    const gasSyncService: any = {};

    const productImageService: any = {
      resolveImage: jest.fn().mockImplementation(async (name: string, existing: string) => {
        // Simulate resolver: if existing is a valid-looking http url, return it, otherwise return a fallback
        if (existing && existing.startsWith('http')) return existing;
        return 'https://fallback.example/seed.png';
      }),
    };

    const repoStub = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(undefined),
      upsert: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new ComparisonService(
      osrmService as any,
      storesService as any,
      aggregatorService as any,
      productsService as any,
      gasSyncService as any,
      productImageService as any,
      repoStub,
      repoStub,
      repoStub,
      repoStub,
      repoStub,
    );

    const scrapedProducts = [
      // One item missing image
      { store: 'Test Store', product: 'Bananas', price: 1.23, image: '' },
      // One item with protocol-relative URL
      { store: 'Test Store', product: 'Apples', price: 2.34, image: '//images.example/apple.png' },
      // One item with data URI
      { store: 'Test Store', product: 'Oranges', price: 3.45, image: 'data:image/png;base64,AAA' },
    ];

    const results = await (service as any).formatScrapedForUI(
      scrapedProducts,
      '75201',
      'live',
      32.7767,
      -96.7970,
      25,
      3.0,
      true,
      20,
      'fruit',
    );

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    for (const item of results) {
      expect(item.products).toBeDefined();
      expect(item.products.length).toBeGreaterThan(0);
      const img = item.products[0].image;
      expect(typeof img).toBe('string');
      expect(img.length).toBeGreaterThan(0);
    }
  });
});
