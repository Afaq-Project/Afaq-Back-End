import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';
import { CreateTestResultDto } from '../dto/create-test-result.dto';
import { UpdateTestResultDto } from '../dto/update-test-result.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TestResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService,
  ) {}

  /**
   * Validates the score against standard test boundaries and step.
   * Uses exact integer arithmetic formula to avoid floating-point drift.
   *
   * @param test StandardizedTest record with constraints.
   * @param score the score to validate.
   */
  private validateScore(
    test: {
      minScore: Prisma.Decimal;
      maxScore: Prisma.Decimal;
      scoreStep: Prisma.Decimal;
    },
    score: number,
  ): void {
    const min = Number(test.minScore);
    const max = Number(test.maxScore);
    const step = Number(test.scoreStep);

    if (score < min || score > max) {
      throw new BadRequestException({
        message: `Score must be between ${min} and ${max}`,
        code: 'SCORE_OUT_OF_RANGE',
      });
    }

    // Step validation MUST use exact integer arithmetic formula: Math.round(val * 100)
    const scoreVal = Math.round(score * 100);
    const minVal = Math.round(min * 100);
    const stepVal = Math.round(step * 100);

    const diff = Math.abs(scoreVal - minVal);
    if (diff % stepVal !== 0) {
      throw new BadRequestException({
        message: `Score must be in increments of ${step} from the minimum score`,
        code: 'SCORE_NOT_ALIGNED_TO_STEP',
      });
    }
  }

  async create(userId: string, data: CreateTestResultDto) {
    // Enforce MAX_TEST_RESULTS
    const settings = await this.prisma.systemSettings.findUnique({
      where: { key: 'profile.max_test_results' },
    });
    const maxResults = settings?.value ? Number(settings.value) : 10;

    const count = await this.prisma.userTestResults.count({
      where: { userId },
    });

    if (count >= maxResults) {
      throw new ConflictException({
        message: `Maximum test results (${maxResults}) reached`,
        code: 'MAX_TEST_RESULTS_REACHED',
      });
    }

    const test = await this.prisma.standardizedTests.findUnique({
      where: { id: data.testId },
    });

    if (!test || !test.isActive) {
      throw new BadRequestException({
        message: 'TEST_NOT_FOUND',
        code: 'INVALID_TEST',
      });
    }

    this.validateScore(test, data.score);

    const exists = await this.prisma.userTestResults.findFirst({
      where: { userId, testId: data.testId },
    });

    if (exists) {
      throw new ConflictException({
        message: 'TEST_RESULT_ALREADY_EXISTS',
        code: 'TEST_RESULT_DUPLICATE',
      });
    }

    const created = await this.prisma.userTestResults.create({
      data: {
        userId,
        testId: data.testId,
        score: data.score,
        testDate: data.testDate ? new Date(data.testDate) : null,
      },
      include: {
        test: true,
      },
    });

    await this.profileService.recalculate(userId);
    return created;
  }

  async findAll(userId: string, dto: PaginationDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 10;
    const skip = (page - 1) * limit;

    const results = await this.prisma.userTestResults.findMany({
      where: { userId },
      include: { test: true },
      skip,
      take: limit,
      orderBy: { testDate: 'desc' },
    });

    return results;
  }

  async findOne(userId: string, id: string) {
    const result = await this.prisma.userTestResults.findFirst({
      where: { id, userId },
      include: { test: true },
    });

    if (!result) {
      throw new NotFoundException({
        message: 'TEST_RESULT_NOT_FOUND',
        code: 'TEST_RESULT_NOT_FOUND',
      });
    }

    return result;
  }

  async update(userId: string, id: string, data: UpdateTestResultDto) {
    const existing = await this.prisma.userTestResults.findFirst({
      where: { id, userId },
      include: { test: true },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'TEST_RESULT_NOT_FOUND',
        code: 'TEST_RESULT_NOT_FOUND',
      });
    }

    if (data.score !== undefined) {
      this.validateScore(existing.test, data.score);
    }

    const updateData: Prisma.UserTestResultsUpdateInput = {};
    if (data.score !== undefined) {
      updateData.score = data.score;
    }
    if (data.testDate !== undefined) {
      updateData.testDate = data.testDate ? new Date(data.testDate) : null;
    }

    const updated = await this.prisma.userTestResults.update({
      where: { id },
      data: updateData,
      include: { test: true },
    });

    await this.profileService.recalculate(userId);
    return updated;
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.userTestResults.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'TEST_RESULT_NOT_FOUND',
        code: 'TEST_RESULT_NOT_FOUND',
      });
    }

    await this.prisma.userTestResults.delete({
      where: { id },
    });

    await this.profileService.recalculate(userId);
  }
}
