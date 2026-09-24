const fs = require('fs');
const path = './tests/levora-smoke-tests.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

function fixUrls(obj) {
  if (typeof obj === 'object' && obj !== null) {
    if (obj.request && obj.request.url && obj.request.url.raw) {
      obj.request.url = obj.request.url.raw; // Convert to simple string
    }
    for (let key in obj) {
      fixUrls(obj[key]);
    }
  }
}

fixUrls(data);
fs.writeFileSync(path, JSON.stringify(data, null, 2));
