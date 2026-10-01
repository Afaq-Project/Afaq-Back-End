import { Test, TestingModule } from '@nestjs/testing';
import { AiPrismaService } from './ai-prisma.service';

describe('AiPrismaService', () => {
  let service: AiPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiPrismaService],
    }).compile();

    service = module.get<AiPrismaService>(AiPrismaService);

    // Mock the inherited PrismaClient methods
    service.$connect = jest.fn();
    service.$disconnect = jest.fn();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should call $connect exactly once', async () => {
      await service.onModuleInit();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.$connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect exactly once', async () => {
      await service.onModuleDestroy();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('client getter', () => {
    it('should return the Prisma instance', () => {
      expect(service.client).toBeDefined();
      expect(service.client).toHaveProperty('$connect');
    });
  });
});
