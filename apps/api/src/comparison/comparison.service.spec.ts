import { Test, TestingModule } from '@nestjs/testing';
import { ComparisonService } from './comparison.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StoreProduct } from '../products/store-product.entity';
import { GasPrice } from '../gas/gas-price.entity';
import { Product } from '../products/product.entity';
import { OsrmService } from '../integrations/osrm/osrm.service';
import { StoresService } from '../stores/stores.service';
import { AggregatorService } from '../providers/oxylabs/aggregator.service';
import { ProductsService } from '../products/products.service';

describe('ComparisonService', () => {
  let service: ComparisonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComparisonService,
        { provide: OsrmService, useValue: {} },
        { provide: StoresService, useValue: {} },
        { provide: AggregatorService, useValue: {} },
        { provide: ProductsService, useValue: {} },
        { provide: getRepositoryToken(StoreProduct), useValue: {} },
        { provide: getRepositoryToken(GasPrice), useValue: {} },
        { provide: getRepositoryToken(Product), useValue: {} },
      ],
    }).compile();

    service = module.get<ComparisonService>(ComparisonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('compareGasStations', () => {
    it('should calculate true cost correctly for a 15-gallon fill-up', async () => {
      // Mock dependencies
      const mockGasPrice = {
        id: '1',
        regular: 3.50,
        midgrade: 3.80,
        premium: 4.10,
        diesel: 4.50,
        store: { id: 's1', name: 'Shell', latitude: 32.7767, longitude: -96.7970, chain: { type: 'gas' } }
      };

      (service as any).storesService = {
        findNearbyStores: jest.fn().mockResolvedValue([{ store: mockGasPrice.store, distance: 2 }])
      };
      (service as any).gasPriceRepository = {
        find: jest.fn().mockResolvedValue([mockGasPrice])
      };
      (service as any).osrmService = {
        getDistance: jest.fn().mockResolvedValue(2) // 2 miles
      };

      const results = await service.compareGasStations(32.7766, -96.7969, 25, 3.50);
      
      expect(results.length).toBe(1);
      expect(results[0].fill_up_cost).toBe(52.50); // 15 * 3.50
      expect(results[0].driving_cost).toBeGreaterThan(0);
      expect(results[0].true_cost).toBe(results[0].fill_up_cost + results[0].driving_cost);
    });
  });
});
