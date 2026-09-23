import { Test, TestingModule } from '@nestjs/testing';
import { SystemSettingsService } from './system-settings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { SystemSettingKeys } from '../constants/system-settings.keys';

describe('SystemSettingsService', () => {
  let service: SystemSettingsService;

  const mockPrisma = {
    systemSettings: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemSettingsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<SystemSettingsService>(SystemSettingsService);

    // Silence logger
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getNumber', () => {
    it('should return default value if setting not found', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue(null);
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(100);
    });

    it('should return number value if setting exists and is number', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: 500 });
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(500);
    });

    it('should return parsed number if setting is string', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: '300' });
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(300);
    });

    it('should return default value if string cannot be parsed', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({
        value: 'invalid',
      });
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(100);
    });

    it('should return default value and log error if prisma throws', async () => {
      mockPrisma.systemSettings.findUnique.mockRejectedValue(
        new Error('Db Error'),
      );
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(100);
      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });

  describe('getJson', () => {
    it('should return default value if setting not found', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue(null);
      const result = await service.getJson('some_key' as any, { a: 1 });
      expect(result).toEqual({ a: 1 });
    });

    it('should return default value if setting value is null', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: null });
      const result = await service.getJson('some_key' as any, { a: 1 });
      expect(result).toEqual({ a: 1 });
    });

    it('should return json object if setting exists', async () => {
      const dbValue = { custom: true };
      mockPrisma.systemSettings.findUnique.mockResolvedValue({
        value: dbValue,
      });
      const result = await service.getJson('some_key' as any, { a: 1 });
      expect(result).toEqual(dbValue);
    });

    it('should return default value and log error if prisma throws', async () => {
      mockPrisma.systemSettings.findUnique.mockRejectedValue(
        new Error('Db Error'),
      );
      const result = await service.getJson('some_key' as any, { a: 1 });
      expect(result).toEqual({ a: 1 });
      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });
});
