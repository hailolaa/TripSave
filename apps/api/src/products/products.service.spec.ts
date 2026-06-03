import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product } from './product.entity';
import { StoreProduct } from './store-product.entity';
import { Store } from '../stores/store.entity';
import { StoreChain } from '../stores/store-chain.entity';
import { ProductImageService } from './product-image.service';

describe('ProductsService', () => {
  let service: ProductsService;
  const productsRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productsRepository },
        { provide: getRepositoryToken(Store), useValue: {} },
        { provide: getRepositoryToken(StoreChain), useValue: {} },
        { provide: getRepositoryToken(StoreProduct), useValue: {} },
        { provide: ProductImageService, useValue: { resolveImage: jest.fn().mockResolvedValue('https://example.com/avocado.jpg') } },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    productsRepository.find.mockReset();
    productsRepository.findOne.mockReset();
    productsRepository.save.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a generic avocado product instead of reusing avocado shampoo', async () => {
    productsRepository.findOne.mockResolvedValue(null);
    productsRepository.save.mockImplementation(async (product: any) => ({ id: '1', ...product }));

    const results = await service.searchProducts('avocado');

    expect(productsRepository.save).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('avocado');
  });
});
