const fs = require('fs');

const prodFile = 'Levora_API.postman_collection.json';
const localFile = 'Levora_API_localhost.postman_collection.json';

const prodData = JSON.parse(fs.readFileSync(prodFile, 'utf8'));
const localData = JSON.parse(fs.readFileSync(localFile, 'utf8'));

// Fix 1: Remove double /api/v1
const pathsToFix = [
  '{{baseUrl}}/api/v1/reference/languages',
  '{{baseUrl}}/api/v1/reference/education-levels',
  '{{baseUrl}}/api/v1/reference/app-languages',
  '{{baseUrl}}/api/v1/auth/login',
  '{{baseUrl}}/api/v1/profile/skills/00000000-0000-0000-0000-000000000000'
];

function fixDoubleApiV1(node) {
  if (node.request && node.request.url && node.request.url.raw) {
    if (pathsToFix.includes(node.request.url.raw)) {
      node.request.url.raw = node.request.url.raw.replace('/api/v1', '');
      if (node.request.url.path) {
        node.request.url.path = node.request.url.path.filter(p => p !== 'api' && p !== 'v1');
      }
    }
  }
  if (node.item) {
    for (const child of node.item) {
      fixDoubleApiV1(child);
    }
  }
}

// Fix 2: Replace {{access_token}} with {{accessToken}} globally just in case, or specifically in IDOR test header
function fixAccessToken(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/\{\{access_token\}\}/g, '{{accessToken}}');
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = fixAccessToken(obj[i]);
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      obj[key] = fixAccessToken(obj[key]);
    }
  }
  return obj;
}

// Fix 3: Copy Publish Profile tests from local to prod
let publishTest1, publishTest2;
// Find in local
const localProfileFolder = localData.item.find(i => i.name === 'Profile');
if (localProfileFolder) {
  const localGeneralFolder = localProfileFolder.item.find(i => i.name === 'General');
  if (localGeneralFolder) {
    publishTest1 = localGeneralFolder.item.find(i => i.name === 'Publish Profile');
    publishTest2 = localGeneralFolder.item.find(i => i.name === 'Publish Profile (Already Published)');
  }
}

const prodProfileFolder = prodData.item.find(i => i.name === 'Profile');
if (prodProfileFolder && publishTest1 && publishTest2) {
  const prodGeneralFolder = prodProfileFolder.item.find(i => i.name === 'General');
  if (prodGeneralFolder) {
    // Make sure they don't already exist
    const hasTest1 = prodGeneralFolder.item.find(i => i.name === 'Publish Profile');
    if (!hasTest1) {
      const updateIdx = prodGeneralFolder.item.findIndex(i => i.name === 'Update User Profile');
      if (updateIdx !== -1) {
        prodGeneralFolder.item.splice(updateIdx + 1, 0, JSON.parse(JSON.stringify(publishTest1)), JSON.parse(JSON.stringify(publishTest2)));
      }
    }
  }
}

// Apply Fix 1
fixDoubleApiV1(prodData);
fixDoubleApiV1(localData);

// Apply Fix 2 globally to catch all
const newProdData = fixAccessToken(prodData);
const newLocalData = fixAccessToken(localData);

fs.writeFileSync(prodFile, JSON.stringify(newProdData, null, 2) + '\n');
fs.writeFileSync(localFile, JSON.stringify(newLocalData, null, 2) + '\n');
console.log('Collections fixed successfully.');
