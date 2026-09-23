import { AllowExtraFields } from '../../../common/decorators/allow-extra-fields.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

@AllowExtraFields()
export class GetLanguagesDto extends PaginationDto {}
