const fs = require('fs');
const file = 'Levora_API.postman_collection.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const removeSkills = (items) => {
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].name === 'Skills') {
      items.splice(i, 1);
      i--;
    } else if (items[i].item) {
      removeSkills(items[i].item);
    }
  }
};

removeSkills(data.item);
fs.writeFileSync(file, JSON.stringify(data, null, 2));
