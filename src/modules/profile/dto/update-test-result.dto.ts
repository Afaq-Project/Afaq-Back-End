import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTestResultDto } from './create-test-result.dto';

export class UpdateTestResultDto extends PartialType(
  OmitType(CreateTestResultDto, ['testId'] as const),
) {}
