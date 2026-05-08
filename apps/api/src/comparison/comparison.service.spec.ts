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
import { StoreChainType } from '../stores/store-chain.entity';

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
      const mockStore = {
        id: 's1',
        name: 'Shell',
        lat: 32.7767,
        lng: -96.7970,
        chain: { type: StoreChainType.GAS },
      };
      const mockGasPrice = {
        store_id: 's1',
        regular_price: 3.50,
        midgrade_price: 3.80,
        premium_price: 4.10,
        diesel_price: 4.50,
      };

      (service as any).storesService = {
        findNearbyStores: jest.fn().mockResolvedValue([{ store: mockStore, distance: 2 }])
      };
      (service as any).gasPriceRepository = {
        find: jest.fn().mockResolvedValue([mockGasPrice])
      };
      (service as any).osrmService = {
        getRouteInfo: jest.fn().mockResolvedValue({ distanceMeters: 3218.688 }) // ~2 miles
      };

      const results = await service.compareGasStations(32.7766, -96.7969, 25, 3.50);
      
      expect(results.length).toBe(1);
      expect(results[0].fill_up_cost).toBe(52.50); // 15 * 3.50
      expect(results[0].driving_cost).toBeGreaterThan(0);
      expect(results[0].true_cost).toBe(results[0].fill_up_cost + results[0].driving_cost);
    });
  });
});
