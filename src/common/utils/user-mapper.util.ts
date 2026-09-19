// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatUserResponse(user: any) {
  let roles: string[] = ['user'];
  if (Array.isArray(user.userRoles) && user.userRoles.length > 0) {
    roles = // eslint-disable-next-line @typescript-eslint/no-explicit-any
      roles = user.userRoles.map((ur: any) => ur.roles?.name ?? 'user');
  } else if (Array.isArray(user.roles)) {
    roles = user.roles;
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    picture: user.picture,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    phone: user.phone,
    roles,
    lastLoginAt: user.lastLoginAt,
    userProfile: user.userProfile
      ? {
          ...user.userProfile,
          educations: user.userProfile.educations ?? [],
          skills: user.userProfile.skills ?? [],
          languages: user.userProfile.languages ?? [],
          documents: user.userProfile.documents ?? [],
        }
      : null,
  };
}
