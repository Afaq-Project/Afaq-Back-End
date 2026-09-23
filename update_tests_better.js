const fs = require('fs');

function addEndpoints(collectionPath, isSmokeTest) {
    let data = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
    
    let refFolder, profileFolder;
    
    if (isSmokeTest) {
        refFolder = data.item.find(i => i.name === 'Public Endpoints');
        profileFolder = data.item.find(i => i.name === 'Profile CRUD');
    } else {
        refFolder = data.item.find(i => i.name === 'Reference Data');
        let profileMain = data.item.find(i => i.name === 'Profile');
        if (profileMain) {
            profileFolder = profileMain.item.find(i => i.name === 'General');
        }
    }
    
    if (!refFolder) {
        refFolder = { name: isSmokeTest ? 'Public Endpoints' : 'Reference Data', item: [] };
        data.item.push(refFolder);
    }
    
    if (!profileFolder) {
        profileFolder = { name: isSmokeTest ? 'Profile CRUD' : 'General', item: [] };
        if (!isSmokeTest) {
            let profileMain = data.item.find(i => i.name === 'Profile');
            if (!profileMain) {
                profileMain = { name: 'Profile', item: [profileFolder] };
                data.item.push(profileMain);
            } else {
                profileMain.item.push(profileFolder);
            }
        } else {
            data.item.push(profileFolder);
        }
    }

    // Reference endpoints to add
    const refs = [
        { path: 'countries', name: isSmokeTest ? 'GET /reference/countries' : 'Get Countries' },
        { path: 'cities', name: isSmokeTest ? 'GET /reference/cities' : 'Get Cities' },
        { path: 'marital-statuses', name: isSmokeTest ? 'GET /reference/marital-statuses' : 'Get Marital Statuses' }
    ];
    
    refs.forEach(ref => {
        if (!refFolder.item.find(i => i.name === ref.name)) {
            refFolder.item.push({
                name: ref.name,
                event: isSmokeTest ? [
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
                ] : undefined,
                request: {
                    method: "GET",
                    url: {
                        raw: `{{baseUrl}}/api/v1/reference/${ref.path}`,
                        host: ["{{baseUrl}}"],
                        path: ["api", "v1", "reference", ref.path]
                    }
                }
            });
            console.log(`Added ${ref.name} to ${collectionPath}`);
        }
    });

    // Profile endpoints to add
    const profiles = [
        { name: isSmokeTest ? 'GET /profile/me' : 'Get User Profile (me)', path: ['profile', 'me'], method: 'GET' },
        { name: isSmokeTest ? 'PATCH /profile/personal' : 'Update Personal Profile', path: ['profile', 'personal'], method: 'PATCH', body: { mode: 'raw', raw: '{\n  "firstName": "Updated Name"\n}', options: { raw: { language: 'json' } } } }
    ];
    
    profiles.forEach(prof => {
        if (!profileFolder.item.find(i => i.name === prof.name)) {
            const req = {
                name: prof.name,
                event: isSmokeTest ? [
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
                ] : undefined,
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

['tests/levora-smoke-tests.json'].forEach(file => {
    if (fs.existsSync(file)) addEndpoints(file, true);
});

['Levora_API.postman_collection.json', 'Levora_API_localhost.postman_collection.json', 'docs/postman/Levora_API.postman_collection.json'].forEach(file => {
    if (fs.existsSync(file)) addEndpoints(file, false);
});
