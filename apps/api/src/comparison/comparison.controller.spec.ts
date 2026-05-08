import { Test, TestingModule } from '@nestjs/testing';
import { ComparisonController } from './comparison.controller';
import { ComparisonService } from './comparison.service';
import { UsersService } from '../users/users.service';

describe('ComparisonController', () => {
  let controller: ComparisonController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComparisonController],
      providers: [
        { provide: ComparisonService, useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ComparisonController>(ComparisonController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
