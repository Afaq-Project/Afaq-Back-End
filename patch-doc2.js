const fs = require('fs');
let content = fs.readFileSync('src/modules/profile/services/documents.service.spec.ts', 'utf8');

// The expect statement in getDocuments still has deletedAt and docType in select
content = content.replace(/deletedAt: true,\s*/g, '');
content = content.replace(/docType: true,\s*/g, '');

fs.writeFileSync('src/modules/profile/services/documents.service.spec.ts', content);
