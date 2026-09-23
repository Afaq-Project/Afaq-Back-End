const fs = require('fs');
const file = 'tests/levora-smoke-tests.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Delete Skills if any remains
data.item = data.item.filter(f => f.name !== 'Skills');

// Add Profile smoke tests
data.item.push({
  "name": "Profile",
  "item": [
    {
      "name": "GET /profile",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{baseUrl}}/api/v1/profile",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v1", "profile"]
        },
        "header": [
          { "key": "Authorization", "value": "Bearer {{access_token}}" }
        ]
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "type": "text/javascript",
            "exec": [
              "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"
            ]
          }
        }
      ]
    },
    {
      "name": "PATCH /profile",
      "request": {
        "method": "PATCH",
        "url": {
          "raw": "{{baseUrl}}/api/v1/profile",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v1", "profile"]
        },
        "header": [
          { "key": "Authorization", "value": "Bearer {{access_token}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"firstName\": \"SmokeTestName\"\n}"
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "type": "text/javascript",
            "exec": [
              "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"
            ]
          }
        }
      ]
    }
  ]
});

// Add Reference smoke tests
data.item.push({
  "name": "Reference",
  "item": [
    {
      "name": "GET /reference/education-levels",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{baseUrl}}/api/v1/reference/education-levels",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v1", "reference", "education-levels"]
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "type": "text/javascript",
            "exec": [
              "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"
            ]
          }
        }
      ]
    },
    {
      "name": "GET /reference/countries",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{baseUrl}}/api/v1/reference/countries",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v1", "reference", "countries"]
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "type": "text/javascript",
            "exec": [
              "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"
            ]
          }
        }
      ]
    }
  ]
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
