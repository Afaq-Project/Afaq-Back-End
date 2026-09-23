const fs = require('fs');
let content = fs.readFileSync('src/modules/profile/services/documents.service.spec.ts', 'utf8');

content = content.replace(/docType: 'resume',/g, '');
content = content.replace(/isEncrypted: true,/g, '');
content = content.replace(/deletedAt: null/g, '');
content = content.replace(/where: { userId: 'user-1',  },/g, "where: { userId: 'user-1' },");
content = content.replace(/where: { userId: 'user-1' },/g, "where: { userId: 'user-1' },");

fs.writeFileSync('src/modules/profile/services/documents.service.spec.ts', content);
