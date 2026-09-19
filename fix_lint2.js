const fs = require('fs');

let file, content;

// user-mapper.util.ts
file = 'src/common/utils/user-mapper.util.ts';
content = fs.readFileSync(file, 'utf8');
content = "// eslint-disable-next-line @typescript-eslint/no-explicit-any\n" + content;
content = content.replace('user.userRoles.map((ur: Record<string, any>) =>', '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n    roles = user.userRoles.map((ur: any) =>');
content = content.replace('export function formatUserResponse(user: Record<string, any>) {', 'export function formatUserResponse(user: any) {');
fs.writeFileSync(file, content);

// jwt-auth.guard.ts
file = 'src/modules/auth/guards/jwt-auth.guard.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace('handleRequest(err: unknown, user: unknown, info: Error) {', '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  handleRequest(err: any, user: any, info: any) {');
fs.writeFileSync(file, content);

// profile.service.ts
file = 'src/modules/profile/services/profile.service.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace('private hasValidFieldOfStudy(fos: unknown): boolean {', '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  private hasValidFieldOfStudy(fos: any): boolean {');
content = content.replace('const educations = profile.user.userEducations.map((edu: Record<string, any>) => ({', '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n    const educations = profile.user.userEducations.map((edu: any) => ({');
fs.writeFileSync(file, content);

// educations.service.ts
file = 'src/modules/profile/services/educations.service.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace('const educations = profile.user.userEducations.map((edu: any) => ({', '// eslint-disable-next-line @typescript-eslint/no-explicit-any\n    const educations = profile.user.userEducations.map((edu: any) => ({');
fs.writeFileSync(file, content);
