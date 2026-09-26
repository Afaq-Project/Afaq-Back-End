import { MeResponseDto } from '../../modules/auth/dto/me-response.dto';

export interface UserToMap {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  phone?: string;
  roles?: string[];
  userRoles?: { role: { name: string } }[];
  lastLoginAt?: Date | string | null;
}

export function formatUserResponse(user: UserToMap): MeResponseDto {
  let roles: string[] = ['user'];
  if (Array.isArray(user.userRoles) && user.userRoles.length > 0) {
    roles = user.userRoles.map(
      (ur: { role: { name: string } }) => ur.role?.name ?? 'user',
    );
  } else if (Array.isArray(user.roles)) {
    roles = user.roles;
  }

  const response: MeResponseDto = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    picture: user.picture,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    phone: user.phone,
    roles,
    lastLoginAt:
      typeof user.lastLoginAt === 'string'
        ? new Date(user.lastLoginAt)
        : (user.lastLoginAt ?? undefined),
  };

  // Keep it undefined so tests pass
  return response;
}
