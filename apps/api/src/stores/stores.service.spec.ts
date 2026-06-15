import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StoresService } from './stores.service';
import { Store } from './store.entity';
import { StoreChain } from './store-chain.entity';
import { GoogleMapsGasScraperService } from '../providers/oxylabs/google-maps-gas-scraper.service';

describe('StoresService', () => {
  let service: StoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        { provide: getRepositoryToken(Store), useValue: { createQueryBuilder: jest.fn(), find: jest.fn(), findOne: jest.fn(), upsert: jest.fn() } },
        { provide: getRepositoryToken(StoreChain), useValue: { findOne: jest.fn() } },
        { provide: GoogleMapsGasScraperService, useValue: { searchNearbyStoresByCoords: jest.fn() } },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
