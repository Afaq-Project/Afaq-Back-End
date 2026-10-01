import { Test, TestingModule } from '@nestjs/testing';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesRepository } from './opportunities.repository';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

describe('OpportunitiesService', () => {
  let service: OpportunitiesService;
  let repository: OpportunitiesRepository;

  const mockRepository = {
    findMany: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findById: jest.fn().mockResolvedValue({ id: 'some-id' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunitiesService,
        { provide: OpportunitiesRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<OpportunitiesService>(OpportunitiesService);
    repository = module.get<OpportunitiesRepository>(OpportunitiesRepository);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(repository).toBeDefined();
  });

  describe('findMany', () => {
    it('Default params → skip=0, take=20, orderBy: { createdAt: desc }, 7-field select (EC-001)', async () => {
      await service.findMany({});
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: expect.objectContaining({
            id: true,
            title: true,
            organization: true,
            country: true,
            deadline: true,
            opportunityType: true,
            isRemote: true,
          }),
        }),
      );

      const callArgs = mockRepository.findMany.mock.calls[0][0];

      expect(Object.keys(callArgs.select)).toHaveLength(7);
    });

    it('limit=9999 → repository receives take=100 (EC-002)', async () => {
      await service.findMany({ limit: 9999 });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('page=99999 → returns empty data array + correct meta (EC-003)', async () => {
      const res = await service.findMany({ page: 99999, limit: 10 });
      expect(res.data).toEqual([]);
      expect(res.meta).toEqual({
        page: 99999,
        limit: 10,
        total: 0,
        pages: 0,
      });
    });

    it('sort=forbidden:asc → throws BadRequestException with INVALID_SORT_FIELD (EC-004)', async () => {
      await expect(service.findMany({ sort: 'forbidden:asc' })).rejects.toThrow(
        new BadRequestException('INVALID_SORT_FIELD'),
      );
    });

    it('sort=title:sideways → throws BadRequestException with VALIDATION_ERROR (EC-005)', async () => {
      await expect(
        service.findMany({ sort: 'title:sideways' }),
      ).rejects.toThrow(new BadRequestException('VALIDATION_ERROR'));
    });

    it('fields=not_real → throws BadRequestException with INVALID_FIELD (EC-006)', async () => {
      await expect(service.findMany({ fields: 'not_real' })).rejects.toThrow(
        new BadRequestException('INVALID_FIELD'),
      );
    });

    it('fields=* → select has exactly 18 keys (EC-007)', async () => {
      await service.findMany({ fields: '*' });

      const callArgs = mockRepository.findMany.mock.calls[0][0];

      expect(Object.keys(callArgs.select)).toHaveLength(18);
    });

    it('fields omitted → select has exactly 7 keys (EC-008)', async () => {
      await service.findMany({});

      const callArgs = mockRepository.findMany.mock.calls[0][0];

      expect(Object.keys(callArgs.select)).toHaveLength(7);
    });

    it('deadline_from=2027-01-01, deadline_to=2026-01-01 → throws BadRequestException with INVALID_DATE_RANGE (EC-009)', async () => {
      await expect(
        service.findMany({
          deadline_from: '2027-01-01',
          deadline_to: '2026-01-01',
        }),
      ).rejects.toThrow(new BadRequestException('INVALID_DATE_RANGE'));
    });

    it('study_levels=Master,PhD → where clause contains { studyLevels: { hasSome: [Master, PhD] } } (EC-012)', async () => {
      await service.findMany({ study_levels: 'Master,PhD' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studyLevels: { hasSome: ['Master', 'PhD'] },
          }),
        }),
      );
    });

    it('fields_of_study=CS,Math → where clause contains { fieldsOfStudy: { hasSome: [CS, Math] } } (EC-012)', async () => {
      await service.findMany({ fields_of_study: 'CS,Math' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fieldsOfStudy: { hasSome: ['CS', 'Math'] },
          }),
        }),
      );
    });

    it('q=master → where clause contains OR with contains: master + mode: insensitive on title and description (EC-014)', async () => {
      await service.findMany({ q: 'master' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'master', mode: 'insensitive' } },
              { description: { contains: 'master', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('Valid ID, Prisma returns record → record returned with all 18 fields (EC-019, FR-015)', async () => {
      const mockRecord = { id: 'some-id' }; // For simplicity, we just check if it returns what repository mocked
      mockRepository.findById.mockResolvedValueOnce(mockRecord);

      const res = await service.findById('some-id', '*');
      expect(res).toEqual(mockRecord);

      const callArgs = mockRepository.findById.mock.calls[0][0];
      expect(Object.keys(callArgs.select)).toHaveLength(18);
    });

    it('Valid ID, fields=id,title → the generated select object has 2 keys (EC-022)', async () => {
      mockRepository.findById.mockResolvedValueOnce({ id: 'some-id' });
      await service.findById('some-id', 'id,title');

      const callArgs = mockRepository.findById.mock.calls[0][0];
      expect(Object.keys(callArgs.select)).toHaveLength(2);
    });

    it('Valid ID, fields=forbidden → throws BadRequestException with INVALID_FIELD (EC-022)', async () => {
      await expect(service.findById('some-id', 'forbidden')).rejects.toThrow(
        new BadRequestException('INVALID_FIELD'),
      );
    });

    it('Valid ID, not found (Prisma returns null) → throws NotFoundException with message "Opportunity not found" and key OPPORTUNITY_NOT_FOUND (EC-021)', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);
      await expect(service.findById('some-id')).rejects.toThrow(
        new NotFoundException('Opportunity not found', 'OPPORTUNITY_NOT_FOUND'),
      );
    });

    it('Prisma connection error during findById → throws ServiceUnavailableException (EC-024)', async () => {
      mockRepository.findById.mockRejectedValueOnce(
        new ServiceUnavailableException(),
      );
      await expect(service.findById('some-id')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
