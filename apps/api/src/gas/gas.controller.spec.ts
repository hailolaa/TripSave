import { Test, TestingModule } from '@nestjs/testing';
import { GasController } from './gas.controller';

describe('GasController', () => {
  let controller: GasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GasController],
    }).compile();

    controller = module.get<GasController>(GasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
