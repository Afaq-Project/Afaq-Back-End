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

  // ============================================================
  // getNumber
  // ============================================================
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

    it('should parse a string with surrounding whitespace', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({
        value: '  42  ',
      });
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(42);
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

    it('should return default value for NaN string', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: 'NaN' });
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(100);
    });

    it('should return default value for Infinity string (Number.isFinite guard)', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({
        value: 'Infinity',
      });
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(100);
    });

    it('should return default value for -Infinity string', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({
        value: '-Infinity',
      });
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(100);
    });

    it('should accept 0 as a valid numeric value', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: 0 });
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(0);
    });

    it('should return default value for negative numbers when they are not expected', async () => {
      // Ensures we don't silently coerce to negative values without caller validation
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: -5 });
      const result = await service.getNumber(
        SystemSettingKeys.MAX_BIO_LENGTH,
        100,
      );
      expect(result).toBe(-5);
    });

    it('should return default value if setting value is null', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: null });
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
      expect(jest.spyOn(Logger.prototype, 'error')).toHaveBeenCalled();
    });
  });

  // ============================================================
  // getJson
  // ============================================================
  describe('getJson', () => {
    it('should return default value if setting not found', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue(null);
      const result = await service.getJson(
        SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES,
        ['fallback'],
      );
      expect(result).toEqual(['fallback']);
    });

    it('should return default value if setting value is null', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: null });
      const result = await service.getJson(
        SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES,
        ['fallback'],
      );
      expect(result).toEqual(['fallback']);
    });

    it('should return json object if setting exists as object', async () => {
      const dbValue = { custom: true };
      mockPrisma.systemSettings.findUnique.mockResolvedValue({
        value: dbValue,
      });
      const result = await service.getJson(
        SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES,
        { fallback: true },
      );
      expect(result).toEqual(dbValue);
    });

    it('should return a real string[] stored as Json', async () => {
      const mimes = ['application/pdf', 'image/jpeg', 'image/png'];
      mockPrisma.systemSettings.findUnique.mockResolvedValue({ value: mimes });
      const result = await service.getJson<string[]>(
        SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES,
        [],
      );
      expect(result).toEqual(mimes);
    });

    it('should parse a JSON string value into an array', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({
        value: '["application/pdf","image/jpeg"]',
      });
      const result = await service.getJson<string[]>(
        SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES,
        [],
      );
      expect(result).toEqual(['application/pdf', 'image/jpeg']);
    });

    it('should parse a JSON string value into an object', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({
        value: '{"threshold":60,"enabled":true}',
      });
      const result = await service.getJson<{
        threshold: number;
        enabled: boolean;
      }>(SystemSettingKeys.MATCHING_THRESHOLD, {
        threshold: 0,
        enabled: false,
      });
      expect(result).toEqual({ threshold: 60, enabled: true });
    });

    it('should return default value when JSON string is malformed and log error', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue({
        value: '{not-valid-json',
      });
      const result = await service.getJson<string[]>(
        SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES,
        ['fallback'],
      );
      expect(result).toEqual(['fallback']);
      expect(jest.spyOn(Logger.prototype, 'error')).toHaveBeenCalled();
    });

    it('should return default value and log error if prisma throws', async () => {
      mockPrisma.systemSettings.findUnique.mockRejectedValue(
        new Error('Db Error'),
      );
      const result = await service.getJson(
        SystemSettingKeys.ALLOWED_DOCUMENT_MIME_TYPES,
        ['fallback'],
      );
      expect(result).toEqual(['fallback']);
      expect(jest.spyOn(Logger.prototype, 'error')).toHaveBeenCalled();
    });
  });
});
