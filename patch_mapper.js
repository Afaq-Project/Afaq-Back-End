const fs = require('fs');
const file = 'src/common/utils/user-mapper.util.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '// eslint-disable-next-line @typescript-eslint/no-explicit-any\nexport function formatUserResponse(user: any): MeResponseDto {',
  `export interface UserToMap {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  phone?: string;
  roles?: string[];
  userRoles?: { roles?: { name: string } }[];
  lastLoginAt?: Date | string;
}

export function formatUserResponse(user: UserToMap): MeResponseDto {`
);

fs.writeFileSync(file, code);
