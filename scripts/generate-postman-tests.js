const fs = require('fs');

const collection = {
  info: {
    name: "Levora Behavioral Tests - Batch 1",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:3000", type: "string" },
    { key: "test_user_email", value: `behavior${Date.now()}@levora.com`, type: "string" },
    { key: "test_user_password", value: "TestPass123!", type: "string" },
    { key: "access_token", value: "", type: "string" },
    { key: "country_id", value: "", type: "string" },
    { key: "city_id", value: "", type: "string" },
    { key: "invalid_city_id", value: "123e4567-e89b-12d3-a456-426614174000", type: "string" },
    { key: "invalid_marital_status_id", value: "123e4567-e89b-12d3-a456-426614174000", type: "string" }
  ],
  item: []
};

function addRequest(name, method, path, body, testScript, auth = false) {
  const req = {
    name,
    event: [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: testScript
        }
      }
    ],
    request: {
      method,
      url: {
        raw: `{{baseUrl}}${path}`,
        host: ["{{baseUrl}}"],
        path: path.split('/').filter(p => p)
      }
    }
  };
  
  if (auth) {
    req.request.header = [
      { key: "Authorization", value: "Bearer {{access_token}}" },
      { key: "Content-Type", value: "application/json" }
    ];
  } else {
    req.request.header = [
      { key: "Content-Type", value: "application/json" }
    ];
  }

  if (body) {
    req.request.body = { mode: "raw", raw: JSON.stringify(body, null, 2) };
  }
  
  collection.item.push(req);
}

// Token-free reference tests (EC-060)
addRequest("EC-060 GET /reference/countries without token", "GET", "/api/v1/reference/countries", null, [
  "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
  "var jsonData = pm.response.json();",
  "if (jsonData.data && jsonData.data.length > 0) {",
  "   pm.collectionVariables.set('country_id', jsonData.data[0].id);",
  "}"
]);

addRequest("EC-060 GET /reference/cities without token", "GET", "/api/v1/reference/cities", null, [
  "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
  "var jsonData = pm.response.json();",
  "if (jsonData.data && jsonData.data.length > 0) {",
  "   pm.collectionVariables.set('city_id', jsonData.data[0].id);",
  "}"
]);

addRequest("EC-061 Invalid pagination input", "GET", "/api/v1/reference/countries?page=invalid", null, [
  "pm.test('Status code is 400', function () { pm.response.to.have.status(400); });",
  "var json = pm.response.json();",
  "pm.test('Error is VALIDATION_ERROR', function () { pm.expect(json.errors && json.errors[0] ? json.errors[0].code : null).to.eql('VALIDATION_ERROR'); });"
]);

// Auth tests
addRequest("Register user", "POST", "/api/v1/auth/register", {
  email: "{{test_user_email}}",
  password: "{{test_user_password}}",
  firstName: "Behav",
  lastName: "User"
}, [
  "pm.test('Status code is 201 or 409', function () { pm.expect(pm.response.code).to.be.oneOf([201, 409]); });"
]);

addRequest("Login user", "POST", "/api/v1/auth/login", {
  email: "{{test_user_email}}",
  password: "{{test_user_password}}"
}, [
  "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
  "pm.collectionVariables.set('access_token', pm.response.json().data.accessToken);"
]);

addRequest("EC-001 GET /profile/me - Signup creates empty profile", "GET", "/api/v1/profile/me", null, [
  "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
  "var data = pm.response.json().data;",
  "pm.test('Completion is 0 and not matchable', function () {",
  "   pm.expect(data.completionPct).to.eql(0);",
  "   pm.expect(data.isMatchable).to.be.false;",
  "});"
], true);

addRequest("EC-002 Partial personal update", "PATCH", "/api/v1/profile/personal", {
  bio: "This is a valid bio."
}, [
  "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
  "pm.test('Bio is updated', function () { pm.expect(pm.response.json().data.bio).to.eql('This is a valid bio.'); });"
], true);

addRequest("EC-003 Update with computed fields rejected", "PATCH", "/api/v1/profile/personal", {
  completionPct: 100
}, [
  "pm.test('Status code is 400', function () { pm.response.to.have.status(400); });",
  "var json = pm.response.json();",
  "pm.test('Error is UNKNOWN_FIELD', function () { pm.expect(json.errors && json.errors[0] ? json.errors[0].code : null).to.eql('UNKNOWN_FIELD'); });"
], true);

addRequest("EC-005 bio is one character over limit", "PATCH", "/api/v1/profile/personal", {
  bio: "a".repeat(501)
}, [
  "pm.test('Status code is 400', function () { pm.response.to.have.status(400); });",
  "var json = pm.response.json();",
  "pm.test('Error is BIO_TOO_LONG or VALIDATION_ERROR', function () { pm.expect(json.errors && json.errors[0] ? json.errors[0].code : null).to.be.oneOf(['BIO_TOO_LONG', 'VALIDATION_ERROR']); });"
], true);

addRequest("EC-007 Invalid marital status UUID reference", "PATCH", "/api/v1/profile/personal", {
  maritalStatusId: "invalid-uuid"
}, [
  "pm.test('Status code is 400', function () { pm.response.to.have.status(400); });",
  "var json = pm.response.json();",
  "pm.test('Error is VALIDATION_ERROR', function () { pm.expect(json.errors && json.errors[0] ? json.errors[0].code : null).to.eql('VALIDATION_ERROR'); });"
], true);

addRequest("EC-007 Non-existent marital status UUID", "PATCH", "/api/v1/profile/personal", {
  maritalStatusId: "{{invalid_marital_status_id}}"
}, [
  "pm.test('Status code is 400', function () { pm.response.to.have.status(400); });",
  "var json = pm.response.json();",
  "pm.test('Error is INVALID_MARITAL_STATUS', function () { pm.expect(json.errors && json.errors[0] ? json.errors[0].code : null).to.eql('INVALID_MARITAL_STATUS'); });"
], true);

addRequest("EC-008 Undeclared DTO field", "PATCH", "/api/v1/profile/personal", {
  someRandomField: "value"
}, [
  "pm.test('Status code is 400', function () { pm.response.to.have.status(400); });",
  "var json = pm.response.json();",
  "pm.test('Error is UNKNOWN_FIELD', function () { pm.expect(json.errors && json.errors[0] ? json.errors[0].code : null).to.eql('UNKNOWN_FIELD'); });"
], true);

addRequest("EC-009 Missing token on protected route", "GET", "/api/v1/profile/me", null, [
  "pm.test('Status code is 401', function () { pm.response.to.have.status(401); });"
]);

addRequest("EC-064 Request/response error envelopes", "PATCH", "/api/v1/profile/personal", {
  maritalStatusId: "123e4567-e89b-12d3-a456-426614174000"
}, [
  "pm.test('Envelope matches', function () {",
  "   var json = pm.response.json();",
  "   pm.expect(json).to.have.property('success', false);",
  "   pm.expect(json).to.have.property('errors');",
  "   pm.expect(json).to.not.have.property('stack');",
  "});"
], true);

fs.writeFileSync('tests/levora-behavioral-tests.json', JSON.stringify(collection, null, 2));
console.log('Test collection generated.');
