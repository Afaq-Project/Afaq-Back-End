const fs = require('fs');

const collections = ['Levora_API.postman_collection.json', 'Levora_API_localhost.postman_collection.json'];
const smokeTestsFile = 'tests/levora-smoke-tests.json';

const newProfileItems = [
  // Languages
  {
    "name": "Add Language",
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "body": {
        "mode": "raw",
        "raw": "{\n    \"languageId\": \"UUID-HERE\",\n    \"proficiencyLevelId\": \"UUID-HERE\",\n    \"isNative\": false\n}",
        "options": { "raw": { "language": "json" } }
      },
      "url": { "raw": "{{baseUrl}}/profile/languages", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "languages"] }
    }
  },
  {
    "name": "List Languages",
    "request": {
      "method": "GET",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/languages", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "languages"] }
    }
  },
  {
    "name": "Get Single Language",
    "request": {
      "method": "GET",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/languages/:id", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "languages", ":id"], "variable": [{"key": "id", "value": "UUID"}] }
    }
  },
  {
    "name": "Update Language",
    "request": {
      "method": "PATCH",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "body": {
        "mode": "raw",
        "raw": "{\n    \"proficiencyLevelId\": \"UUID-HERE\",\n    \"isNative\": true\n}",
        "options": { "raw": { "language": "json" } }
      },
      "url": { "raw": "{{baseUrl}}/profile/languages/:id", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "languages", ":id"], "variable": [{"key": "id", "value": "UUID"}] }
    }
  },
  {
    "name": "Delete Language",
    "request": {
      "method": "DELETE",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/languages/:id", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "languages", ":id"], "variable": [{"key": "id", "value": "UUID"}] }
    }
  },
  // Test Results
  {
    "name": "Add Test Result",
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "body": {
        "mode": "raw",
        "raw": "{\n    \"testId\": \"UUID-HERE\",\n    \"score\": 90,\n    \"testDate\": \"2024-01-15\"\n}",
        "options": { "raw": { "language": "json" } }
      },
      "url": { "raw": "{{baseUrl}}/profile/test-results", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "test-results"] }
    }
  },
  {
    "name": "List Test Results",
    "request": {
      "method": "GET",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/test-results", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "test-results"] }
    }
  },
  {
    "name": "Get Single Test Result",
    "request": {
      "method": "GET",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/test-results/:id", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "test-results", ":id"], "variable": [{"key": "id", "value": "UUID"}] }
    }
  },
  {
    "name": "Update Test Result",
    "request": {
      "method": "PATCH",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "body": {
        "mode": "raw",
        "raw": "{\n    \"score\": 95\n}",
        "options": { "raw": { "language": "json" } }
      },
      "url": { "raw": "{{baseUrl}}/profile/test-results/:id", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "test-results", ":id"], "variable": [{"key": "id", "value": "UUID"}] }
    }
  },
  {
    "name": "Delete Test Result",
    "request": {
      "method": "DELETE",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/test-results/:id", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "test-results", ":id"], "variable": [{"key": "id", "value": "UUID"}] }
    }
  },
  // Special Statuses
  {
    "name": "Add Special Status",
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "body": {
        "mode": "raw",
        "raw": "{\n    \"specialStatusId\": \"UUID-HERE\"\n}",
        "options": { "raw": { "language": "json" } }
      },
      "url": { "raw": "{{baseUrl}}/profile/special-statuses", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "special-statuses"] }
    }
  },
  {
    "name": "List Special Statuses",
    "request": {
      "method": "GET",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/special-statuses", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "special-statuses"] }
    }
  },
  {
    "name": "Delete Special Status",
    "request": {
      "method": "DELETE",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/special-statuses/:specialStatusId", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "special-statuses", ":specialStatusId"], "variable": [{"key": "specialStatusId", "value": "UUID"}] }
    }
  },
  // Preferences
  {
    "name": "Get Preferences",
    "request": {
      "method": "GET",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/preferences", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "preferences"] }
    }
  },
  {
    "name": "Add Target Degree",
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "body": {
        "mode": "raw",
        "raw": "{\n    \"educationLevelId\": \"UUID-HERE\"\n}",
        "options": { "raw": { "language": "json" } }
      },
      "url": { "raw": "{{baseUrl}}/profile/preferences/degrees", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "preferences", "degrees"] }
    }
  },
  {
    "name": "Delete Target Degree",
    "request": {
      "method": "DELETE",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/preferences/degrees/:educationLevelId", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "preferences", "degrees", ":educationLevelId"], "variable": [{"key": "educationLevelId", "value": "UUID"}] }
    }
  },
  {
    "name": "Add Target Major",
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "body": {
        "mode": "raw",
        "raw": "{\n    \"majorId\": \"UUID-HERE\"\n}",
        "options": { "raw": { "language": "json" } }
      },
      "url": { "raw": "{{baseUrl}}/profile/preferences/majors", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "preferences", "majors"] }
    }
  },
  {
    "name": "Delete Target Major",
    "request": {
      "method": "DELETE",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/preferences/majors/:majorId", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "preferences", "majors", ":majorId"], "variable": [{"key": "majorId", "value": "UUID"}] }
    }
  },
  {
    "name": "Add Target Institution",
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "body": {
        "mode": "raw",
        "raw": "{\n    \"institutionId\": \"UUID-HERE\"\n}",
        "options": { "raw": { "language": "json" } }
      },
      "url": { "raw": "{{baseUrl}}/profile/preferences/institutions", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "preferences", "institutions"] }
    }
  },
  {
    "name": "Delete Target Institution",
    "request": {
      "method": "DELETE",
      "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}", "type": "text" }],
      "url": { "raw": "{{baseUrl}}/profile/preferences/institutions/:institutionId", "host": ["{{baseUrl}}"], "path": ["api", "v1", "profile", "preferences", "institutions", ":institutionId"], "variable": [{"key": "institutionId", "value": "UUID"}] }
    }
  }
];

const newRefItems = [
  {
    "name": "List Languages",
    "request": {
      "method": "GET",
      "url": { "raw": "{{baseUrl}}/reference/languages", "host": ["{{baseUrl}}"], "path": ["api", "v1", "reference", "languages"] }
    }
  },
  {
    "name": "List Proficiency Levels",
    "request": {
      "method": "GET",
      "url": { "raw": "{{baseUrl}}/reference/proficiency-levels", "host": ["{{baseUrl}}"], "path": ["api", "v1", "reference", "proficiency-levels"] }
    }
  },
  {
    "name": "List Standardized Tests",
    "request": {
      "method": "GET",
      "url": { "raw": "{{baseUrl}}/reference/standardized-tests", "host": ["{{baseUrl}}"], "path": ["api", "v1", "reference", "standardized-tests"] }
    }
  },
  {
    "name": "List Special Statuses",
    "request": {
      "method": "GET",
      "url": { "raw": "{{baseUrl}}/reference/special-statuses", "host": ["{{baseUrl}}"], "path": ["api", "v1", "reference", "special-statuses"] }
    }
  }
];

collections.forEach(file => {
  let data = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  // Find Profile folder
  let profileFolder = data.item.find(i => i.name === 'Profile');
  if (profileFolder) {
    // Add items that are missing
    for (let newItem of newProfileItems) {
      if (!profileFolder.item.find(i => i.name === newItem.name)) {
        profileFolder.item.push(newItem);
      }
    }
  }
  
  // Find Reference folder
  let refFolder = data.item.find(i => i.name === 'Reference Data');
  if (refFolder) {
    for (let newItem of newRefItems) {
      if (!refFolder.item.find(i => i.name === newItem.name)) {
        refFolder.item.push(newItem);
      }
    }
  }
  
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
});

// Smoke Tests
const smoke = JSON.parse(fs.readFileSync(smokeTestsFile, 'utf8'));
const smokePublic = smoke.item.find(i => i.name === 'Public Endpoints');
const smokeProfile = smoke.item.find(i => i.name === 'Profile CRUD');

const smokeNewPublic = [
  {
    "name": "GET /reference/standardized-tests",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": [
      "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
      "var jsonData = pm.response.json();",
      "if (jsonData.data && jsonData.data.length > 0) { pm.collectionVariables.set('test_id', jsonData.data[0].id); }"
    ]}}],
    "request": { "method": "GET", "url": "{{baseUrl}}/api/v1/reference/standardized-tests" }
  },
  {
    "name": "GET /reference/special-statuses",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": [
      "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
      "var jsonData = pm.response.json();",
      "if (jsonData.data && jsonData.data.length > 0) { pm.collectionVariables.set('special_status_id', jsonData.data[0].id); }"
    ]}}],
    "request": { "method": "GET", "url": "{{baseUrl}}/api/v1/reference/special-statuses" }
  }
];

const smokeNewProfile = [
  {
    "name": "POST /profile/test-results",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": [
      "pm.test('Status code is 201', function () { pm.response.to.have.status(201); });",
      "var jsonData = pm.response.json(); pm.collectionVariables.set('test_result_id', jsonData.data.id);"
    ]}}],
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }, { "key": "Content-Type", "value": "application/json" }],
      "body": { "mode": "raw", "raw": "{\n  \"testId\": \"{{test_id}}\",\n  \"score\": 90\n}" },
      "url": "{{baseUrl}}/api/v1/profile/test-results"
    }
  },
  {
    "name": "GET /profile/test-results",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"]}}],
    "request": { "method": "GET", "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }], "url": "{{baseUrl}}/api/v1/profile/test-results" }
  },
  {
    "name": "PATCH /profile/test-results/{{test_result_id}}",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"]}}],
    "request": {
      "method": "PATCH",
      "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }, { "key": "Content-Type", "value": "application/json" }],
      "body": { "mode": "raw", "raw": "{\n  \"score\": 95\n}" },
      "url": "{{baseUrl}}/api/v1/profile/test-results/{{test_result_id}}"
    }
  },
  {
    "name": "DELETE /profile/test-results/{{test_result_id}}",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 204', function () { pm.response.to.have.status(204); });"]}}],
    "request": { "method": "DELETE", "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }], "url": "{{baseUrl}}/api/v1/profile/test-results/{{test_result_id}}" }
  },
  {
    "name": "POST /profile/special-statuses",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"]}}],
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }, { "key": "Content-Type", "value": "application/json" }],
      "body": { "mode": "raw", "raw": "{\n  \"specialStatusId\": \"{{special_status_id}}\"\n}" },
      "url": "{{baseUrl}}/api/v1/profile/special-statuses"
    }
  },
  {
    "name": "GET /profile/special-statuses",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"]}}],
    "request": { "method": "GET", "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }], "url": "{{baseUrl}}/api/v1/profile/special-statuses" }
  },
  {
    "name": "DELETE /profile/special-statuses/{{special_status_id}}",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 204', function () { pm.response.to.have.status(204); });"]}}],
    "request": { "method": "DELETE", "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }], "url": "{{baseUrl}}/api/v1/profile/special-statuses/{{special_status_id}}" }
  },
  {
    "name": "GET /profile/preferences",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"]}}],
    "request": { "method": "GET", "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }], "url": "{{baseUrl}}/api/v1/profile/preferences" }
  },
  {
    "name": "POST /profile/preferences/degrees",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"]}}],
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }, { "key": "Content-Type", "value": "application/json" }],
      "body": { "mode": "raw", "raw": "{\n  \"educationLevelId\": \"{{education_level_id}}\"\n}" },
      "url": "{{baseUrl}}/api/v1/profile/preferences/degrees"
    }
  },
  {
    "name": "DELETE /profile/preferences/degrees/{{education_level_id}}",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 204', function () { pm.response.to.have.status(204); });"]}}],
    "request": { "method": "DELETE", "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }], "url": "{{baseUrl}}/api/v1/profile/preferences/degrees/{{education_level_id}}" }
  },
  {
    "name": "POST /profile/preferences/majors",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"]}}],
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }, { "key": "Content-Type", "value": "application/json" }],
      "body": { "mode": "raw", "raw": "{\n  \"majorId\": \"{{major_id}}\"\n}" },
      "url": "{{baseUrl}}/api/v1/profile/preferences/majors"
    }
  },
  {
    "name": "DELETE /profile/preferences/majors/{{major_id}}",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 204', function () { pm.response.to.have.status(204); });"]}}],
    "request": { "method": "DELETE", "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }], "url": "{{baseUrl}}/api/v1/profile/preferences/majors/{{major_id}}" }
  },
  {
    "name": "POST /profile/preferences/institutions",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"]}}],
    "request": {
      "method": "POST",
      "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }, { "key": "Content-Type", "value": "application/json" }],
      "body": { "mode": "raw", "raw": "{\n  \"institutionId\": \"{{institution_id}}\"\n}" },
      "url": "{{baseUrl}}/api/v1/profile/preferences/institutions"
    }
  },
  {
    "name": "DELETE /profile/preferences/institutions/{{institution_id}}",
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": ["pm.test('Status code is 204', function () { pm.response.to.have.status(204); });"]}}],
    "request": { "method": "DELETE", "header": [{ "key": "Authorization", "value": "Bearer {{access_token}}" }], "url": "{{baseUrl}}/api/v1/profile/preferences/institutions/{{institution_id}}" }
  }
];

if (smokePublic) {
  for (let newItem of smokeNewPublic) {
    if (!smokePublic.item.find(i => i.name === newItem.name)) {
      smokePublic.item.push(newItem);
    }
  }
}

if (smokeProfile) {
  for (let newItem of smokeNewProfile) {
    if (!smokeProfile.item.find(i => i.name === newItem.name)) {
      smokeProfile.item.push(newItem);
    }
  }
}

fs.writeFileSync(smokeTestsFile, JSON.stringify(smoke, null, 2));
console.log("Updated collections!");
