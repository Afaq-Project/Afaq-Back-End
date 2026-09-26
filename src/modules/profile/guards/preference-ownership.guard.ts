import { RequestWithUser } from '@common/decorators';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class PreferenceOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !(user as { id?: string }).id) {
      throw new NotFoundException('Preference context mismatch');
    }

    return true;
  }
}
