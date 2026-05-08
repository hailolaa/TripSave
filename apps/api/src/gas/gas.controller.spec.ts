import { Test, TestingModule } from '@nestjs/testing';
import { GasController } from './gas.controller';
import { GasSyncService } from '../services/gas-sync.service';

describe('GasController', () => {
  let controller: GasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GasController],
      providers: [{ provide: GasSyncService, useValue: {} }],
    }).compile();

    controller = module.get<GasController>(GasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
