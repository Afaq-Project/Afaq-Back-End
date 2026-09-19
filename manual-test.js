const http = require('http');

async function makeRequest(path, token, method) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, res => {
      resolve(res.statusCode);
    });

    req.on('error', error => {
      reject(error);
    });

    if (method === 'PATCH' || method === 'POST') {
      req.write('{}');
    }
    req.end();
  });
}

async function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: 'smoke-test@levora.com',
      password: 'TestPass123!'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.data && parsed.data.accessToken) {
            resolve(parsed.data.accessToken);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function run() {
  let token = await login();
  if (!token) {
      await new Promise(r => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/v1/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, r);
        req.write(JSON.stringify({email: 'dummy@levora.com', password: 'TestPass123!', firstName: 'A', lastName: 'B'}));
        req.end();
      });
      token = await new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/v1/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body).data.accessToken));
        });
        req.write(JSON.stringify({email: 'dummy@levora.com', password: 'TestPass123!'}));
        req.end();
      });
  }
  
  const endpoints = [
    { path: '/api/v1/profile/skills/invalid-uuid', method: 'PATCH' },
    { path: '/api/v1/profile/languages/invalid-uuid', method: 'PATCH' },
    { path: '/api/v1/profile/documents/invalid-uuid', method: 'DELETE' } // changed to DELETE because PATCH doesn't exist for documents
  ];

  for (const ep of endpoints) {
    const status = await makeRequest(ep.path, token, ep.method);
    console.log(`${ep.method} ${ep.path} -> ${status}`);
    if (status !== 400) {
        console.error(`ERROR: Expected 400 but got ${status}`);
        process.exit(1);
    }
  }
  console.log("All manual tests passed (400 strict).");
}

run().catch(console.error);
