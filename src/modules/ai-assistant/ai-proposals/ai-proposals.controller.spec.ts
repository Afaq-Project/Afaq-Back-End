/* eslint-disable @typescript-eslint/unbound-method */
// [OMA-W006-T005] Test proposal review lifecycle, atomic acceptance, and rollback snapshot
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AiProposalsController } from './ai-proposals.controller';
import { AiProposalsService } from './ai-proposals.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('AiProposalsController', () => {
  let controller: AiProposalsController;
  let mockProposalsService: {
    getProposalsForPage: jest.Mock;
    acceptProposal: jest.Mock;
    rejectProposal: jest.Mock;
  };

  const mockRequest = {
    user: { id: 'user-uuid-1' },
  };

  beforeEach(async () => {
    mockProposalsService = {
      getProposalsForPage: jest
        .fn()
        .mockResolvedValue([
          { id: 'prop-1', pageId: 'page-1', status: 'PENDING' },
        ]),
      acceptProposal: jest.fn().mockResolvedValue({
        proposalId: 'prop-1',
        status: 'ACCEPTED',
        snapshotCreated: true,
        pageId: 'page-1',
      }),
      rejectProposal: jest.fn().mockResolvedValue({
        proposalId: 'prop-1',
        status: 'REJECTED',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiProposalsController],
      providers: [
        { provide: AiProposalsService, useValue: mockProposalsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AiProposalsController>(AiProposalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // [OMA-W006-T005] Test proposal review lifecycle, atomic acceptance, and rollback snapshot
  describe('getProposalsForPage', () => {
    it('should query proposals for page with user context', async () => {
      const pageId = 'page-uuid-1';
      const result = await controller.getProposalsForPage(mockRequest, pageId);

      expect(mockProposalsService.getProposalsForPage).toHaveBeenCalledWith(
        mockRequest.user.id,
        pageId,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('prop-1');
    });
  });

  // [OMA-W006-T005] Test proposal review lifecycle, atomic acceptance, and rollback snapshot
  describe('acceptProposal', () => {
    it('should accept proposal and carry explicit HTTP 200 status code metadata', async () => {
      const proposalId = 'prop-uuid-1';
      const result = await controller.acceptProposal(mockRequest, proposalId);

      expect(mockProposalsService.acceptProposal).toHaveBeenCalledWith(
        mockRequest.user.id,
        proposalId,
      );
      expect(result).toEqual({
        proposalId: 'prop-1',
        status: 'ACCEPTED',
        snapshotCreated: true,
        pageId: 'page-1',
      });

      // Verify explicit HTTP 200 metadata for POST action endpoint
      const httpCode = Reflect.getMetadata(
        '__httpCode__',
        controller.acceptProposal,
      );
      expect(httpCode).toBe(HttpStatus.OK);
    });
  });

  // [OMA-W006-T005] Test proposal review lifecycle, atomic acceptance, and rollback snapshot
  describe('rejectProposal', () => {
    it('should reject proposal and carry explicit HTTP 200 status code metadata', async () => {
      const proposalId = 'prop-uuid-1';
      const result = await controller.rejectProposal(mockRequest, proposalId);

      expect(mockProposalsService.rejectProposal).toHaveBeenCalledWith(
        mockRequest.user.id,
        proposalId,
      );
      expect(result).toEqual({
        proposalId: 'prop-1',
        status: 'REJECTED',
      });

      // Verify explicit HTTP 200 metadata for POST action endpoint
      const httpCode = Reflect.getMetadata(
        '__httpCode__',
        controller.rejectProposal,
      );
      expect(httpCode).toBe(HttpStatus.OK);
    });
  });
});
