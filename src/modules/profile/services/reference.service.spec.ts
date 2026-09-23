import { Test, TestingModule } from '@nestjs/testing';
import { ReferenceService } from './reference.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('ReferenceService', () => {
  let service: ReferenceService;

  const mockPrisma = {
    countries: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    cities: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    languagesMaster: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    maritalStatuses: { findMany: jest.fn() },
    educationLevel: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferenceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReferenceService>(ReferenceService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCountries', () => {
    it('should apply default sort nameEn asc when not specified', async () => {
      mockPrisma.countries.findMany.mockResolvedValue([]);
      mockPrisma.countries.count.mockResolvedValue(0);

      await service.getCountries({ page: 1, limit: 20, skip: 0 });

      expect(mockPrisma.countries.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { nameEn: 'asc' },
        }),
      );
    });

    it('should honor sort and order query params', async () => {
      mockPrisma.countries.findMany.mockResolvedValue([]);
      mockPrisma.countries.count.mockResolvedValue(0);

      await service.getCountries({
        page: 1,
        limit: 20,
        skip: 0,
        sort: 'nameAr',
        order: 'desc',
      });

      expect(mockPrisma.countries.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { nameAr: 'desc' },
        }),
      );
    });

    it('should search across nameEn, nameAr, isoCode, isoCode2', async () => {
      mockPrisma.countries.findMany.mockResolvedValue([]);
      mockPrisma.countries.count.mockResolvedValue(0);

      await service.getCountries({
        page: 1,
        limit: 20,
        skip: 0,
        search: 'SAU',
      });

      const call = mockPrisma.countries.findMany.mock.calls[0][0];
      const orClause = call.where.AND[1].OR;
      expect(orClause).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ isoCode: expect.anything() }),
          expect.objectContaining({ isoCode2: expect.anything() }),
        ]),
      );
    });
  });

  describe('getCities', () => {
    it('should filter by countryId', async () => {
      mockPrisma.cities.findMany.mockResolvedValue([]);
      mockPrisma.cities.count.mockResolvedValue(0);

      await service.getCities({
        page: 1,
        limit: 20,
        skip: 0,
        countryId: 'c1',
      });

      const call = mockPrisma.cities.findMany.mock.calls[0][0];
      expect(call.where.AND).toEqual(
        expect.arrayContaining([expect.objectContaining({ countryId: 'c1' })]),
      );
    });

    it('should honor sort and order query params', async () => {
      mockPrisma.cities.findMany.mockResolvedValue([]);
      mockPrisma.cities.count.mockResolvedValue(0);

      await service.getCities({
        page: 1,
        limit: 20,
        skip: 0,
        sort: 'nameAr',
        order: 'desc',
      });

      expect(mockPrisma.cities.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { nameAr: 'desc' },
        }),
      );
    });
  });

  describe('getLanguages', () => {
    it('should return paginated master languages', async () => {
      mockPrisma.languagesMaster.findMany.mockResolvedValue([]);
      mockPrisma.languagesMaster.count.mockResolvedValue(0);

      await service.getLanguages({ page: 1, limit: 20, skip: 0 });

      expect(mockPrisma.languagesMaster.findMany).toHaveBeenCalled();
    });
  });

  describe('getAppLanguages', () => {
    it('should return the APP_LANGUAGES constant', () => {
      const result = service.getAppLanguages();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
