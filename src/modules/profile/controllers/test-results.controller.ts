import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { TestResultsService } from '../services/test-results.service';
import { CreateTestResultDto } from '../dto/create-test-result.dto';
import { UpdateTestResultDto } from '../dto/update-test-result.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TestResultOwnershipGuard } from '../guards/test-result-ownership.guard';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('profile/test-results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile/test-results')
export class TestResultsController {
  constructor(private readonly testResultsService: TestResultsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new test result' })
  @ApiBody({ type: CreateTestResultDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async create(@Req() req: RequestWithUser, @Body() data: CreateTestResultDto) {
    return this.testResultsService.create(req.user.id, data);
  }

  @Get()
  @ApiOperation({ summary: 'Get all test results for the current user' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findAll(@Req() req: RequestWithUser, @Query() dto: PaginationDto) {
    return this.testResultsService.findAll(req.user.id, dto);
  }

  @Get(':id')
  @UseGuards(TestResultOwnershipGuard)
  @ApiOperation({ summary: 'Get a test result by ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'TEST_RESULT_NOT_FOUND' })
  async findOne(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.testResultsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @UseGuards(TestResultOwnershipGuard)
  @ApiOperation({ summary: 'Update a test result' })
  @ApiBody({ type: UpdateTestResultDto })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'TEST_RESULT_NOT_FOUND' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateTestResultDto,
  ) {
    return this.testResultsService.update(req.user.id, id, data);
  }

  @Delete(':id')
  @UseGuards(TestResultOwnershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a test result' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'TEST_RESULT_NOT_FOUND' })
  async remove(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.testResultsService.remove(req.user.id, id);
  }
}
