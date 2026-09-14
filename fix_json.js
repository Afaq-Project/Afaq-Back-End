const fs = require('fs');

const files = ['Levora_API.postman_collection.json', 'tests/levora-smoke-tests.json'];

function processItem(item) {
    if (item.item) {
        item.item.forEach(processItem);
        return;
    }

    if (item.name === 'GET /reference/skills-taxonomy') {
        let testEvent = item.event?.find(e => e.listen === 'test');
        if (testEvent && testEvent.script && testEvent.script.exec) {
            testEvent.script.exec.push("pm.collectionVariables.set('test_skill_id', pm.response.json().data[0].skills[0].id);");
        }
    }

    if (item.name === 'GET /reference/languages') {
        let testEvent = item.event?.find(e => e.listen === 'test');
        if (testEvent && testEvent.script && testEvent.script.exec) {
            testEvent.script.exec.push("pm.collectionVariables.set('test_language_id', pm.response.json().data[0].id);");
        }
    }

    if (item.name === 'GET /reference/fields-of-study') {
        let testEvent = item.event?.find(e => e.listen === 'test');
        if (testEvent && testEvent.script && testEvent.script.exec) {
            testEvent.script.exec.push("pm.collectionVariables.set('test_field_id', pm.response.json().data[0].id);");
        }
    }

    if (item.name === 'POST /profile/skills') {
        if (item.request && item.request.body) {
            item.request.body.mode = 'raw';
            item.request.body.raw = '{"skillId": "{{test_skill_id}}", "proficiency": 3}';
            item.request.body.options = { raw: { language: 'json' } };
        }
    }

    if (item.name === 'POST /profile/languages') {
        if (item.request && item.request.body) {
            item.request.body.mode = 'raw';
            item.request.body.raw = '{"languageId": "{{test_language_id}}", "proficiency": "Native"}';
            item.request.body.options = { raw: { language: 'json' } };
        }
    }

    if (item.name === 'POST /profile/fields-of-study') {
        if (item.request && item.request.body) {
            item.request.body.mode = 'raw';
            item.request.body.raw = '{"fieldId": "{{test_field_id}}"}';
            item.request.body.options = { raw: { language: 'json' } };
        }
    }

    if (item.name.startsWith('DELETE /profile/skills/')) {
        item.name = 'DELETE /profile/skills/{{test_skill_id}}';
        if (item.request && item.request.url) {
            item.request.url.raw = "{{baseUrl}}/api/v1/profile/skills/{{test_skill_id}}";
            item.request.url.path = ["api", "v1", "profile", "skills", "{{test_skill_id}}"];
        }
    }

    if (item.name.startsWith('DELETE /profile/languages/')) {
        item.name = 'DELETE /profile/languages/{{test_language_id}}';
        if (item.request && item.request.url) {
            item.request.url.raw = "{{baseUrl}}/api/v1/profile/languages/{{test_language_id}}";
            item.request.url.path = ["api", "v1", "profile", "languages", "{{test_language_id}}"];
        }
    }

    if (item.name.startsWith('DELETE /profile/fields-of-study/')) {
        item.name = 'DELETE /profile/fields-of-study/{{test_field_id}}';
        if (item.request && item.request.url) {
            item.request.url.raw = "{{baseUrl}}/api/v1/profile/fields-of-study/{{test_field_id}}";
            item.request.url.path = ["api", "v1", "profile", "fields-of-study", "{{test_field_id}}"];
        }
    }
}

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = JSON.parse(fs.readFileSync(file, 'utf8'));
        content.item.forEach(processItem);
        fs.writeFileSync(file, JSON.stringify(content, null, 2));
        console.log(`Updated ${file}`);
    } else {
        console.log(`File not found: ${file}`);
    }
}
