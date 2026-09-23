const fs = require('fs');

function replaceUnused(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const result = await service\.register/g, 'await service.register');
  content = content.replace(/const result1 = await service\.getProfile/g, 'await service.getProfile');
  content = content.replace(/const result2 = await service\.getMe/g, 'await service.getMe');
  content = content.replace(/const result = await service\.processOAuthLogin/g, 'await service.processOAuthLogin');
  fs.writeFileSync(file, content);
}

replaceUnused('src/modules/auth/auth.service.spec.ts');
replaceUnused('src/modules/auth/services/oauth-processor.service.spec.ts');
