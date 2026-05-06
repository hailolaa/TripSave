import { Test, TestingModule } from '@nestjs/testing';
import { ComparisonController } from './comparison.controller';

describe('ComparisonController', () => {
  let controller: ComparisonController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComparisonController],
    }).compile();

    controller = module.get<ComparisonController>(ComparisonController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
