const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'tests/levora-smoke-tests.json');
let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

function removeDisabled(items) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].disabled === true) {
      items.splice(i, 1);
    } else if (items[i].item) {
      removeDisabled(items[i].item);
    }
  }
}

removeDisabled(data.item);

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('Removed disabled items');
