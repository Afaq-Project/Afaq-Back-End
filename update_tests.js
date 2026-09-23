const fs = require('fs');

function addIfMissing(collectionPath) {
    let data = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
    
    // Find Public Endpoints folder
    let publicFolder = data.item.find(i => i.name === 'Public Endpoints');
    if (!publicFolder) {
        publicFolder = { name: 'Public Endpoints', item: [] };
        data.item.push(publicFolder);
    }
    
    // Reference endpoints to add
    const refs = ['countries', 'cities', 'marital-statuses'];
    refs.forEach(ref => {
        const name = `GET /reference/${ref}`;
        if (!publicFolder.item.find(i => i.name === name)) {
            publicFolder.item.push({
                name: name,
                event: [
                    {
                        listen: "test",
                        script: {
                            exec: [
                                "pm.test('Status code is 200', function () {",
                                "    pm.response.to.have.status(200);",
                                "});",
                                "pm.test('Response is an array', function () {",
                                "    var jsonData = pm.response.json();",
                                "    pm.expect(jsonData.data).to.be.an('array');",
                                "});"
                            ],
                            type: "text/javascript"
                        }
                    }
                ],
                request: {
                    method: "GET",
                    url: {
                        raw: `{{baseUrl}}/api/v1/reference/${ref}`,
                        host: ["{{baseUrl}}"],
                        path: ["api", "v1", "reference", ref]
                    }
                }
            });
            console.log(`Added ${name} to ${collectionPath}`);
        }
    });

    // Find Profile CRUD folder
    let profileFolder = data.item.find(i => i.name === 'Profile CRUD');
    if (!profileFolder) {
        profileFolder = { name: 'Profile CRUD', item: [] };
        data.item.push(profileFolder);
    }
    
    // Profile endpoints to add
    const profiles = [
        { name: 'GET /profile/me', path: ['profile', 'me'], method: 'GET' },
        { name: 'PATCH /profile/personal', path: ['profile', 'personal'], method: 'PATCH', body: { mode: 'raw', raw: '{\n  "firstName": "Updated Name"\n}', options: { raw: { language: 'json' } } } }
    ];
    
    profiles.forEach(prof => {
        if (!profileFolder.item.find(i => i.name === prof.name)) {
            const req = {
                name: prof.name,
                event: [
                    {
                        listen: "test",
                        script: {
                            exec: [
                                "pm.test('Status code is 200', function () {",
                                "    pm.response.to.have.status(200);",
                                "});"
                            ],
                            type: "text/javascript"
                        }
                    }
                ],
                request: {
                    method: prof.method,
                    header: [{ key: "Authorization", value: "Bearer {{access_token}}" }],
                    url: {
                        raw: `{{baseUrl}}/api/v1/${prof.path.join('/')}`,
                        host: ["{{baseUrl}}"],
                        path: ["api", "v1", ...prof.path]
                    }
                }
            };
            if (prof.body) req.request.body = prof.body;
            profileFolder.item.push(req);
            console.log(`Added ${prof.name} to ${collectionPath}`);
        }
    });
    
    fs.writeFileSync(collectionPath, JSON.stringify(data, null, 2));
}

['tests/levora-smoke-tests.json', 'Levora_API.postman_collection.json', 'Levora_API_localhost.postman_collection.json', 'docs/postman/Levora_API.postman_collection.json'].forEach(file => {
    if (fs.existsSync(file)) {
        addIfMissing(file);
    }
});
