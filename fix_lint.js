const fs = require('fs');
let file, content;

// user-mapper.util.ts
file = 'src/common/utils/user-mapper.util.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace('export function formatUserResponse(user: any) {', 'export function formatUserResponse(user: Record<string, any>) {');
content = content.replace('user.userRoles.map((ur: any)', 'user.userRoles.map((ur: Record<string, any>)');
fs.writeFileSync(file, content);

// auth.controller.ts
file = 'src/modules/auth/auth.controller.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace('catch (err) {}', 'catch { /* ignore */ }');
fs.writeFileSync(file, content);

// jwt-auth.guard.ts
file = 'src/modules/auth/guards/jwt-auth.guard.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace('handleRequest(err: any, user: any, info: any) {', 'handleRequest(err: unknown, user: unknown, info: Error) {');
fs.writeFileSync(file, content);

// profile.service.ts
file = 'src/modules/profile/services/profile.service.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace('private hasValidFieldOfStudy(fos: any): boolean {', 'private hasValidFieldOfStudy(fos: unknown): boolean {');
content = content.replace('} catch {}', '} catch { /* ignore */ }');
content = content.replace('return Object.keys(fos).length > 0;', 'return Object.keys(fos as Record<string, unknown>).length > 0;');
content = content.replace('const educations = profile.user.userEducations.map((edu: any) => ({', 'const educations = profile.user.userEducations.map((edu: Record<string, any>) => ({');
fs.writeFileSync(file, content);
