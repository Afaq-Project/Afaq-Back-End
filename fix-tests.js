const fs = require('fs');

const collectionPath = 'tests/levora-smoke-tests.json';
const rawData = fs.readFileSync(collectionPath, 'utf8');
const collection = JSON.parse(rawData);

let negativeTestsFolder;
let profileCrudFolder;
let testToMove;
let testIndexInNegative;
let deleteIndexInProfileCrud;

// Find folders
for (const item of collection.item) {
  if (item.name === 'Negative Tests') negativeTestsFolder = item;
  if (item.name === 'Profile CRUD') profileCrudFolder = item;
}

if (!negativeTestsFolder || !profileCrudFolder) {
  console.error("Could not find required folders");
  process.exit(1);
}

// Find test to move
for (let i = 0; i < negativeTestsFolder.item.length; i++) {
  if (negativeTestsFolder.item[i].name === 'PATCH missing cross-field (gpaScale without gpaValue)') {
    testToMove = negativeTestsFolder.item[i];
    testIndexInNegative = i;
    break;
  }
}

if (!testToMove) {
  console.error("Could not find the test to move");
  process.exit(1);
}

// Revert the assertion back to strict 400
for (const event of testToMove.event) {
  if (event.listen === 'test') {
    const exec = event.script.exec;
    for (let i = 0; i < exec.length; i++) {
      if (exec[i].includes('pm.test(\'Status code is 400 or 404\'')) {
        exec[i] = "                  \"pm.test('Status code is 400', function () {\",";
      }
      if (exec[i].includes('pm.expect(pm.response.code).to.be.oneOf([400, 404])')) {
        exec[i] = "                  \"    pm.response.to.have.status(400);\",";
      }
    }
    // Set exactly what it used to be
    event.script.exec = [
      "pm.test('Status code is 400', function () {",
      "    pm.response.to.have.status(400);",
      "});"
    ];
  }
}

// Remove test from Negative Tests
negativeTestsFolder.item.splice(testIndexInNegative, 1);

// Find DELETE /profile/educations/{{education_id}} in Profile CRUD
for (let i = 0; i < profileCrudFolder.item.length; i++) {
  if (profileCrudFolder.item[i].name === 'DELETE /profile/educations/{{education_id}}') {
    deleteIndexInProfileCrud = i;
    break;
  }
}

if (deleteIndexInProfileCrud === undefined) {
  console.error("Could not find the DELETE test");
  process.exit(1);
}

// Insert before DELETE
profileCrudFolder.item.splice(deleteIndexInProfileCrud, 0, testToMove);

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
console.log("Test moved and reverted successfully!");
