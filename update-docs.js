const fs = require('fs');

const collections = ['Levora_API.postman_collection.json', 'Levora_API_localhost.postman_collection.json'];
const smokeTestsFile = 'tests/levora-smoke-tests.json';

const newProfileItems = [
  {
    "name": "List Documents",
    "request": {
      "method": "GET",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/documents", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "documents"] }
    }
  }
];

collections.forEach(file => {
  let data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let profileFolder = data.item.find(i => i.name === 'Profile');
  if (profileFolder) {
    for (let newItem of newProfileItems) {
      if (!profileFolder.item.find(i => i.name === newItem.name)) {
        profileFolder.item.push(newItem);
      }
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
});

const smoke = JSON.parse(fs.readFileSync(smokeTestsFile, 'utf8'));
const smokePublic = smoke.item.find(i => i.name === 'Public Endpoints');
const smokeProfile = smoke.item.find(i => i.name === 'Profile CRUD');

if (smokePublic) {
  const newItem = {
    "name": "GET /reference/document-types",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": [
      "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
      "var jsonData = pm.response.json();",
      "if (jsonData.data && jsonData.data.length > 0) { pm.collectionVariables.set('document_type_id', jsonData.data[0].id); }"
    ]}}],
    "request": { "method": "GET", "url": "{{baseUrl}}/api/v1/reference/document-types" }
  };
  if (!smokePublic.item.find(i => i.name === newItem.name)) smokePublic.item.push(newItem);
}

if (smokeProfile) {
  const newItem = {
    "name": "GET /profile/documents",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"]}}],
    "request": { "method": "GET", "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }], "url": "{{baseUrl}}/api/v1/profile/documents" }
  };
  if (!smokeProfile.item.find(i => i.name === newItem.name)) smokeProfile.item.push(newItem);
}

fs.writeFileSync(smokeTestsFile, JSON.stringify(smoke, null, 2));
console.log("Updated docs!");
